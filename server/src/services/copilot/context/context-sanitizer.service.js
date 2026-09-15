/**
 * Sanitizes retrieved database entities to remove sensitive/internal data,
 * enforce text length limits, and attach provenance metadata.
 */

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '... [truncated]';
}

export function sanitizeJob(job) {
  if (!job) return null;
  return {
    source: 'job',
    entityId: job.id,
    title: job.title,
    company: job.company?.name || job.normalizedCompany,
    location: job.location,
    remoteType: job.remoteType,
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    description: truncateText(job.description, 1000),
    matchScore: job.matchScore,
    priority: job.priority,
  };
}

export function sanitizeConnection(connection, limitNotes = true) {
  if (!connection) return null;
  
  const payload = {
    source: 'connection',
    entityId: connection.id,
    name: connection.name,
    company: connection.company,
    title: connection.title,
    location: connection.location,
    seniorityLevel: connection.seniorityLevel,
    roleCategory: connection.roleCategory,
    relationshipStatus: connection.relationshipStatus,
    relationshipStrength: connection.relationshipStrength,
    connectionScore: connection.connectionScore,
    referralScore: connection.referralScore || 0, // might be attached dynamically
    isRelevant: connection.isRelevant, // might be attached dynamically
    reasons: connection.reasons || [],
  };

  if (connection.notes && !limitNotes) {
    payload.notes = truncateText(connection.notes, 500);
  } else if (connection.notes) {
    // Basic sanitization
    payload.notes = truncateText(connection.notes, 250);
  }

  return payload;
}

export function sanitizeApplication(application) {
  if (!application) return null;
  return {
    source: 'application',
    entityId: application.id,
    status: application.status,
    appliedAt: application.appliedAt,
    lastStatusAt: application.lastStatusAt,
    nextFollowUpDate: application.nextFollowUpDate,
  };
}

export function sanitizeResume(resume, profile) {
  return {
    source: 'resume',
    entityId: resume?.id || 'profile',
    skills: profile?.skills || [],
    experience: profile?.experience,
    targetRoles: profile?.targetRoles || [],
    targetCompanies: profile?.targetCompanies || [],
    professionalTitle: profile?.professionalTitle,
    careerLevel: profile?.careerLevel,
  };
}

export function generateProvenance(fact, sourceEntity, field) {
  return {
    fact,
    source: sourceEntity.source,
    entityId: sourceEntity.entityId,
    field
  };
}
