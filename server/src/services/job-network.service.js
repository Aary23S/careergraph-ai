import { models } from '../config/database.js';
import { AppError } from '../lib/http.js';
import { calculateReferralScore } from './intelligence.service.js';

export async function getJobNetworkDetails(userId, jobId, queryParams = {}) {
  // 1. Fetch Job and ensure user ownership
  const job = await models.Job.findOne({
    where: { id: jobId, user_id: userId },
    include: [{ model: models.Company, as: 'company' }]
  });

  if (!job) {
    throw new AppError(404, 'NOT_FOUND', 'Job not found.');
  }

  // Define default summary payload if job has no associated company
  const emptySummary = {
    totalConnections: 0,
    relevantConnections: 0,
    highPotential: 0,
    recruiters: 0,
    seniorPlus: 0,
    notContacted: 0,
    alreadyContacted: 0
  };

  if (!job.company) {
    return {
      job: { id: job.id, title: job.title, company: null },
      summary: emptySummary,
      candidates: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 0 }
    };
  }

  // 2. Query all connections belonging to the user at the target company
  const connections = await models.Connection.findAll({
    where: {
      user_id: userId,
      normalizedCompany: job.company.normalizedName
    }
  });

  // Keywords used to determine relevance
  const engineeringKeywords = ['engineer', 'developer', 'programmer', 'tech', 'software'];
  const recruitingKeywords = ['recruiter', 'hr', 'talent', 'hiring', 'people', 'talent acquisition'];
  const managementKeywords = ['manager', 'director', 'vp', 'president', 'executive', 'founder', 'lead', 'head', 'chief'];

  const jobTitleLower = (job.title || '').toLowerCase();

  // 3. Map candidates, calculate referral scores and descriptive reasons
  let candidates = connections.map(conn => {
    const connTitleLower = (conn.title || '').toLowerCase();
    const connSeniority = (conn.seniorityLevel || '').toLowerCase();
    const relStrength = (conn.relationshipStrength || '').toLowerCase();

    // Determine relevance matches
    const isEngineeringMatch = engineeringKeywords.some(kw => connTitleLower.includes(kw)) && engineeringKeywords.some(kw => jobTitleLower.includes(kw));
    const isRecruiter = recruitingKeywords.some(kw => connTitleLower.includes(kw));
    const isManager = managementKeywords.some(kw => connTitleLower.includes(kw));

    const isRelevant = isEngineeringMatch || isRecruiter;
    const isSeniorPlus = ['senior', 'lead', 'manager', 'director', 'executive', 'founder'].includes(connSeniority) ||
                         managementKeywords.some(kw => connTitleLower.includes(kw));

    const refScore = calculateReferralScore(conn, job);

    // Build explaining reasons
    const reasons = ['Works at the target company'];
    if (isEngineeringMatch) reasons.push('Relevant role match');
    if (isRecruiter) reasons.push('Recruiting contact at target company');
    if (isManager) reasons.push('Management or leadership alignment');
    if (isSeniorPlus && !isManager) reasons.push('Senior-level title alignment');

    if (['strong', 'high', '5'].includes(relStrength)) {
      reasons.push('Strong relationship');
    } else if (['medium', 'warm', '3'].includes(relStrength)) {
      reasons.push('Warm relationship');
    }

    return {
      connection: {
        id: conn.id,
        name: conn.name,
        company: conn.company,
        title: conn.title,
        email: conn.email,
        location: conn.location
      },
      referralScore: refScore,
      reasons,
      relationshipStatus: conn.relationshipStatus || 'not_contacted',
      relationshipStrength: conn.relationshipStrength || 'weak',
      priority: conn.priority || 'none',
      seniorityLevel: conn.seniorityLevel || 'unknown',
      lastContactedDate: conn.lastContactedDate || null,
      isRelevant,
      isRecruiter,
      isManager,
      isSeniorPlus
    };
  });

  // 4. Calculate summary metrics (based on ALL matching connections)
  const summary = {
    totalConnections: candidates.length,
    relevantConnections: candidates.filter(c => c.isRelevant).length,
    highPotential: candidates.filter(c => c.referralScore >= 70).length,
    recruiters: candidates.filter(c => c.isRecruiter).length,
    seniorPlus: candidates.filter(c => c.isSeniorPlus).length,
    notContacted: candidates.filter(c => c.relationshipStatus === 'not_contacted').length,
    alreadyContacted: candidates.filter(c => c.relationshipStatus !== 'not_contacted').length
  };

  // 5. Apply advanced filtering query parameters
  if (queryParams.roleCategory) {
    const cats = Array.isArray(queryParams.roleCategory) ? queryParams.roleCategory : queryParams.roleCategory.split(',');
    candidates = candidates.filter(c => cats.includes(c.isRelevant ? 'engineering' : 'other'));
  }
  if (queryParams.seniority) {
    const sens = Array.isArray(queryParams.seniority) ? queryParams.seniority : queryParams.seniority.split(',');
    candidates = candidates.filter(c => sens.includes(c.seniorityLevel));
  }
  if (queryParams.relationshipStatus) {
    const statuses = Array.isArray(queryParams.relationshipStatus) ? queryParams.relationshipStatus : queryParams.relationshipStatus.split(',');
    candidates = candidates.filter(c => statuses.includes(c.relationshipStatus));
  }
  if (queryParams.relationshipStrength) {
    const strengths = Array.isArray(queryParams.relationshipStrength) ? queryParams.relationshipStrength : queryParams.relationshipStrength.split(',');
    candidates = candidates.filter(c => strengths.includes(c.relationshipStrength));
  }
  if (queryParams.priority) {
    const prios = Array.isArray(queryParams.priority) ? queryParams.priority : queryParams.priority.split(',');
    candidates = candidates.filter(c => prios.includes(c.priority));
  }
  if (queryParams.isRecruiter === 'true') {
    candidates = candidates.filter(c => c.isRecruiter);
  }
  if (queryParams.isManager === 'true') {
    candidates = candidates.filter(c => c.isManager);
  }
  if (queryParams.isSeniorPlus === 'true') {
    candidates = candidates.filter(c => c.isSeniorPlus);
  }

  // 6. Apply sorting options
  const sortBy = queryParams.sortBy || 'referralScore';
  const sortOrder = queryParams.sortOrder || 'desc';

  candidates.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'referralScore') {
      comparison = a.referralScore - b.referralScore;
    } else if (sortBy === 'connectionScore') {
      // fallback to referralScore if no connectionScore exists
      comparison = a.referralScore - b.referralScore;
    } else if (sortBy === 'seniority') {
      const seniorityWeight = { founder: 6, executive: 5, director: 4, manager: 3, lead: 2, senior: 1, mid: 0, junior: -1, intern: -2, unknown: -3 };
      comparison = (seniorityWeight[a.seniorityLevel] || 0) - (seniorityWeight[b.seniorityLevel] || 0);
    } else if (sortBy === 'relationshipStrength') {
      const strengthWeight = { strong: 3, medium: 2, warm: 2, weak: 1, low: 1 };
      comparison = (strengthWeight[a.relationshipStrength] || 0) - (strengthWeight[b.relationshipStrength] || 0);
    } else if (sortBy === 'lastContactedDate') {
      const dateA = a.lastContactedDate ? new Date(a.lastContactedDate).getTime() : 0;
      const dateB = b.lastContactedDate ? new Date(b.lastContactedDate).getTime() : 0;
      comparison = dateA - dateB;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // 7. Paginate results
  const page = parseInt(queryParams.page, 10) || 1;
  const limit = parseInt(queryParams.limit, 10) || 25;
  const total = candidates.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  const paginatedCandidates = candidates.slice(offset, offset + limit).map(c => ({
    connection: c.connection,
    referralScore: c.referralScore,
    reasons: c.reasons,
    relationshipStatus: c.relationshipStatus,
    priority: c.priority
  }));

  return {
    job: {
      id: job.id,
      title: job.title,
      company: job.company?.name || null
    },
    summary,
    candidates: paginatedCandidates,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  };
}
