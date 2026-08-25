import { ManualSource, APIJobSource, EmailAlertSource, CompanyCareerSource, AdzunaJobSource } from './job-source.service.js';
import { LinkedInEmailJobSource } from './linkedin-email-job-source.js';
import { models } from '../config/database.js';

import { emailService } from './email.service.js';
import { enqueueEnrichment } from './job-ai-enrichment.service.js';

const SOURCES = {
  manual: new ManualSource(),
  api: new APIJobSource(),
  email: new EmailAlertSource(),
  career_page: new CompanyCareerSource(),
  adzuna: new AdzunaJobSource(),
  linkedin_email: new LinkedInEmailJobSource()
};

function getSourceHandler(sourceName) {
  const handler = SOURCES[sourceName] || SOURCES.manual;
  return handler;
}

export function normalizeJob(parsedJob) {
  const normalizedCompany = parsedJob.companyName.toLowerCase().trim().replace(/\s+/g, ' ');
  const normalizedTitle = parsedJob.title.toLowerCase().trim().replace(/\s+/g, ' ');
  const normalizedLocation = parsedJob.location ? parsedJob.location.toLowerCase().trim().replace(/\s+/g, ' ') : 'remote';

  // Remote type derivation
  let remoteType = parsedJob.remoteType || 'onsite';
  if (normalizedLocation.includes('remote') || parsedJob.title.toLowerCase().includes('remote')) {
    remoteType = 'remote';
  } else if (normalizedLocation.includes('hybrid') || parsedJob.title.toLowerCase().includes('hybrid')) {
    remoteType = 'hybrid';
  }

  // Experience level derivation
  let experienceLevel = parsedJob.experienceLevel || 'mid';
  const titleLower = normalizedTitle.toLowerCase();
  const descLower = (parsedJob.description || '').toLowerCase();
  if (titleLower.includes('senior') || titleLower.includes('sr') || descLower.includes('senior level')) {
    experienceLevel = 'senior';
  } else if (titleLower.includes('junior') || titleLower.includes('jr') || titleLower.includes('entry') || descLower.includes('junior level')) {
    experienceLevel = 'junior';
  } else if (titleLower.includes('lead') || titleLower.includes('principal') || titleLower.includes('staff')) {
    experienceLevel = 'lead';
  } else if (titleLower.includes('intern') || titleLower.includes('coop')) {
    experienceLevel = 'intern';
  } else if (titleLower.includes('director') || titleLower.includes('vp') || titleLower.includes('chief') || titleLower.includes('executive')) {
    experienceLevel = 'executive';
  }

  // Employment type derivation
  let employmentType = parsedJob.employmentType || 'full-time';
  if (titleLower.includes('contract') || titleLower.includes('temp') || descLower.includes('contract role')) {
    employmentType = 'contract';
  } else if (titleLower.includes('part-time') || titleLower.includes('part time')) {
    employmentType = 'part-time';
  } else if (titleLower.includes('intern')) {
    employmentType = 'intern';
  }

  return {
    ...parsedJob,
    normalizedCompany,
    normalizedTitle,
    normalizedLocation,
    remoteType,
    experienceLevel,
    employmentType,
    normalizedSkills: parsedJob.normalizedSkills || []
  };
}

