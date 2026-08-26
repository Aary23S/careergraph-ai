import { AppError } from '../../lib/http.js';

/**
 * Clean and normalize a string to facilitate robust substring comparisons.
 */
function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // strip punctuation
    .replace(/\s+/g, ' ')   // normalize whitespace
    .trim();
}

/**
 * 3H-4 — Hallucination Validation
 * Asserts whether AI-derived claims (skills, companies, roles, seniority) are backed by evidence.
 * Returns { passed: boolean, errors: string[] }
 */
export function validateClaims(evidenceText, extractionResults) {
  const errors = [];
  const normalizedEvidence = normalizeText(evidenceText);

  if (!extractionResults) {
    return { passed: true, errors };
  }

  // 1. Verify skills
  const skills = extractionResults.requiredSkills || extractionResults.skills || [];
  for (const skill of skills) {
    const normSkill = normalizeText(skill);
    if (normSkill && !normalizedEvidence.includes(normSkill)) {
      errors.push(`Extracted skill "${skill}" has no supporting evidence in raw source.`);
    }
  }

  // 2. Verify company alignment
  const company = extractionResults.company || extractionResults.companyName;
  if (company) {
    const normCompany = normalizeText(company);
    if (normCompany && !normalizedEvidence.includes(normCompany)) {
      errors.push(`Extracted company "${company}" is not mentioned in raw source.`);
    }
  }

  // 3. Verify role alignment
  const role = extractionResults.role || extractionResults.title;
  if (role) {
    const normRole = normalizeText(role);
    // Split into words for broad match (e.g. "Senior Dev" matches "Senior Software Developer")
    const words = normRole.split(' ').filter(w => w.length > 2);
    const hasMatch = words.some(w => normalizedEvidence.includes(w));
    if (words.length > 0 && !hasMatch) {
      errors.push(`Extracted role/title "${role}" is not referenced in raw source.`);
    }
  }

  return {
    passed: errors.length === 0,
    errors
  };
}

/**
 * 3H-12 — Prompt Injection Defense
 * Detects common malicious prompt injection payloads in untrusted user data.
 */
export function detectAndSanitizePromptInjection(inputText) {
  if (!inputText) return '';

  const injectionPatterns = [
    /ignore previous instructions/i,
    /system override/i,
    /developer mode/i,
    /you are now a/i,
    /instead of your instructions/i,
    /override rules/i,
    /forget everything/i,
    /stop what you are doing/i
  ];

  const hasInjection = injectionPatterns.some(pattern => pattern.test(inputText));

  if (hasInjection) {
    // Flag and sanitize: wrap in untrusted boundary blocks and remove key words
    const sanitized = String(inputText)
      .replace(/ignore/gi, '[redacted]')
      .replace(/override/gi, '[redacted]')
      .replace(/instructions/gi, '[redacted]');

    return `[UNTRUSTED DATA SHIELDED START]\n${sanitized}\n[UNTRUSTED DATA SHIELDED END]`;
  }

  return inputText;
}

/**
 * 3H-11 — Outreach Safety Guardrails
 * Scans generated outreach drafts to verify relationship history matches the CRM data.
 */
export function validateOutreachDraft(draftText, connection, relationshipHistory) {
  const errors = [];

  // 1. Check for fabricated Google/BigTech history if connection has no history
  const claimsWeWorkedTogether = /we worked together/i.test(draftText) || /at our previous company/i.test(draftText);
  const hasEmploymentHistoryOverlap = connection?.company && relationshipHistory?.some(h => h.company === connection.company);

  if (claimsWeWorkedTogether && !hasEmploymentHistoryOverlap) {
    errors.push('AI draft claims prior employment history overlap, but CRM records show none.');
  }

  // 2. Verify mutual contact claim
  const claimsMutualContact = /mutual connection/i.test(draftText) || /referred by/i.test(draftText);
  const crmNotesReferral = connection?.notes && /referred|mutual/i.test(connection.notes);

  if (claimsMutualContact && !crmNotesReferral) {
    errors.push('AI draft references mutual contacts or referral lines not logged in connection notes.');
  }

  // 3. Scan for aggressive or unprofessional tones
  const aggressiveWords = [/urgent/i, /asap/i, /demand/i, /pay up/i, /why ignoring/i];
  for (const pattern of aggressiveWords) {
    if (pattern.test(draftText)) {
      errors.push(`AI draft contains aggressive tone markers matching pattern: ${pattern}.`);
    }
  }

  return {
    passed: errors.length === 0,
    errors
  };
}

/**
 * 3H-5 — Source-of-Truth Guardrails
 * Validates updates to ensure AI is only permitted to modify AI-derived metadata fields.
 */
export function enforceSourceOfTruth(updatePayload) {
  const forbiddenFields = [
    'userId',
    'user_id',
    'id',
    'email',
    'password',
    'isAdmin',
    'is_admin',
    'status', // status of job applications or connections sent state
    'applicationStatus',
    'outreachSentState'
  ];

  const violations = Object.keys(updatePayload).filter(key => forbiddenFields.includes(key));
  if (violations.length > 0) {
    throw new AppError(403, 'SOURCE_OF_TRUTH_VIOLATION', `AI layer is unauthorized to modify the following canonical fields: ${violations.join(', ')}`);
  }
  return true;
}

/**
 * 3H-13 — Data Minimization Controls
 * Extracts only the necessary fields from entities to send to the LLM model.
 */
export function minimizePayload(entityType, data) {
  if (!data) return null;

  if (entityType === 'job') {
    return {
      title: data.title,
      description: data.description,
      location: data.location,
      companyName: data.companyName
    };
  }

  if (entityType === 'resume') {
    return {
      fileName: data.fileName,
      rawText: data.rawText
    };
  }

  if (entityType === 'connection') {
    return {
      name: data.name,
      title: data.title,
      company: data.company,
      location: data.location,
      notes: data.notes
    };
  }

  return data;
}
