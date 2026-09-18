import { CompanyNormalizerService } from './company-normalizer.service.js';

export class QueryUnderstandingService {
  /**
   * Deterministically analyzes prompt text, selected context, and conversation history
   * to resolve intent and entities with strict precedence:
   * Explicit query entity > Explicit UI selected entity > Last referenced entity > Top fallback
   * 
   * @param {Object} params
   * @param {string} params.message
   * @param {Object} [params.conversationContext]
   * @param {Object} [params.selectedContext]
   * @param {string} [params.userId]
   * @returns {Object} Structured understanding result
   */
  static understandQuery({ message = '', conversationContext = {}, selectedContext = {}, userId = null }) {
    const text = (message || '').trim();
    const lowerText = text.toLowerCase();

    // 1. Extract explicit entities from query text first
    const explicitEntities = this._extractEntitiesFromText(text);

    // 2. Precedence Resolution for Entities
    let companyEntity = null;
    let personEntity = null;
    let jobEntity = null;

    // Company entity precedence
    if (explicitEntities.company) {
      companyEntity = { value: explicitEntities.company, source: 'explicit_query' };
    } else if (selectedContext.company || selectedContext.jobCompany) {
      companyEntity = { value: selectedContext.company || selectedContext.jobCompany, source: 'ui_selected' };
    } else if (conversationContext.lastCompany) {
      companyEntity = { value: conversationContext.lastCompany, source: 'conversation_history' };
    }

    // Person entity precedence
    if (explicitEntities.person) {
      personEntity = { value: explicitEntities.person, source: 'explicit_query' };
    } else if (selectedContext.connectionName || selectedContext.personName) {
      personEntity = { value: selectedContext.connectionName || selectedContext.personName, source: 'ui_selected' };
    } else if (conversationContext.lastPerson) {
      personEntity = { value: conversationContext.lastPerson, source: 'conversation_history' };
    }

    // Job entity precedence
    if (explicitEntities.job) {
      jobEntity = { value: explicitEntities.job, source: 'explicit_query' };
    } else if (selectedContext.jobTitle || selectedContext.jobId) {
      jobEntity = { value: selectedContext.jobTitle || selectedContext.jobId, source: 'ui_selected' };
    } else if (conversationContext.lastJob) {
      jobEntity = { value: conversationContext.lastJob, source: 'conversation_history' };
    }

    // 3. Determine Intent
    const intent = this._determineIntent(lowerText, explicitEntities, companyEntity, personEntity, jobEntity);

    return {
      intent,
      confidence: intent === 'unsupported' ? 0.7 : 0.98,
      entities: {
        company: companyEntity,
        person: personEntity,
        job: jobEntity
      },
      resolution: (companyEntity || personEntity || jobEntity) ? 'resolved' : 'unresolved',
      rawQuery: text
    };
  }

  /**
   * Deterministic entity extractor from query string.
   */
  static _extractEntitiesFromText(text) {
    const result = { company: null, person: null, job: null };
    if (!text) return result;

    // Clean leading verbs
    let cleaned = text.replace(/^(?:show|find|list|get|give|view|display)\s+/i, '').trim();

    // Company extraction patterns:
    const companyPatterns = [
      /(?:connections?|people|contacts?|referrals?|who works?|employees?|hiring|jobs?)\s+(?:at|from|in|for)\s+([a-z0-9\s.\-]+?)(?:\?|\.|$|\s+for|\s+with)/i,
      /(?:at|from|for)\s+([a-z0-9\s.\-]+?)\s+(?:connections?|contacts?|employees?)/i,
      /^([a-z0-9\s.\-]+?)\s+(?:connections?|referrals?|contacts?)/i
    ];

    for (const pattern of companyPatterns) {
      const match = cleaned.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (CompanyNormalizerService.isPlausibleEntity(candidate)) {
          result.company = candidate;
          break;
        }
      }
    }

    // Person extraction patterns:
    const personPatterns = [
      /(?:draft|write|send|message|reach out|email|contact|notes?)\s+(?:to|for|with)\s+([a-z\s]+?)(?:\?|\.|$|\s+at|\s+regarding)/i,
      /(?:who is|info on|details for)\s+([a-z\s]+?)(?:\?|\.|$|\s+at)/i
    ];

    for (const pattern of personPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (CompanyNormalizerService.isPlausibleEntity(candidate) && candidate.toLowerCase() !== 'me') {
          result.person = candidate;
          break;
        }
      }
    }

    // Job extraction patterns:
    const jobPatterns = [
      /(?:job|role|position)\s+(?:of|for|as)?\s*([a-z0-9\s.\-]+?)(?:\?|\.|$|\s+at|\s+in)/i,
      /for\s+([a-z0-9\s.\-]+?\s+(?:engineer|developer|manager|architect|lead|director|analyst|designer))/i
    ];

    for (const pattern of jobPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (CompanyNormalizerService.isPlausibleEntity(candidate)) {
          result.job = candidate;
          break;
        }
      }
    }

    return result;
  }

  /**
   * Intent classification rules engine.
   */
  static _determineIntent(lowerText, explicitEntities, companyEntity, personEntity, jobEntity) {
    if (lowerText.includes('draft') || lowerText.includes('reach out to') || lowerText.includes('write a message')) {
      return 'draft_outreach';
    }

    if (lowerText.includes('who is hiring') || lowerText.includes('is hiring') || lowerText.includes('hiring at')) {
      return 'unsupported';
    }

    if (lowerText.includes('why is') || lowerText.includes('match explanation') || lowerText.includes('why match') || lowerText.includes('good match') || lowerText.includes('fit for')) {
      return 'match_explanation';
    }

    if (lowerText.includes('who can refer me') || lowerText.includes('referral search') || lowerText.includes('referral candidates') || lowerText.includes('referral path')) {
      return 'referral_search';
    }

    if (lowerText.includes('application') || lowerText.includes('applied') || lowerText.includes('pipeline') || lowerText.includes('status of my application')) {
      return 'application_status';
    }

    if (lowerText.includes('skill') || lowerText.includes('skills') || lowerText.includes('target role') || lowerText.includes('career advice') || lowerText.includes('resume')) {
      return 'career_query';
    }

    if (lowerText.includes('connections') || lowerText.includes('who works at') || lowerText.includes('contacts at') || lowerText.includes('network') || lowerText.includes('contacts in')) {
      return 'connection_search';
    }

    if (lowerText.includes('job') || lowerText.includes('find jobs') || lowerText.includes('search jobs')) {
      return 'job_search';
    }

    if (lowerText.includes('what should i focus on') || lowerText.includes('decision digest') || lowerText.includes('today digest') || lowerText.includes('focus')) {
      return 'decision_digest';
    }

    if (companyEntity || personEntity) {
      return 'connection_search';
    }

    return 'career_query';
  }
}