export async function ingestJob(userId, rawInput) {
  const sourceName = rawInput.source || 'manual';
  const handler = getSourceHandler(sourceName);

  // 1. Fetch
  const rawJob = await handler.fetch(rawInput);

  // 2. Validate
  handler.validate(rawJob);

  // 3. Parse
  const parsedJob = handler.parse(rawJob);

  // 4. Normalize
  const normalized = normalizeJob(parsedJob);

  // Find or Create Company in table
  let companyId = null;
  if (normalized.companyName) {
    const normName = normalized.companyName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const [compObj] = await models.Company.findOrCreate({
      where: { normalizedName: normName },
      defaults: { name: normalized.companyName }
    });
    companyId = compObj.id;
  }

  // 5. Deduplicate
  let existingJob = null;
  let matchReason = '';

  // Rule A: By source + externalJobId
  if (normalized.source && normalized.externalJobId) {
    existingJob = await models.Job.findOne({
      where: {
        user_id: userId,
        source: normalized.source,
        externalJobId: normalized.externalJobId
      }
    });
    if (existingJob) matchReason = 'External ID Match';
  }

  // Rule B: By canonical sourceUrl
  if (!existingJob && normalized.sourceUrl) {
    existingJob = await models.Job.findOne({
      where: {
        user_id: userId,
        sourceUrl: normalized.sourceUrl
      }
    });
    if (existingJob) matchReason = 'Job URL Match';
  }

  // Rule C: By normalized company + title + location
  if (!existingJob) {
    existingJob = await models.Job.findOne({
      where: {
        user_id: userId,
        normalizedCompany: normalized.normalizedCompany,
        normalizedTitle: normalized.normalizedTitle,
        normalizedLocation: normalized.normalizedLocation
      }
    });
    if (existingJob) matchReason = 'Title/Company/Location Match';
  }

  // Determine target company priority
  const searchProfiles = await models.JobSearchProfile.findAll({
    where: { user_id: userId, isActive: true }
  });
  let isTargetCompany = false;
  const compNameLower = normalized.companyName.toLowerCase().trim();
  for (const p of searchProfiles) {
    if (Array.isArray(p.targetCompanies)) {
      if (p.targetCompanies.some(c => c.toLowerCase().trim() === compNameLower)) {
        isTargetCompany = true;
        break;
      }
    }
  }

  const jobPayload = {
    user_id: userId,
    title: normalized.title,
    description: normalized.description,
    location: normalized.location,
    employmentType: normalized.employmentType,
    experienceMin: normalized.experienceMin || null,
    experienceMax: normalized.experienceMax || null,
    url: normalized.sourceUrl || normalized.url || '',
    source: normalized.source,
    sourceJobId: normalized.externalJobId || normalized.sourceJobId || '',
    postedDate: normalized.postedDate || new Date().toISOString().split('T')[0],
    firstSeenDate: normalized.firstSeenDate || new Date().toISOString().split('T')[0],
    company_id: companyId,
    sourceUrl: normalized.sourceUrl,
    externalJobId: normalized.externalJobId,
    sourceMetadata: normalized.sourceMetadata,
    fetchedAt: normalized.fetchedAt,
    provider: normalized.provider,
    normalizedCompany: normalized.normalizedCompany,
    normalizedTitle: normalized.normalizedTitle,
    normalizedLocation: normalized.normalizedLocation,
    normalizedSkills: normalized.normalizedSkills,
    remoteType: normalized.remoteType,
    experienceLevel: normalized.experienceLevel,
    priority: isTargetCompany ? 'target_company' : 'standard'
  };

  if (existingJob) {
    // Save to deduplication logs
    await models.JobDeduplicationLog.create({
      user_id: userId,
      source: sourceName,
      duplicateText: `${normalized.title} at ${normalized.companyName}`,
      matchedJobId: existingJob.id,
      reason: matchReason || 'Duplicate Ingestion Check',
      loggedAt: new Date()
    });

    // Non-destructive merge
    const updates = {};
    for (const key of Object.keys(jobPayload)) {
      const val = jobPayload[key];
      const existVal = existingJob[key];
      if (val !== undefined && val !== null && val !== '') {
        if (existVal === undefined || existVal === null || existVal === '') {
          updates[key] = val;
        } else if (key === 'sourceMetadata') {
          updates[key] = { ...existVal, ...val };
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      await existingJob.update(updates);
      return { status: 'updated', job: existingJob };
    }
    return { status: 'duplicate', job: existingJob };
  } else {
    const created = await models.Job.create(jobPayload);
    // Reload to obtain matchScore calculated in hooks
    await created.reload();

    // Trigger asynchronous AI enrichment in the background
    enqueueEnrichment(created.id).catch(e => console.error(`[JobIngestionService] Async enrichment trigger failed: ${e.message}`));

    // Check notification rules
    const referralCount = normalized.companyName ? await models.Connection.count({
      where: {
        user_id: userId,
        normalizedCompany: normalized.normalizedCompany
      }
    }) : 0;
    const hasStrongReferral = referralCount >= 1;

    let preferences = await models.UserPreference.findOne({ where: { user_id: userId } });
    if (!preferences) {
      preferences = await models.UserPreference.create({ user_id: userId });
    }

    const score = created.matchScore;
    let shouldNotify = false;

    if (preferences.notificationsEnabled) {
      if (preferences.notifyHighlyRelevant && score >= (preferences.minimumMatchScore || 80)) {
        shouldNotify = true;
      }
      if (preferences.notifyTargetCompany && isTargetCompany) {
        shouldNotify = true;
      }
      if (preferences.notifyStrongReferral && hasStrongReferral) {
        shouldNotify = true;
      }
      if (preferences.notifyLowRelevance && score < 40) {
        shouldNotify = true;
      }
    }

    if (shouldNotify) {
      const whyItMatters = [
        isTargetCompany ? '• Matches your target company list' : '',
        referralCount > 0 ? `• ${referralCount} relevant connections at ${normalized.companyName}` : '',
        score >= (preferences.minimumMatchScore || 80) ? `• Matches your target role (score: ${score})` : ''
      ].filter(Boolean).join('\n');

      // 1. Create In-App Notification
      await models.Notification.create({
        user_id: userId,
        title: `🔥 New CareerGraph Opportunity: ${created.title} at ${normalized.companyName}`,
        message: `Match: ${score}/100\n\nWhy it matters:\n${whyItMatters || '• High matching score'}`,
        isRead: false,
        type: 'job_alert'
      });

      // 2. Send Simulated Email
      try {
        const user = await models.User.findByPk(userId);
        const emailBody = `🔥 New CareerGraph Opportunity\n\n${created.title} — ${normalized.companyName}\nMatch: ${score}/100\n\nWhy it matters:\n${whyItMatters || '• High matching score'}\n\n[View Job]`;
        await emailService.provider.sendEmail(user.email, `🔥 New CareerGraph Opportunity: ${created.title} at ${normalized.companyName}`, emailBody);
      } catch (err) {
        console.error('[IngestJob] Error sending alert email:', err);
      }
    }

    return { status: 'created', job: created };
  }
}

export async function ingestJobsBatch(userId, batchList) {
  const summary = {
    processed: 0,
    created: 0,
    updated: 0,
    duplicate: 0,
    failed: 0,
    results: []
  };

  for (const item of batchList) {
    summary.processed++;
    try {
      const result = await ingestJob(userId, item);
      summary[result.status]++;
      summary.results.push({ success: true, status: result.status, jobId: result.job.id });
    } catch (err) {
      summary.failed++;
      summary.results.push({ success: false, error: err.message, rawInput: item });
    }
  }

  return summary;
}
