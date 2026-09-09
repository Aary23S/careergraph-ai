import { ApifyLinkedInJobSource } from './job-source.service.js';
import { ingestJobsBatch } from './job-ingestion.service.js';
import { env } from '../config/env.js';

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const ACTOR_ID = 'curious_coder~linkedin-jobs-scraper';

export async function syncApifyLinkedInJobs(userId, options = {}) {
  if (!env.apifyApiToken) {
    throw new Error('APIFY_API_TOKEN is not configured.');
  }

  // Set up the run payload based on user's input/options
  const runPayload = {
    autoConvertToAiSearch: options.autoConvertToAiSearch !== undefined ? options.autoConvertToAiSearch : true,
    datePosted: options.datePosted || 'past24Hours',
    keywords: options.keywords || 'Software Engineer',
    limitPerSource: options.limitPerSource || 100,
    location: options.location || 'Remote, On-site, Hybrid',
    scrapeCompany: options.scrapeCompany !== undefined ? options.scrapeCompany : true,
    splitByLocation: options.splitByLocation !== undefined ? options.splitByLocation : true,
    splitCountry: options.splitCountry || 'IN',
    under10Applicants: options.under10Applicants !== undefined ? options.under10Applicants : false,
    urls: options.urls || ["https://www.linkedin.com/jobs/search/?position=1&pageNum=0"]
  };

  // 1. Initiate the Run
  let runResponse;
  try {
    const res = await fetch(`${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs?token=${env.apifyApiToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(runPayload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to start Apify actor: ${res.status} ${errText}`);
    }

    runResponse = await res.json();
  } catch (err) {
    console.error('[Apify Sync Error] Failed to start run:', err);
    throw err;
  }

  const runId = runResponse.data.id;
  const defaultDatasetId = runResponse.data.defaultDatasetId;
  console.log(`[Apify Sync] Started run ${runId}, polling for completion...`);

  // 2. Poll for completion
  let status = runResponse.data.status;
  const maxPolls = 120; // e.g. 1 hour (120 * 30s)
  let pollCount = 0;
  
  while (['READY', 'RUNNING', 'STARTING'].includes(status) && pollCount < maxPolls) {
    await new Promise(resolve => setTimeout(resolve, 30000)); // wait 30 seconds
    
    try {
      const pollRes = await fetch(`${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs/${runId}?token=${env.apifyApiToken}`);
      if (pollRes.ok) {
        const pollData = await pollRes.json();
        status = pollData.data.status;
        console.log(`[Apify Sync] Run ${runId} status: ${status}`);
      }
    } catch (pollErr) {
      console.warn(`[Apify Sync] Error polling status for run ${runId}:`, pollErr.message);
    }
    
    pollCount++;
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify run ended with status ${status} after ${pollCount} polls.`);
  }

  // 3. Fetch Dataset Items
  console.log(`[Apify Sync] Run ${runId} succeeded, fetching dataset ${defaultDatasetId}...`);
  let datasetItems = [];
  try {
    const datasetRes = await fetch(`${APIFY_BASE_URL}/datasets/${defaultDatasetId}/items?token=${env.apifyApiToken}`);
    if (!datasetRes.ok) {
      throw new Error(`Failed to fetch dataset items: ${datasetRes.status}`);
    }
    datasetItems = await datasetRes.json();
  } catch (err) {
    console.error('[Apify Sync Error] Failed to fetch dataset:', err);
    throw err;
  }

  if (!datasetItems || datasetItems.length === 0) {
    return {
      processed: 0,
      created: 0,
      updated: 0,
      duplicate: 0,
      failed: 0,
      results: [],
      message: 'Apify run completed but no jobs were found.'
    };
  }

  // 4. Ingest Jobs
  const source = new ApifyLinkedInJobSource();
  const jobsToIngest = datasetItems.map(item => {
    const parsed = source.parse(item);
    return {
      ...parsed,
      source: 'linkedin',
      provider: 'apify-linkedin'
    };
  });

  const summary = await ingestJobsBatch(userId, jobsToIngest);

  // Auto-purge low-relevance or expired jobs
  try {
    const { cleanupExpiredAndLowMatchJobs } = await import('./job-cleanup.service.js');
    const purgedCount = await cleanupExpiredAndLowMatchJobs(userId);
    summary.purgedCount = purgedCount;
  } catch (err) {
    console.error('Error during automatic job cleanup:', err);
  }

  console.log(`[Apify Sync] Sync complete. Ingested ${summary.created} new jobs.`);
  return summary;
}
