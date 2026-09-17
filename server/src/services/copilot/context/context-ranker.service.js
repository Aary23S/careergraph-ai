/**
 * Ranks context items using existing signals and enforces policy limits.
 */
import { calculateReferralScore } from '../../intelligence.service.js';

export function rankAndLimitConnections(connections, job, policyLimits) {
  if (!connections || connections.length === 0) return [];
  
  const limit = policyLimits.connections || 10;
  
  // Apply referral score dynamically for the given job context if we have a job
  if (job) {
    const jobCompStr = (typeof job.company === 'string' ? job.company : (job.company?.name || job.normalizedCompany || '')).toLowerCase().trim();

    connections.forEach(c => {
      const mockConn = {
        company: c.company,
        title: c.title,
        relationshipStrength: c.relationshipStrength
      };
      const calculated = calculateReferralScore(mockConn, job);
      c.referralScore = Math.max(c.referralScore || 0, calculated);

      // Explicit target company insider flag
      const connCompStr = (c.company || '').toLowerCase().trim();
      c.isTargetCompanyInsider = !!(jobCompStr && connCompStr && (connCompStr.includes(jobCompStr) || jobCompStr.includes(connCompStr)));
    });
  }

  // Sort by target company insider (desc), then referral score (desc), then connection score (desc)
  connections.sort((a, b) => {
    if (a.isTargetCompanyInsider !== b.isTargetCompanyInsider) {
      return (b.isTargetCompanyInsider ? 1 : 0) - (a.isTargetCompanyInsider ? 1 : 0);
    }
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
