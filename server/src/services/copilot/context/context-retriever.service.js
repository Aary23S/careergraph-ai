import { models } from '../../../config/database.js';
import { querySemanticMatches } from '../../semantic-search.service.js';

/**
 * Orchestrates deterministic and semantic retrieval, enforcing user authorization.
 */
export async function retrieveContextData(userId, policy, params) {
  const data = {
    jobs: [],
    connections: [],
    applications: [],
    resume: null,
  };

  const { jobId, query, connectionId, applicationId } = params;

  // 1. Fetch Job (Deterministic)
  if (policy.allowedEntities.job && jobId) {
    const job = await models.Job.findOne({
      where: { id: jobId, user_id: userId },
      include: [{ model: models.Company, as: 'company' }]
    });
    if (job) data.jobs.push(job);
  }

  // 2. Fetch Connections (Deterministic)
  if (policy.allowedEntities.connections) {
    if (connectionId) {
      const conn = await models.Connection.findOne({
        where: { id: connectionId, user_id: userId }
      });
      if (conn) data.connections.push(conn);
    } else {
      const allUserConnections = await models.Connection.findAll({
        where: { user_id: userId }
      });
      data.connections.push(...allUserConnections);
    }
  }

  // 3. Fetch Application (Deterministic)
  if (policy.allowedEntities.applications && applicationId) {
    const app = await models.Application.findOne({
      where: { id: applicationId, user_id: userId }
    });
    if (app) data.applications.push(app);
  }

  // 4. Fetch Resume / Profile (Deterministic)
  if (policy.allowedEntities.resume) {
    const profile = await models.Profile.findOne({
      where: { user_id: userId }
    });
    if (profile) {
      data.resume = profile;
    }
  }

  // 5. Semantic Search (Hybrid Fallback)
  if (policy.semanticFallback && query) {
    const entityTypes = [];
    if (policy.allowedEntities.connections) entityTypes.push('connection');
    if (policy.allowedEntities.job) entityTypes.push('job');

    if (entityTypes.length > 0) {
      const semanticCandidates = await querySemanticMatches({
        userId,
        queryText: query,
        entityTypes,
        limit: 15
      });

      for (const match of semanticCandidates) {
        if (match.entityType === 'connection' && !data.connections.find(c => c.id === match.entityId)) {
          const c = await models.Connection.findOne({ where: { id: match.entityId, user_id: userId }});
          if (c) {
            c.semanticSimilarity = match.similarity;
            data.connections.push(c);
          }
        } else if (match.entityType === 'job' && !data.jobs.find(j => j.id === match.entityId)) {
          const j = await models.Job.findOne({ where: { id: match.entityId, user_id: userId }});
          if (j) {
            j.semanticSimilarity = match.similarity;
            data.jobs.push(j);
          }
        }
      }
    }
  }

  // 6. Fetch Notes (only for retrieved entities) if policy allows
  if (policy.allowedEntities.notes) {
    // We attach notes to connections if allowed
    const connectionIds = data.connections.map(c => c.id);
    if (connectionIds.length > 0) {
      const notes = await models.Note.findAll({
        where: {
          user_id: userId,
          entityType: 'connection',
          entityId: connectionIds
        },
        order: [['createdAt', 'DESC']]
      });

      notes.forEach(note => {
        const conn = data.connections.find(c => c.id === note.entityId);
        if (conn) {
          conn.notes = conn.notes ? conn.notes + '\n\n' + note.content : note.content;
        }
      });
    }
  }

  return data;
}
