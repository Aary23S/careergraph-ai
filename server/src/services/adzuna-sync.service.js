import { AdzunaJobSource } from './job-source.service.js';
import { ingestJobsBatch } from './job-ingestion.service.js';
import { models } from '../config/database.js';

export async function syncAdzunaJobs(userId) {
  // Fetch active JobSearchProfiles for this user
  let profiles = await models.JobSearchProfile.findAll({
    where: { user_id: userId, isActive: true }
  });

  // Proactive default: if no search profiles exist, create one based on their Profile targets
  if (profiles.length === 0) {
    const userProfile = await models.Profile.findOne({ where: { user_id: userId } });
    const targetRole = userProfile?.targetRoles?.[0] || 'software developer';
    const targetLoc = userProfile?.location || '';
    
    const newProfile = await models.JobSearchProfile.create({
      user_id: userId,
      name: 'Default Profile',
      keywords: targetRole,
      location: targetLoc,
      isActive: true
    });
    profiles = [newProfile];
  }

  const source = new AdzunaJobSource();
  const summary = {
    processed: 0,
    created: 0,
    updated: 0,
    duplicate: 0,
    failed: 0,
    results: []
  };

  for (const prof of profiles) {
    try {
      // Respect rate limit: small delay between profiles
      if (summary.processed > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const rawResults = await source.fetch(prof, 1);
      const jobsToIngest = rawResults.map(item => {
        const parsed = source.parse(item);
        return {
          ...parsed,
          source: 'adzuna'
        };
      });

      const batchSummary = await ingestJobsBatch(userId, jobsToIngest);
      summary.processed += batchSummary.processed;
      summary.created += batchSummary.created;
      summary.updated += batchSummary.updated;
      summary.duplicate += batchSummary.duplicate;
      summary.failed += batchSummary.failed;
      summary.results.push(...batchSummary.results);
    } catch (err) {
      console.error(`Error syncing search profile "${prof.name}":`, err);
      summary.failed += 1;
      summary.results.push({ success: false, error: err.message });
    }
  }

  // Auto-purge low-relevance or expired jobs to prevent DB bloat
  try {
    const { cleanupExpiredAndLowMatchJobs } = await import('./job-cleanup.service.js');
    const purgedCount = await cleanupExpiredAndLowMatchJobs(userId);
    summary.purgedCount = purgedCount;
  } catch (err) {
    console.error('Error during automatic job cleanup:', err);
  }

  return summary;
}
