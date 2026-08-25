/**
 * Builds the prompt for the AI Outreach Assistant draft generation.
 */
export function buildOutreachDraftPrompt({
  intent,
  tone,
  length,
  job,
  user,
  connection,
  relationship
}) {
  return `Generate a personalized professional outreach message draft based ONLY on the provided context.

=== OUTREACH SETTINGS ===
Intent: ${intent}
Requested Tone: ${tone}
Requested Length: ${length}

=== JOB DETAILS ===
${job ? JSON.stringify(job, null, 2) : 'No specific job context.'}

=== USER PROFESSIONAL PROFILE ===
${JSON.stringify(user, null, 2)}

=== CONNECTION PROFILE ===
${connection ? JSON.stringify(connection, null, 2) : 'No connection profile context.'}

=== RELATIONSHIP HISTORY ===
${JSON.stringify(relationship, null, 2)}

=== STRICT GENERATION RULES ===
1. Use only the supplied context.
2. Never invent a relationship, imply friendship, or assume familiarity unless supported by the Relationship History notes.
3. Never claim the connection recommended you or recommended this job.
4. Never invent shared projects, education, or work history.
5. Do not pressure the recipient. Keep call-to-actions simple and respectful.
6. Make the message concise and aligned with the requested length (${length}).
7. Output must be a JSON object with:
   - "message": The outreach draft message body (string).
   - "tone": The final tone description (string).
   - "personalizationPoints": A short array of string points describing what specific connection details were used to personalize this message.
8. Do not output any thinking or chain-of-thought. Return raw JSON matching the schema structure.`;
}
