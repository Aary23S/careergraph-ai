import crypto from 'crypto';
import { models } from '../config/database.js';
import { env } from '../config/env.js';
import { enqueueAIJob } from '../queues/ai.queue.js';
import { calculateMatchScore } from './intelligence.service.js';
import { analyzeJobResumeFit } from './resume-analysis.service.js';

const TRACKED_JOBS_REFRESH_CAP = 20;

const COMPATIBILITY_NUMERIC = {
  high: 100,
  medium: 65,
  low: 30
};

function blendScore(ruleScore, compatibilityAssessment) {
  const compatNumeric = COMPATIBILITY_NUMERIC[compatibilityAssessment];
  if (compatNumeric === undefined) return ruleScore;
  return Math.round(ruleScore * 0.5 + compatNumeric * 0.5);
}

export function computeInputHash(job, resumeEnrichment, profile) {
  const parts = [
    job.title || '',
    job.description || '',
    (resumeEnrichment?.userCorrectedSkills || resumeEnrichment?.skills || []).join(','),
    JSON.stringify(resumeEnrichment?.experience || []),
    resumeEnrichment?.userCorrectedSummary || resumeEnrichment?.summary || '',
    (profile?.skills || []).join(','),
    (profile?.targetRoles || []).join(','),
    profile?.experience || ''
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

function isPermanentError(err) {
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('timeout')) return 'TIMEOUT';
  if (msg.includes('disabled')) return 'AI_DISABLED';
  if (msg.includes('validation')) return 'VALIDATION_FAILED';
  if (msg.includes('fetch') || msg.includes('connection')) return 'PROVIDER_UNAVAILABLE';
  return 'UNKNOWN';
}

/**
 * Enqueues a Job ID for asynchronous, persisted AI match analysis against the
 * user's active resume. No-ops if AI is disabled or there is no completed
 * resume enrichment to analyze against.
 */
export async function enqueueJobMatchAnalysis(jobId) {
  if (!env.aiEnabled) return;

  try {
    const job = await models.Job.findByPk(jobId);
    if (!job) return;

    const profile = await models.Profile.findOne({ where: { user_id: job.user_id } });
    const activeResume = await models.Resume.findOne({
      where: { user_id: job.user_id, isActive: true },
      include: [{ model: models.ResumeAiEnrichment, as: 'aiEnrichment' }]
    });

    if (!activeResume?.aiEnrichment || activeResume.aiEnrichment.status !== 'completed') {
      return;
    }

    const inputHash = computeInputHash(job, activeResume.aiEnrichment, profile);

    let analysis = await models.JobMatchAnalysis.findOne({ where: { jobId } });
    if (analysis) {
      if (analysis.inputHash === inputHash && ['completed', 'skipped'].includes(analysis.status)) {
        return;
      }
      await analysis.update({
        status: 'pending',
        inputHash,
        resumeId: activeResume.id,
        provider: env.aiProvider,
        model: env.ollamaModel,
        errorCode: null
      });
    } else {
      analysis = await models.JobMatchAnalysis.create({
        jobId,
        resumeId: activeResume.id,
        provider: env.aiProvider,
        model: env.ollamaModel,
        status: 'pending',
        inputHash
      });
    }

    await enqueueAIJob('job_match_analysis', jobId, { inputHash, userId: job.user_id });
  } catch (err) {
    console.error(`[JobMatchAnalysisService] Failed to enqueue job ${jobId}:`, err);
  }
}

/**
 * Executes the blended rule-based + LLM match analysis for a job and persists it.
 */
export async function executeJobMatchAnalysis(jobId) {
  let analysis = await models.JobMatchAnalysis.findOne({ where: { jobId } });
  const job = await models.Job.findByPk(jobId);
  if (!job) return;

  const profile = await models.Profile.findOne({ where: { user_id: job.user_id } });
  const activeResume = await models.Resume.findOne({
    where: { user_id: job.user_id, isActive: true },
    include: [{ model: models.ResumeAiEnrichment, as: 'aiEnrichment' }]
  });

  if (!activeResume?.aiEnrichment || activeResume.aiEnrichment.status !== 'completed') {
    if (analysis) {
      await analysis.update({ status: 'failed', errorCode: 'NO_ACTIVE_RESUME' });
    }
    return;
  }

  const inputHash = computeInputHash(job, activeResume.aiEnrichment, profile);

  if (!analysis) {
    analysis = await models.JobMatchAnalysis.create({
      jobId,
      resumeId: activeResume.id,
      provider: env.aiProvider,
      model: env.ollamaModel,
      status: 'pending',
      inputHash
    });
  }

  await analysis.update({ status: 'processing' });
  const start = Date.now();

  try {
    const ruleScore = calculateMatchScore(profile, job);
    const fit = await analyzeJobResumeFit(job.id, activeResume.id);
    const finalScore = blendScore(ruleScore, fit.compatibilityAssessment);
    const latency = Date.now() - start;

    await analysis.update({
      status: 'completed',
      resumeId: activeResume.id,
      inputHash,
      provider: env.aiProvider,
      model: env.ollamaModel,
      ruleScore,
      finalScore,
      compatibilityAssessment: fit.compatibilityAssessment,
      matchedSkills: fit.matchedSkills,
      missingSkills: fit.missingSkills,
      strengths: fit.strengths,
      potentialGaps: fit.potentialGaps,
      analysisSummary: fit.analysisSummary,
      latencyMs: latency,
      errorCode: null,
      computedAt: new Date()
    });

    // Static update deliberately bypasses instance hooks: Job's beforeSave hook
    // recomputes the plain rule-based score on every instance save, which would
    // immediately overwrite this blended value if we used job.save()/job.update().
    await models.Job.update({ matchScore: finalScore }, { where: { id: jobId } });
  } catch (err) {
    const latency = Date.now() - start;
    await analysis.update({
      status: 'failed',
      errorCode: isPermanentError(err),
      analysisSummary: err.message,
      latencyMs: latency
    });
  }
}

/**
 * Refreshes match analysis for a bounded set of "tracked" jobs (non-new,
 * non-archived, or with an existing Application) after something that affects
 * scoring changes user-wide (active resume switch, resume enrichment completing).
 * Capped to avoid an expensive mass LLM fan-out across a user's whole job list.
 */
export async function refreshMatchAnalysisForTrackedJobs(userId) {
  try {
    const applications = await models.Application.findAll({
      where: { user_id: userId },
      attributes: ['job_id']
    });
    const appliedJobIds = new Set(applications.map((a) => a.job_id));

    const candidates = await models.Job.findAll({
      where: { user_id: userId, isArchived: false },
      order: [['updated_at', 'DESC']],
      limit: 100
    });

    const tracked = candidates.filter((job) => job.status !== 'new' || appliedJobIds.has(job.id));
    const toRefresh = tracked.slice(0, TRACKED_JOBS_REFRESH_CAP);

    if (tracked.length > toRefresh.length) {
      console.log(
        `[JobMatchAnalysisService] Skipping match-analysis refresh for ${tracked.length - toRefresh.length} tracked job(s) beyond the ${TRACKED_JOBS_REFRESH_CAP}-job cap for user ${userId}.`
      );
    }

    await Promise.all(toRefresh.map((job) => enqueueJobMatchAnalysis(job.id)));
  } catch (err) {
    console.error(`[JobMatchAnalysisService] Failed to refresh tracked jobs for user ${userId}:`, err);
  }
}
