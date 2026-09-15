/**
 * Defines retrieval boundaries and rules for different Copilot intents.
 */

const POLICIES = {
  referral_search: {
    description: 'Finds referral candidates for a specific job.',
    allowedEntities: {
      job: true,
      connections: true,
      resume: false,
      applications: false,
      notes: true, // Only if attached to allowed connections
    },
    limits: {
      connections: 10,
      notes: 5,
    },
    semanticFallback: true,
  },
  match_explanation: {
    description: 'Explains why a resume matches a job.',
    allowedEntities: {
      job: true,
      connections: false,
      resume: true,
      applications: false,
      notes: false,
    },
    limits: {},
    semanticFallback: false,
  },
  application_status: {
    description: 'Retrieves status and history for a specific application.',
    allowedEntities: {
      job: true,
      connections: true, // Specifically the referral connection if exists
      resume: true,
      applications: true,
      notes: false,
    },
    limits: {
      applications: 5,
    },
    semanticFallback: false,
  },
  career_query: {
    description: 'General career query relying on semantic search and user resume.',
    allowedEntities: {
      job: false, // Unless matched via semantic search
      connections: false, // Unless matched via semantic search
      resume: true,
      applications: false,
      notes: false,
    },
    limits: {
      semanticJobs: 5,
      semanticConnections: 5,
    },
    semanticFallback: true,
  },
  decision_digest: {
    description: 'Retrieves bounded subsets of top jobs, referrals, applications, and profile for career decision digest.',
    allowedEntities: {
      job: true,
      connections: true,
      resume: true,
      applications: true,
      notes: false,
    },
    limits: {
      jobs: 5,
      connections: 5,
      applications: 5,
    },
    semanticFallback: false,
  }
};

export function getContextPolicy(intent) {
  if (!POLICIES[intent]) {
    throw new Error(`Unsupported Copilot intent: ${intent}`);
  }
  return POLICIES[intent];
}
