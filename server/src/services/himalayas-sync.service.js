import { HimalayasJobSource } from './job-source.service.js';
import { ingestJobsBatch } from './job-ingestion.service.js';

export async function syncHimalayasJobs(userId, options = {}) {
  const config = {
    includeDescription: false,
    maxJobs: 100,
    maxPagesToScan: 50,
    timeBudgetSecs: 240,
    ...options
  };

  const source = new HimalayasJobSource();
  const summary = {
    processed: 0,
    created: 0,
    updated: 0,
    duplicate: 0,
    failed: 0,
    results: []
  };

  const startTime = Date.now();
  let pagesScanned = 0;
  let offset = 0;
  const limit = 50; // Himalayas default/max is usually 50-100, let's use 50 per page

  while (pagesScanned < config.maxPagesToScan && summary.processed < config.maxJobs) {
    try {
      // Respect time budget
      if ((Date.now() - startTime) / 1000 > config.timeBudgetSecs) {
        console.log(`Himalayas sync reached time budget of ${config.timeBudgetSecs}s. Stopping.`);
        break;
      }

      // Respect rate limit: small delay between pages
      if (pagesScanned > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const rawResults = await source.fetch(limit, offset);
      
      if (!rawResults || rawResults.length === 0) {
        break; // No more jobs
      }

      const jobsToIngest = rawResults.map(item => {
        const parsed = source.parse(item);
        if (!config.includeDescription) {
          parsed.description = ''; // omit description if configured
        }
        return {
          ...parsed,
          source: 'himalayas'
        };
      });

      // We only want to ingest up to maxJobs
      const remainingAllowance = config.maxJobs - summary.processed;
      const batchToIngest = jobsToIngest.slice(0, remainingAllowance);

      const batchSummary = await ingestJobsBatch(userId, batchToIngest);
      summary.processed += batchSummary.processed;
      summary.created += batchSummary.created;
      summary.updated += batchSummary.updated;
      summary.duplicate += batchSummary.duplicate;
      summary.failed += batchSummary.failed;
      summary.results.push(...batchSummary.results);

      offset += limit;
      pagesScanned++;
    } catch (err) {
      console.error(`Error syncing Himalayas page ${pagesScanned + 1}:`, err);
      summary.failed += 1;
      summary.results.push({ success: false, error: err.message });
      break; // Stop on first error (e.g. rate limit)
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
