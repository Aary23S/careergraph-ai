import { models } from '../config/database.js';
import { extractResumeText } from './resume-ai-enrichment.service.js';

/**
 * Builds minimal structured context for the AI Outreach Assistant.
 */
export async function buildOutreachAIContext({ userId, jobId, connectionId }) {
  // 1. Fetch User Profile & Active Resume
  const profile = await models.Profile.findOne({ where: { user_id: userId } });
  const activeResume = await models.Resume.findOne({ where: { user_id: userId, isActive: true } });
  
  let resumeText = '';
  if (activeResume) {
    try {
      const rawText = await extractResumeText(activeResume);
      resumeText = (rawText || '').slice(0, 4000); // Truncated to safe limit
    } catch (e) {
      console.warn('[ContextBuilder] Failed to extract resume text:', e.message);
    }
  }

  const userContext = {
    professionalProfile: profile?.bio || '',
    currentRole: profile?.targetRoles?.[0] || '',
    relevantSkills: profile?.skills || [],
    relevantExperience: profile?.experience || '',
    careerContext: resumeText
  };

  // 2. Fetch Job Context if jobId is provided
  let jobContext = null;
  if (jobId) {
    const job = await models.Job.findByPk(jobId);
    if (job) {
      const enrichment = await models.JobAiEnrichment.findOne({ where: { jobId } });
      jobContext = {
        title: job.title,
        company: job.normalizedCompany || job.sourceMetadata?.companyName || 'Target Company',
        role: enrichment?.roleCategory || '',
        requirements: enrichment?.responsibilities || [],
        skills: enrichment?.requiredSkills || []
      };
    }
  }

  // 3. Fetch Connection Context if connectionId is provided
  let connectionContext = null;
  if (connectionId) {
    const conn = await models.Connection.findByPk(connectionId);
    if (conn) {
      const enrichment = await models.ConnectionAiEnrichment.findOne({ where: { connectionId } });
      connectionContext = {
        name: conn.name,
        headline: conn.headline || conn.title || '',
        currentRole: conn.title || enrichment?.professionalRole || '',
        company: conn.company || '',
        relevantExpertise: enrichment?.expertiseAreas || [],
        sharedTechnologies: enrichment?.technologies || [],
        sharedDomains: enrichment?.technicalDomains || []
      };
    }
  }

  // 4. Fetch Relationship Context
  let relationshipContext = {
    connectionStatus: 'not_contacted',
    previousOutreach: [],
    lastContact: null,
    followUpState: null
  };

  if (connectionId) {
    const outreach = await models.Outreach.findOne({
      where: { connection_id: connectionId, user_id: userId },
      include: [{ model: models.OutreachEvent, as: 'events' }],
      order: [[{ model: models.OutreachEvent, as: 'events' }, 'occurred_at', 'DESC']]
    });

    if (outreach) {
      const events = outreach.events || [];
      const recentEvents = events.slice(0, 3).map(e => ({
        status: e.status,
        eventType: e.eventType,
        notes: e.notes || '',
        occurredAt: e.occurredAt
      }));

      relationshipContext = {
        connectionStatus: outreach.status,
        previousOutreach: recentEvents,
        lastContact: outreach.contactDate || null,
        followUpState: outreach.followUpDate || null
      };
    }
  }

  return {
    job: jobContext,
    user: userContext,
    connection: connectionContext,
    relationship: relationshipContext
  };
}
