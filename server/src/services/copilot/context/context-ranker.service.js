/**
 * Ranks context items using existing signals and enforces policy limits.
 */
import { calculateReferralScore } from '../../intelligence.service.js';

export function rankAndLimitConnections(connections, job, policyLimits) {
  if (!connections || connections.length === 0) return [];
  
  const limit = policyLimits.connections || 10;
  
  // Apply referral score dynamically for the given job context if we have a job
  if (job) {
    connections.forEach(c => {
      // simulate connection object for intelligence.service (needs company, relationshipStrength, etc)
      const mockConn = {
        company: c.company,
        title: c.title,
        relationshipStrength: c.relationshipStrength
      };
      c.referralScore = Math.max(c.referralScore || 0, calculateReferralScore(mockConn, job));
    });
  }

  // Sort by referral score (desc), then connection score (desc), then semantic similarity (if attached)
  connections.sort((a, b) => {
    if (a.referralScore !== b.referralScore) {
      return (b.referralScore || 0) - (a.referralScore || 0);
    }
    if (a.connectionScore !== b.connectionScore) {
      return (b.connectionScore || 0) - (a.connectionScore || 0);
    }
    if (a.semanticSimilarity && b.semanticSimilarity) {
      return b.semanticSimilarity - a.semanticSimilarity;
    }
    return 0;
  });

  return connections.slice(0, limit);
}

export function rankAndLimitJobs(jobs, policyLimits) {
  if (!jobs || jobs.length === 0) return [];
  
  const limit = policyLimits.semanticJobs || 5;

  jobs.sort((a, b) => {
    if (a.semanticSimilarity && b.semanticSimilarity) {
      return b.semanticSimilarity - a.semanticSimilarity;
    }
    return (b.matchScore || 0) - (a.matchScore || 0);
  });

  return jobs.slice(0, limit);
}
