import { canonicalizeSkillList } from '../lib/skills-taxonomy.js';
import { estimateYearsOfExperience } from '../lib/experience.util.js';
import { calculateDomainOverlap, calculateExperienceCompatibility } from './ml-feature-builder.js';

const COMMON_SKILLS = [
  'javascript', 'python', 'react', 'node.js', 'node', 'express', 'sql', 'postgresql',
  'postgres', 'mongodb', 'docker', 'git', 'html', 'css', 'typescript', 'java', 'aws',
  'kubernetes', 'c++', 'c#', 'rust', 'go', 'ruby', 'rails', 'php', 'vue', 'angular',
  'django', 'flask', 'fastapi', 'spring', 'cloud', 'ci/cd', 'testing', 'jest', 'mocha',
  'cypress'
];

export function extractSkillsFromText(text) {
  if (!text) return [];
  const normalized = text.toLowerCase();
  return COMMON_SKILLS.filter(skill => {
    // Exact word boundary checks where appropriate
    const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(normalized);
  });
}

// Max 20. Shared by the legacy and resume-driven scorers so location/remote
// scoring stays identical between them.
function calculateLocationPoints(profile, job) {
  const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  const jobLocationLower = (job.location || '').toLowerCase();

  if (profile.remotePreference === 'remote' && (jobLocationLower.includes('remote') || jobText.includes('remote'))) {
    return 20;
  }

  const preferredLocations = (profile.preferredLocations || []).map(l => l.toLowerCase());
  const matchesPref = preferredLocations.some(pref => jobLocationLower.includes(pref));
  if (matchesPref) return 20;
  if (profile.location && jobLocationLower.includes(profile.location.toLowerCase())) return 15;
  return 0;
}

function calculateLegacyMatchScore(profile, job) {
  if (!profile) return 0;

  let score = 0;
  const profileSkills = (profile.skills || []).map(s => s.toLowerCase());

  // 1. Skills Matching (Max 40)
  const jobText = `${job.title || ''} ${job.description || ''}`;
  const jobRequiredSkills = extractSkillsFromText(jobText);

  if (jobRequiredSkills.length > 0) {
    const matched = profileSkills.filter(s => jobRequiredSkills.includes(s));
    const skillRatio = matched.length / jobRequiredSkills.length;
    score += Math.min(skillRatio * 40, 40);
  } else {
    // If no required skills extracted, check if user's skills are in text generally
    const matched = profileSkills.filter(s => jobText.toLowerCase().includes(s));
    if (matched.length > 0) {
      score += 25;
    }
  }

  // 2. Title Matching (Max 30)
  const targetRoles = (profile.targetRoles || []).map(r => r.toLowerCase());
  const jobTitleLower = (job.title || '').toLowerCase();
  const titleMatch = targetRoles.some(role => jobTitleLower.includes(role) || role.includes(jobTitleLower));
  if (titleMatch) {
    score += 30;
  }

  // 3. Location & Remote Matching (Max 20)
  score += calculateLocationPoints(profile, job);

  // 4. Experience Matching (Max 10)
  let expPoints = 10;
  if (job.experienceMin !== undefined && job.experienceMin !== null && profile.experience) {
    const years = parseInt(profile.experience, 10);
    if (!isNaN(years)) {
      if (years < job.experienceMin) {
        expPoints = 5;
      }
      if (job.experienceMax !== undefined && job.experienceMax !== null && years > job.experienceMax) {
        expPoints = 8; // overqualified
      }
    }
  }
  score += expPoints;

  return Math.round(Math.max(0, Math.min(100, score)));
}

