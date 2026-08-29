import { models } from '../config/database.js';

const CAREER_LEVEL_RANK = {
  entry: 1, junior: 1, intern: 1,
  mid: 2, intermediate: 2, 'mid-level': 2,
  senior: 3,
  lead: 4,
  principal: 5, staff: 5,
  director: 6, executive: 6, vp: 6, 'c-level': 6,
};

const SENIORITY_RANK = {
  entry: 1, junior: 1, intern: 1,
  mid: 2, intermediate: 2, 'mid-level': 2,
  senior: 3,
  lead: 4,
  principal: 5, staff: 5,
  director: 6, executive: 6, vp: 6, 'c-level': 6,
};

const RELATIONSHIP_STRENGTH_WEIGHT = { weak: 1, medium: 2, strong: 3 };

function normalizeTerms(values) {
  if (!values) return new Set();
  if (typeof values === 'string') {
    return new Set([values.trim().toLowerCase()]);
  }
  const result = new Set();
  for (const v of values) {
    if (v) {
      result.add(String(v).trim().toLowerCase());
    }
  }
  return result;
}

export function calculateSkillOverlap(jobSkills, resumeSkills) {
  if (!jobSkills || !resumeSkills) return null;
  const jobSet = normalizeTerms(jobSkills);
  const resumeSet = normalizeTerms(resumeSkills);
  if (jobSet.size === 0 || resumeSet.size === 0) return 0.0;
  
  const union = new Set([...jobSet, ...resumeSet]);
  const intersection = new Set([...jobSet].filter(x => resumeSet.has(x)));
  return Number((intersection.size / union.size).toFixed(4));
}

export function calculateDomainOverlap(jobDomains, resumeDomains) {
  if (!jobDomains || !resumeDomains) return null;
  const jobSet = normalizeTerms(jobDomains);
  const resumeSet = normalizeTerms(resumeDomains);
  if (jobSet.size === 0 || resumeSet.size === 0) return 0.0;
  
  const union = new Set([...jobSet, ...resumeSet]);
  const intersection = new Set([...jobSet].filter(x => resumeSet.has(x)));
  return Number((intersection.size / union.size).toFixed(4));
}

export function calculateSemanticSimilarity(jobEmb, jobModel, resumeEmb, resumeModel) {
  if (!jobEmb || !resumeEmb) return null;
  if (!jobModel || jobModel !== resumeModel) return null;
  if (jobEmb.length !== resumeEmb.length || jobEmb.length === 0) return null;
  
  let dot = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < jobEmb.length; i++) {
    dot += jobEmb[i] * resumeEmb[i];
    normA += jobEmb[i] * jobEmb[i];
    normB += resumeEmb[i] * resumeEmb[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0.0) return null;
  return Number((dot / denom).toFixed(4));
}

export function calculateExperienceCompatibility(resumeCareerLevel, jobSeniority) {
  if (!resumeCareerLevel || !jobSeniority) return null;
  const resumeRank = CAREER_LEVEL_RANK[String(resumeCareerLevel).trim().toLowerCase()];
  const jobRank = SENIORITY_RANK[String(jobSeniority).trim().toLowerCase()];
  if (resumeRank === undefined || jobRank === undefined) return null;
  const distance = Math.abs(resumeRank - jobRank);
  return Number(Math.max(0.0, 1.0 - distance * 0.25).toFixed(4));
}

export function calculateCompanyRelationship(connections) {
  if (!connections) return null;
  return connections.length > 0 ? 1.0 : 0.0;
}

export function calculateConnectionRelevance(connections) {
  if (!connections) return null;
  if (connections.length === 0) return 0.0;
  const countScore = Math.min(connections.length, 5) / 5.0;
  
  let maxWeight = 0;
  for (const c of connections) {
    const strength = String(c.relationshipStrength || '').trim().toLowerCase();
    const weight = RELATIONSHIP_STRENGTH_WEIGHT[strength] || 0;
    if (weight > maxWeight) maxWeight = weight;
  }
  const strengthScore = maxWeight / 3.0;
  return Number((countScore * 0.6 + strengthScore * 0.4).toFixed(4));
}

export async function buildInferenceFeatures(jobId, resumeId, userId) {
  // 1. Load job and enrichment
  const job = await models.Job.findByPk(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  const jobEnrichment = await models.JobAiEnrichment.findOne({ where: { jobId } });
  
  // 2. Load active resume and enrichment
  const activeResume = await models.Resume.findByPk(resumeId);
  if (!activeResume) throw new Error(`Resume ${resumeId} not found`);
  const resumeEnrichment = await models.ResumeAiEnrichment.findOne({ where: { resumeId } });

  // 3. Fetch connections for user at this job company
  let connectionsAtCompany = null;
  if (userId && job.normalizedCompany) {
    const connections = await models.Connection.findAll({
      where: { user_id: userId }
    });
    connectionsAtCompany = connections.filter(
      c => String(c.normalizedCompany || '').trim().toLowerCase() === String(job.normalizedCompany).trim().toLowerCase()
    );
  }

  // 4. Fetch embeddings from DB for job and resume
  const jobEmbRow = await models.SemanticEmbedding.findOne({
    where: { entityType: 'job', entityId: jobId },
    order: [['updatedAt', 'DESC']]
  });
  const resumeEmbRow = await models.SemanticEmbedding.findOne({
    where: { entityType: 'resume', entityId: resumeId },
    order: [['updatedAt', 'DESC']]
  });

  // Combine skills for job
  const jobSkills = [
    ...(jobEnrichment?.requiredSkills || []),
    ...(jobEnrichment?.preferredSkills || [])
  ];
  const hasJobSkills = jobEnrichment && (jobEnrichment.requiredSkills || jobEnrichment.preferredSkills);

  const features = {
    skill_overlap: calculateSkillOverlap(hasJobSkills ? jobSkills : null, resumeEnrichment?.skills),
    domain_overlap: calculateDomainOverlap(jobEnrichment?.domain, resumeEnrichment?.technicalDomains),
    semantic_similarity: calculateSemanticSimilarity(
      jobEmbRow?.embedding, jobEmbRow?.embeddingModel,
      resumeEmbRow?.embedding, resumeEmbRow?.embeddingModel
    ),
    experience_compatibility: calculateExperienceCompatibility(
      resumeEnrichment?.careerLevel,
      jobEnrichment?.seniority
    ),
    has_company_connection: calculateCompanyRelationship(connectionsAtCompany),
    connection_relevance: calculateConnectionRelevance(connectionsAtCompany),
    
    // categorical
    job_role_category: jobEnrichment?.roleCategory || null,
    job_seniority: jobEnrichment?.seniority || null,
    job_employment_type: job.employmentType || null,
    job_remote_type: job.remoteType || null,
    resume_career_level: resumeEnrichment?.careerLevel || null
  };

  return features;
}
