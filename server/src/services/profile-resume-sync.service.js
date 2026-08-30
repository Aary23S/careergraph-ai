import { models } from '../config/database.js';
import {
  mergeStringListCaseInsensitive,
  mergeStructuredListByKey,
  educationSignature,
  certificationSignature,
} from '../lib/profile-merge.util.js';
import { estimateYearsOfExperience } from '../lib/experience.util.js';

// Only overwrites a Profile scalar field when it's currently empty, or still
// equal to what the last auto-sync wrote there — never when the user has
// manually edited it since. This keeps auto-sync non-destructive without
// requiring a full edit-history log.
function applyScalarIfUnclaimed(field, candidateValue, profile, syncMeta, updates, newSyncMeta) {
  if (candidateValue === null || candidateValue === undefined || candidateValue === '') return;
  const current = profile[field];
  const isEmpty = current === null || current === undefined || current === '';
  const unchangedSinceSync = Object.prototype.hasOwnProperty.call(syncMeta, field)
    && String(current) === String(syncMeta[field]);
  if (isEmpty || unchangedSinceSync) {
    updates[field] = candidateValue;
    newSyncMeta[field] = candidateValue;
  }
}

export async function syncProfileFromResumeEnrichment(userId, enrichment) {
  if (!enrichment || enrichment.status !== 'completed') return null;

  const profile = await models.Profile.findOne({ where: { user_id: userId } });
  if (!profile) return null;

  const syncMeta = profile.resumeSyncMeta || {};
  const newSyncMeta = { ...syncMeta };
  const updates = {};

  const resumeSkills = enrichment.userCorrectedSkills || enrichment.canonicalSkills || enrichment.skills || [];
  updates.skills = mergeStringListCaseInsensitive(profile.skills, resumeSkills);

  const title = enrichment.userCorrectedProfessionalTitle || enrichment.professionalTitle || null;
  if (title) {
    updates.targetRoles = mergeStringListCaseInsensitive(profile.targetRoles, [title]);
  }

  updates.education = mergeStructuredListByKey(profile.education, enrichment.education || [], educationSignature);
  updates.certifications = mergeStructuredListByKey(
    profile.certifications,
    enrichment.certifications || [],
    certificationSignature,
  );

  const contactInfo = enrichment.contactInfo || {};
  const mergedLinks = { ...(profile.links || {}) };
  ['linkedin', 'github', 'portfolio'].forEach((key) => {
    if (!mergedLinks[key] && contactInfo[key]) mergedLinks[key] = contactInfo[key];
  });
  updates.links = mergedLinks;

  applyScalarIfUnclaimed('professionalTitle', title, profile, syncMeta, updates, newSyncMeta);

  const careerLevel = enrichment.userCorrectedCareerLevel || enrichment.careerLevel || null;
  if (careerLevel && careerLevel !== 'unknown') {
    applyScalarIfUnclaimed('careerLevel', careerLevel, profile, syncMeta, updates, newSyncMeta);
  }

  const years = enrichment.totalExperienceYears ?? estimateYearsOfExperience(enrichment.experience || []);
  if (years !== null && years !== undefined) {
    applyScalarIfUnclaimed('experience', String(years), profile, syncMeta, updates, newSyncMeta);
  }

  if (contactInfo.phone) {
    applyScalarIfUnclaimed('phone', contactInfo.phone, profile, syncMeta, updates, newSyncMeta);
  }

  if (!profile.bio) {
    const summary = enrichment.userCorrectedSummary || enrichment.summary;
    if (summary) updates.bio = summary;
  }

  updates.resumeConfidence = enrichment.confidence ?? null;
  updates.resumeSyncMeta = newSyncMeta;
  updates.lastResumeSyncedAt = new Date();
  updates.syncedResumeId = enrichment.resumeId;

  await profile.update(updates);
  return profile;
}