// Resume-aware scorer: reads ResumeAiEnrichment (skills/experience/projects/
// certifications) and JobAiEnrichment (required/preferred skills/domain/
// seniority) instead of just Profile + a hardcoded skill list. Each bucket's
// weight is redistributed to a related bucket when its input is unavailable,
// so partial enrichment data still produces a sensible 0-100 score.
function calculateResumeDrivenMatchScore(profile, job, resumeEnrichment, jobEnrichment) {
  const resumeSkillsRaw = resumeEnrichment.userCorrectedSkills || resumeEnrichment.canonicalSkills || resumeEnrichment.skills || [];
  const resumeSkillSet = new Set(
    canonicalizeSkillList([...(profile?.skills || []), ...resumeSkillsRaw]).map(s => s.toLowerCase()),
  );
  const projectTechs = (resumeEnrichment.projects || []).flatMap((p) => p?.technologies || []);
  const projectSkillSet = new Set(canonicalizeSkillList(projectTechs).map(s => s.toLowerCase()));

  const requiredSkills = jobEnrichment?.requiredSkills;
  const preferredSkills = jobEnrichment?.preferredSkills;
  const effectiveRequired = (requiredSkills && requiredSkills.length > 0)
    ? requiredSkills
    : extractSkillsFromText(`${job.title || ''} ${job.description || ''}`);
  const canonRequired = canonicalizeSkillList(effectiveRequired).map(s => s.toLowerCase());

  let score = 0;

  // Required-skills overlap: 30, or 40 if there's no preferred-skills list to score separately.
  const hasPreferred = preferredSkills && preferredSkills.length > 0;
  const requiredMax = hasPreferred ? 30 : 40;
  if (canonRequired.length > 0) {
    const matched = canonRequired.filter((s) => resumeSkillSet.has(s));
    score += (matched.length / canonRequired.length) * requiredMax;
  }

  // Preferred-skills overlap: 10, 0 if unavailable.
  if (hasPreferred) {
    const canonPreferred = canonicalizeSkillList(preferredSkills).map(s => s.toLowerCase());
    const matched = canonPreferred.filter((s) => resumeSkillSet.has(s));
    score += (matched.length / canonPreferred.length) * 10;
  }

  // Technical-domain overlap: 10, absorbed into location/remote when unavailable.
  const domainOverlap = calculateDomainOverlap(jobEnrichment?.domain, resumeEnrichment.technicalDomains);
  let locationMax = 10;
  if (domainOverlap !== null) {
    score += domainOverlap * 10;
  } else {
    locationMax = 20;
  }

  // Title match: 15 (unchanged legacy logic, reduced weight).
  const targetRoles = (profile?.targetRoles || []).map((r) => r.toLowerCase());
  const jobTitleLower = (job.title || '').toLowerCase();
  const titleMatch = targetRoles.some((role) => jobTitleLower.includes(role) || role.includes(jobTitleLower));
  if (titleMatch) score += 15;

  // Seniority + years compatibility: 15 (60% rank-distance, 40% numeric years vs range).
  const experienceCompat = calculateExperienceCompatibility(resumeEnrichment.careerLevel, jobEnrichment?.seniority);
  const totalYears = resumeEnrichment.totalExperienceYears ?? estimateYearsOfExperience(resumeEnrichment.experience || []);
  let yearsRatio = null;
  if (totalYears !== null && totalYears !== undefined && job.experienceMin !== undefined && job.experienceMin !== null) {
    if (totalYears < job.experienceMin) {
      yearsRatio = 0.5;
    } else if (job.experienceMax !== undefined && job.experienceMax !== null && totalYears > job.experienceMax) {
      yearsRatio = 0.8; // overqualified
    } else {
      yearsRatio = 1.0;
    }
  }
  if (experienceCompat !== null && yearsRatio !== null) {
    score += (experienceCompat * 0.6 + yearsRatio * 0.4) * 15;
  } else if (experienceCompat !== null) {
    score += experienceCompat * 15;
  } else if (yearsRatio !== null) {
    score += yearsRatio * 15;
  }

  // Location/remote: 10, or 20 if domain overlap was unavailable.
  score += calculateLocationPoints(profile || {}, job) * (locationMax / 20);

  // Projects-technologies signal: 5 — credit a required skill actually demonstrated in a project.
  if (canonRequired.length > 0 && projectSkillSet.size > 0) {
    const demonstrated = canonRequired.filter((s) => projectSkillSet.has(s));
    score += (demonstrated.length / canonRequired.length) * 5;
  }

  // Certifications-relevance signal: 5 — token overlap between cert names and job title/domain/requiredSkills.
  const certifications = resumeEnrichment.certifications || [];
  if (certifications.length > 0) {
    const jobTokenText = [
      job.title || '',
      ...(jobEnrichment?.domain || []),
      ...(effectiveRequired || []),
    ].join(' ').toLowerCase();
    const jobTokens = new Set(jobTokenText.split(/[^a-z0-9+.#]+/).filter(Boolean));
    const relevant = certifications.filter((cert) => {
      const name = typeof cert === 'string' ? cert : cert?.name || '';
      const tokens = name.toLowerCase().split(/[^a-z0-9+.#]+/).filter(Boolean);
      return tokens.some((t) => jobTokens.has(t));
    });
    if (relevant.length > 0) {
      score += Math.min(relevant.length / certifications.length, 1) * 5;
    }
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * @param {object} profile
 * @param {object} job
 * @param {{resumeEnrichment?: object, jobEnrichment?: object}} [options] - when
 *   `resumeEnrichment` is a completed ResumeAiEnrichment, scoring is driven by
 *   resume/job enrichment data (skills/experience/projects/certifications);
 *   otherwise this falls back to the legacy Profile-only algorithm unchanged.
 */
export function calculateMatchScore(profile, job, options = {}) {
  const { resumeEnrichment = null, jobEnrichment = null } = options;
  if (resumeEnrichment && resumeEnrichment.status === 'completed') {
    return calculateResumeDrivenMatchScore(profile, job, resumeEnrichment, jobEnrichment);
  }
  return calculateLegacyMatchScore(profile, job);
}

/**
 * Returns { matchedSkills, missingSkills } for the "why this score" chips.
 * Uses canonicalized resume/job skills when a completed resume enrichment is
 * available (consistent with calculateResumeDrivenMatchScore); otherwise
 * falls back to the legacy hardcoded-list-vs-profile-skills comparison.
 */
export function computeSkillGapAnalysis(profile, job, resumeEnrichment, jobEnrichment) {
  if (resumeEnrichment && resumeEnrichment.status === 'completed') {
    const resumeSkillsRaw = resumeEnrichment.userCorrectedSkills || resumeEnrichment.canonicalSkills || resumeEnrichment.skills || [];
    const resumeSkillSet = new Set(canonicalizeSkillList(resumeSkillsRaw).map(s => s.toLowerCase()));
    const requiredSkills = (jobEnrichment?.requiredSkills && jobEnrichment.requiredSkills.length > 0)
      ? jobEnrichment.requiredSkills
      : extractSkillsFromText(`${job.title || ''} ${job.description || ''}`);
    const canonRequired = canonicalizeSkillList(requiredSkills);
    return {
      matchedSkills: canonRequired.filter((s) => resumeSkillSet.has(s.toLowerCase())),
      missingSkills: canonRequired.filter((s) => !resumeSkillSet.has(s.toLowerCase())),
    };
  }

  const jobText = `${job.title || ''} ${job.description || ''}`;
  const jobSkills = extractSkillsFromText(jobText);
  const profileSkills = (profile?.skills || []).map((s) => s.toLowerCase());
  return {
    matchedSkills: jobSkills.filter((s) => profileSkills.includes(s)),
    missingSkills: jobSkills.filter((s) => !profileSkills.includes(s)),
  };
}

export function calculateReferralScore(connection, job) {
  if (!connection || !job) return 0;
  let score = 0;

  // 1. Company Match (Max 50)
  const connCompany = (connection.company || '').toLowerCase().trim();
  const jobCompany = (job.company?.name || '').toLowerCase().trim();
  
  if (connCompany && jobCompany && (connCompany.includes(jobCompany) || jobCompany.includes(connCompany))) {
    score += 50;
  } else {
    return 0; // If they don't work at the company, referral score is 0
  }

  // 2. Relationship Strength (Max 30)
  const relStrength = (connection.relationshipStrength || '').toLowerCase();
  if (['strong', '5', 'high'].includes(relStrength)) {
    score += 30;
  } else if (['medium', '3', 'average'].includes(relStrength)) {
    score += 15;
  } else if (['weak', '1', 'low'].includes(relStrength)) {
    score += 5;
  }

  // 3. Title Alignment (Max 20)
  const connTitle = (connection.title || '').toLowerCase();
  const jobTitle = (job.title || '').toLowerCase();
  
  const engineeringKeywords = ['engineer', 'developer', 'programmer', 'tech', 'software'];
  const recruitingKeywords = ['recruiter', 'hr', 'talent', 'hiring', 'people'];
  
  const isEngineeringMatch = engineeringKeywords.some(kw => connTitle.includes(kw)) && engineeringKeywords.some(kw => jobTitle.includes(kw));
  const isRecruiter = recruitingKeywords.some(kw => connTitle.includes(kw));

  if (isEngineeringMatch || isRecruiter) {
    score += 20;
  } else {
    score += 10;
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

export function calculateOpportunityScore(matchScore, maxReferralScore) {
  if (maxReferralScore > 0) {
    return Math.round((matchScore * 0.6) + (maxReferralScore * 0.4));
  }
  return Math.round(matchScore * 0.6);
}

export function determineActionRecommendation(matchScore, bestConnection) {
  if (bestConnection && bestConnection.referralScore >= 50) {
    return `Request a referral from ${bestConnection.name} (${bestConnection.title || 'Connection'})`;
  }
  if (matchScore >= 70) {
    return 'Apply directly via the job link';
  }
  if (bestConnection) {
    return `Strengthen connection with ${bestConnection.name} at the company`;
  }
  return 'Build new connections at the target company or add missing skills to your profile';
}
