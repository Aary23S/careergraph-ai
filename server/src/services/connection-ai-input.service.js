/**
 * Converts connection profile data into a clean, normalized text payload for AI prompts.
 * Explicitly separates current and historical experience to prevent timeline confusion.
 * 
 * @param {Object} connection Connection model instance
 * @returns {string} Plain text representation
 */
export function buildConnectionAiInput(connection) {
  const name = connection.name || 'Unknown';
  const headline = connection.headline || connection.title || '';
  const currentCompany = connection.company || '';
  const currentPosition = connection.title || '';
  const summary = connection.profileSummary || connection.notes || '';
  const skills = Array.isArray(connection.skills) ? connection.skills : [];

  // Parse experiences
  const experiences = Array.isArray(connection.experience) ? connection.experience : [];
  
  const currentRoles = [];
  const historicalRoles = [];

  // Use current fields on Connection as a primary current role indicator
  if (currentPosition || currentCompany) {
    currentRoles.push({
      title: currentPosition,
      company: currentCompany,
      dateRange: 'Present',
      description: ''
    });
  }

  experiences.forEach(exp => {
    const dateRangeStr = String(exp.dateRange || exp.date_range || '');
    const isCurrent = dateRangeStr && (
      dateRangeStr.toLowerCase().includes('present') || 
      dateRangeStr.toLowerCase().includes('active') ||
      dateRangeStr.toLowerCase().includes('current')
    );

    const roleInfo = {
      title: exp.title || '',
      company: exp.company || '',
      dateRange: dateRangeStr || '',
      description: exp.description || ''
    };

    // Prevent duplicate entries with the primary current role indicator
    const isDuplicate = currentRoles.some(r => 
      r.title.toLowerCase() === roleInfo.title.toLowerCase() && 
      r.company.toLowerCase() === roleInfo.company.toLowerCase()
    );

    if (isCurrent) {
      if (!isDuplicate) {
        currentRoles.push(roleInfo);
      }
    } else {
      historicalRoles.push(roleInfo);
    }
  });

  // Education
  const education = Array.isArray(connection.education) ? connection.education : [];
  const educList = education.map(edu => {
    const school = edu.school || edu.institution || 'School';
    const degree = edu.degree || edu.fieldOfStudy || 'Degree';
    return `- ${degree} at ${school} (${edu.dateRange || edu.date_range || ''})`;
  }).join('\n');

  // Certifications
  const certifications = Array.isArray(connection.certifications) ? connection.certifications : [];
  const certList = certifications.map(cert => {
    if (typeof cert === 'string') return `- ${cert}`;
    return `- ${cert.name || ''} (${cert.authority || cert.issuingOrg || ''})`;
  }).join('\n');

  // Build final structured prompt input
  let text = `Name: ${name}\n`;
  if (headline) text += `Headline: ${headline}\n`;
  if (summary) text += `Summary: ${summary}\n`;
  
  if (skills.length > 0) {
    text += `Skills: ${skills.join(', ')}\n`;
  }

  text += `\nCURRENT ROLES:\n`;
  if (currentRoles.length > 0) {
    currentRoles.forEach(r => {
      text += `- Title: ${r.title}\n  Company: ${r.company}\n  Period: ${r.dateRange}\n`;
      if (r.description) text += `  Description: ${r.description}\n`;
    });
  } else {
    text += `- None stated\n`;
  }

  text += `\nHISTORICAL EXPERIENCE:\n`;
  if (historicalRoles.length > 0) {
    historicalRoles.forEach(r => {
      text += `- Title: ${r.title}\n  Company: ${r.company}\n  Period: ${r.dateRange}\n`;
      if (r.description) text += `  Description: ${r.description}\n`;
    });
  } else {
    text += `- None stated\n`;
  }

  if (educList) {
    text += `\nEDUCATION:\n${educList}\n`;
  }
  if (certList) {
    text += `\nCERTIFICATIONS:\n${certList}\n`;
  }

  return text.trim();
}
