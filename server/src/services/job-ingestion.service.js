import { ManualSource, APIJobSource, EmailAlertSource, CompanyCareerSource, AdzunaJobSource } from './job-source.service.js';
import { models } from '../config/database.js';
import { Op } from 'sequelize';

const SOURCES = {
  manual: new ManualSource(),
  api: new APIJobSource(),
  email: new EmailAlertSource(),
  career_page: new CompanyCareerSource(),
  adzuna: new AdzunaJobSource()
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

  // Rule A: By source + externalJobId
  if (normalized.source && normalized.externalJobId) {
    existingJob = await models.Job.findOne({
      where: {
        user_id: userId,
        source: normalized.source,
        externalJobId: normalized.externalJobId
      }
    });
  }

  // Rule B: By canonical sourceUrl
  if (!existingJob && normalized.sourceUrl) {
    existingJob = await models.Job.findOne({
      where: {
        user_id: userId,
        sourceUrl: normalized.sourceUrl
      }
    });
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
    experienceLevel: normalized.experienceLevel
  };

  if (existingJob) {
    // Non-destructive merge
    const updates = {};
    for (const key of Object.keys(jobPayload)) {
      const val = jobPayload[key];
      const existVal = existingJob[key];
      if (val !== undefined && val !== null && val !== '') {
        // Only update if existing is empty or if it's metadata we want to merge
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
