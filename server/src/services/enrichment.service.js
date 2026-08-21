export function normalizeCompany(company) {
  if (!company) return null;
  let cleaned = company.trim()
    .replace(/\s+(?:inc|llc|ltd|corp|co|gmbh)\b\.?/gi, '')
    .replace(/\s+/g, ' ');
  if (!cleaned) return null;
  return cleaned.split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function normalizePosition(position) {
  if (!position) return null;
  let cleaned = position.replace(/[.,]/g, ' ').trim().toLowerCase().replace(/\s+/g, ' ');
  const words = cleaned.split(' ').map(w => {
    switch (w) {
      case 'sr': return 'senior';
      case 'jr': return 'junior';
      case 'mgr': return 'manager';
      case 'vp': return 'vice president';
      case 'dir': return 'director';
      case 'eng': return 'engineer';
      default: return w;
    }
  });
  cleaned = words.join(' ');
  return cleaned.split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function classifySeniority(position) {
  if (!position) return 'unknown';
  const norm = position.toLowerCase().replace(/[.,/]/g, ' ');
  const words = norm.split(/\s+/);
  
  if (words.includes('intern') || words.includes('internship')) return 'intern';
  if (words.includes('trainee') || words.includes('apprentice')) return 'trainee';
  if (words.includes('junior') || words.includes('jr')) return 'junior';
  if (words.includes('vp') || words.includes('president') || words.includes('cfo') || words.includes('cto') || words.includes('ceo') || words.includes('coo') || words.includes('cmo') || words.includes('executive') || norm.includes('vice president')) return 'executive';
  if (words.includes('founder') || words.includes('co-founder') || words.includes('creator') || words.includes('partner')) return 'founder';
  if (words.includes('director') || words.includes('dir')) return 'director';
  if (words.includes('manager') || words.includes('mgr')) return 'manager';
  if (words.includes('lead') || words.includes('principal') || words.includes('chief') || words.includes('head')) return 'lead';
  if (words.includes('senior') || words.includes('sr')) return 'senior';
  if (words.includes('entry') || words.includes('graduate') || words.includes('associate')) return 'entry';
  
  return 'mid';
}

export function classifyRoleCategory(position) {
  if (!position) return 'unknown';
  const norm = position.toLowerCase().replace(/[.,/]/g, ' ');
  const words = norm.split(/\s+/);

  if (words.includes('ml') || words.includes('ai') || norm.includes('machine learning') || norm.includes('artificial intelligence') || norm.includes('data scientist') || norm.includes('nlp') || norm.includes('deep learning')) return 'ml_ai';
  if (words.includes('devops') || words.includes('cloud') || words.includes('aws') || words.includes('azure') || words.includes('gcp') || words.includes('kubernetes') || words.includes('sre') || norm.includes('infrastructure') || words.includes('sysadmin')) return 'devops_cloud';
  if (words.includes('security') || words.includes('cyber') || norm.includes('cybersecurity') || words.includes('infosec')) return 'security';
  if (words.includes('frontend') || norm.includes('front-end') || words.includes('react') || words.includes('vue') || words.includes('angular') || norm.includes('ui engineer') || norm.includes('ui developer')) return 'frontend';
  if (words.includes('backend') || norm.includes('back-end') || words.includes('node') || words.includes('java') || words.includes('python') || norm.includes('go developer') || words.includes('django') || words.includes('ruby') || words.includes('rails') || words.includes('spring')) return 'backend';
  if (words.includes('fullstack') || norm.includes('full-stack') || norm.includes('full stack')) return 'fullstack';
  if (words.includes('mobile') || words.includes('ios') || words.includes('android') || words.includes('swift') || words.includes('kotlin') || words.includes('flutter') || norm.includes('react native')) return 'mobile';
  if (norm.includes('product manager') || words.includes('pm') || norm.includes('product owner')) return 'product';
  if (words.includes('designer') || words.includes('design') || words.includes('ux') || norm.includes('ui designer')) return 'design';
  if (words.includes('sales') || norm.includes('account executive') || words.includes('ae') || words.includes('bd') || norm.includes('business development')) return 'sales';
  if (words.includes('marketing') || words.includes('growth') || words.includes('seo')) return 'marketing';
  if (words.includes('finance') || words.includes('financial') || words.includes('accountant')) return 'finance';
  if (words.includes('hr') || norm.includes('human resources') || words.includes('recruiter') || words.includes('talent') || words.includes('hiring') || norm.includes('people ops')) return 'hr_recruiting';
  if (words.includes('operations') || words.includes('ops') || words.includes('support') || norm.includes('customer success')) return 'operations';
  if (words.includes('ceo') || words.includes('cto') || words.includes('cfo') || words.includes('coo') || words.includes('vp') || words.includes('president') || words.includes('executive')) return 'executive';
  if (words.includes('teacher') || words.includes('professor') || words.includes('educator') || words.includes('trainer') || words.includes('student')) return 'education';
  if (words.includes('engineer') || words.includes('developer') || words.includes('programmer') || words.includes('architect') || words.includes('coder') || words.includes('technical')) return 'engineering';

  return 'other';
}

export function calculateProfileCompleteness(connection) {
  if (!connection) return 0;
  let presentCount = 0;
  
  if (connection.name) presentCount++;
  if (connection.company) presentCount++;
  if (connection.title) presentCount++;
  if (connection.location) presentCount++;
  if (connection.email) presentCount++;
  if (connection.profileUrl) presentCount++;
  if (connection.connectedDate) presentCount++;
  if (connection.industry) presentCount++;
  if (connection.notes) presentCount++;
  if (connection.relationshipStatus) presentCount++;
  if (connection.relationshipStrength) presentCount++;
  if (connection.lastContactedDate || connection.nextFollowUpDate) presentCount++;

  return Math.round((presentCount / 12) * 100);
}

export function calculateConnectionScore(completeness, relationshipStrength, seniorityLevel) {
  const completenessPts = (completeness || 0) * 0.3;

  let relationshipPts = 0;
  const strength = (relationshipStrength || '').toLowerCase();
  if (['strong', '5', 'high'].includes(strength)) relationshipPts = 40;
  else if (['medium', '3', 'average'].includes(strength)) relationshipPts = 25;
  else if (['weak', '1', 'low'].includes(strength)) relationshipPts = 10;

  let seniorityPts = 0;
  const seniority = (seniorityLevel || '').toLowerCase();
  if (['executive', 'founder', 'director'].includes(seniority)) seniorityPts = 30;
  else if (['manager', 'lead'].includes(seniority)) seniorityPts = 25;
  else if (seniority === 'senior') seniorityPts = 20;
  else if (seniority === 'mid') seniorityPts = 15;
  else if (['junior', 'entry'].includes(seniority)) seniorityPts = 10;
  else if (['intern', 'trainee'].includes(seniority)) seniorityPts = 5;

  return Math.round(Math.max(0, Math.min(100, completenessPts + relationshipPts + seniorityPts)));
}

export function determinePriority(seniorityLevel, relationshipStrength) {
  const seniority = (seniorityLevel || '').toLowerCase();
  const strength = (relationshipStrength || '').toLowerCase();

  const isHighSeniority = ['executive', 'founder', 'director', 'manager', 'lead'].includes(seniority);
  const isHighStrength = ['strong', '5', 'high', 'medium', '3', 'average'].includes(strength);

  if (isHighSeniority && isHighStrength) return 'high';
  if (['senior', 'mid'].includes(seniority) || isHighStrength) return 'medium';
  return 'low';
}

export function enrichConnectionData(connection) {
  const title = connection.title || '';
  
  connection.normalizedCompany = normalizeCompany(connection.company);
  connection.normalizedPosition = normalizePosition(title);
  connection.seniorityLevel = classifySeniority(title);
  connection.roleCategory = classifyRoleCategory(title);
  connection.profileCompleteness = calculateProfileCompleteness(connection);
  connection.connectionScore = calculateConnectionScore(
    connection.profileCompleteness,
    connection.relationshipStrength,
    connection.seniorityLevel
  );
  if (!connection.priority) {
    connection.priority = determinePriority(connection.seniorityLevel, connection.relationshipStrength);
  }
  connection.lastEnrichedAt = new Date();
}
