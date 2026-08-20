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

export function calculateMatchScore(profile, job) {
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
  let locationPoints = 0;
  const jobLocationLower = (job.location || '').toLowerCase();
  
  // Remote preference check
  if (profile.remotePreference === 'remote' && (jobLocationLower.includes('remote') || jobText.toLowerCase().includes('remote'))) {
    locationPoints = 20;
  } else {
    const preferredLocations = (profile.preferredLocations || []).map(l => l.toLowerCase());
    const matchesPref = preferredLocations.some(pref => jobLocationLower.includes(pref));
    if (matchesPref) {
      locationPoints = 20;
    } else if (profile.location && jobLocationLower.includes(profile.location.toLowerCase())) {
      locationPoints = 15;
    }
  }
  score += locationPoints;

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
