import { getContextPolicy } from './context-policy.service.js';
import { retrieveContextData } from './context-retriever.service.js';
import { rankAndLimitConnections, rankAndLimitJobs } from './context-ranker.service.js';
import { sanitizeJob, sanitizeConnection, sanitizeApplication, sanitizeResume, generateProvenance } from './context-sanitizer.service.js';
import { aiObservability } from '../../ai/observability.service.js';

export class ContextBuilder {
  /**
   * Builds the authorized, sanitized Context Package for the LLM.
   * @param {string} userId - ID of the user requesting context.
   * @param {Object} request - Parameters for the context.
   * @param {string} request.intent - Intent identifying the policy to apply.
   * @param {string} request.query - User query (for semantic retrieval).
   * @param {string} [request.jobId] - Optional job filter.
   * @param {string} [request.connectionId] - Optional connection filter.
   * @param {string} [request.applicationId] - Optional application filter.
   */
  static async buildContext(userId, request) {
    const startTime = Date.now();
    const { intent, query, jobId, connectionId, applicationId } = request;

    // 1. Get Policy
    const policy = getContextPolicy(intent);

    // 2. Retrieve Raw Data (Isolated & Hybrid)
    const rawData = await retrieveContextData(userId, policy, {
      jobId, query, connectionId, applicationId
    });

    // 3. Rank & Limit Raw Entities
    const mainJob = rawData.jobs.find(j => j.id === jobId) || rawData.jobs[0];
    const limitedConnections = rankAndLimitConnections(rawData.connections, mainJob, policy.limits);
    const limitedJobs = rankAndLimitJobs(rawData.jobs, policy.limits);

    // 4. Sanitize and Package
    const contextPackage = {
      contextVersion: 'copilot-context-v1',
      intent,
      sources: [],
      entities: {
        jobs: [],
        connections: [],
        applications: [],
        resume: null
      },
      facts: [], // For provenance tracking
      metadata: {
        retrievedCount: 0
      }
    };

    // Sanitize Jobs
    for (const job of limitedJobs) {
      const sJob = sanitizeJob(job);
      if (sJob) {
        contextPackage.entities.jobs.push(sJob);
        contextPackage.sources.push(`job:${job.id}`);
        contextPackage.metadata.retrievedCount++;
        
        if (sJob.company) {
          contextPackage.facts.push(generateProvenance(`Target company is ${sJob.company}`, sJob, 'company'));
        }
      }
    }

    // Sanitize Connections
    for (const conn of limitedConnections) {
      // Notes are limited by the sanitizer unless policy explicitly overrides
      const sConn = sanitizeConnection(conn, policy.limits.notes ? true : false);
      if (sConn) {
        contextPackage.entities.connections.push(sConn);
        contextPackage.sources.push(`connection:${conn.id}`);
        contextPackage.metadata.retrievedCount++;
        
        contextPackage.facts.push(generateProvenance(`${sConn.name} works at ${sConn.company} as ${sConn.title}`, sConn, 'employment'));
      }
    }

    // Sanitize Applications
    for (const app of rawData.applications) {
      const sApp = sanitizeApplication(app);
      if (sApp) {
        contextPackage.entities.applications.push(sApp);
        contextPackage.sources.push(`application:${app.id}`);
        contextPackage.metadata.retrievedCount++;
      }
    }

    // Sanitize Resume
    if (rawData.resume) {
      const sResume = sanitizeResume(rawData.resume.id, rawData.resume);
      if (sResume) {
        contextPackage.entities.resume = sResume;
        contextPackage.sources.push('profile:resume');
        contextPackage.metadata.retrievedCount++;
      }
    }

    const latencyMs = Date.now() - startTime;

    // 5. Track Observability (Mocking AI Audit format for Context generation)
    try {
      await aiObservability.recordRequest({
        userId,
        operation: `context_build:${intent}`,
        entityType: 'context',
        entityId: null,
        provider: 'context-layer',
        model: 'v1',
        promptVersion: 1,
        schemaVersion: 1,
        latencyMs,
        status: 'success'
      });
    } catch (err) {
      console.warn('[ContextBuilder] Failed to record observability:', err.message);
    }

    return contextPackage;
  }
}
