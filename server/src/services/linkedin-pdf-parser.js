import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pdf = require('pdf-parse');
if (typeof pdf !== 'function' && pdf.default) {
  pdf = pdf.default;
}

export async function parseLinkedInPDF(buffer) {
  const parser = new pdf.PDFParse({ data: buffer });
  let text = '';
  try {
    const result = await parser.getText();
    text = result.text || '';
  } finally {
    await parser.destroy();
  }
  
  // Clean text lines
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  
  let name = '';
  let email = '';
  let profileUrl = '';
  let headline = '';
  let skills = [];
  let profileSummary = '';
  let externalLinks = [];

  // 1. Extract Name & Headline
  // Typically, name is the very first line or top line, followed by the headline.
  if (lines.length > 0) {
    name = lines[0];
    
    // Find headline (often line 2, but make sure it isn't a section header like "Contact" or "Summary")
    if (lines.length > 1 && !['contact', 'summary', 'skills', 'experience', 'education'].includes(lines[1].toLowerCase())) {
      headline = lines[1];
    }
  }

  // 2. Extract Email and LinkedIn Profile URL
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const linkedinRegex = /(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-%\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+/g;
  
  const allEmails = text.match(emailRegex) || [];
  if (allEmails.length > 0) {
    email = allEmails[0];
  }

  const allUrls = text.match(linkedinRegex) || [];
  if (allUrls.length > 0) {
    profileUrl = allUrls[0];
    // Clean trailing or leading spaces
    if (!profileUrl.startsWith('http')) {
      profileUrl = `https://${profileUrl}`;
    }
  }

  // 3. Extract Links
  const generalUrlRegex = /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;
  const matches = text.match(generalUrlRegex) || [];
  externalLinks = Array.from(new Set(matches)).filter(url => !url.includes('linkedin.com/in/'));

  // 4. Extract Summary
  const summaryIdx = lines.findIndex(l => l.toLowerCase() === 'summary' || l.toLowerCase() === 'about');
  if (summaryIdx !== -1) {
    const summaryLines = [];
    for (let i = summaryIdx + 1; i < lines.length; i++) {
      const nextLine = lines[i];
      if (['experience', 'skills', 'education', 'languages', 'projects', 'certifications', 'contact'].includes(nextLine.toLowerCase())) {
        break;
      }
      summaryLines.push(nextLine);
    }
    profileSummary = summaryLines.join(' ');
  }

  // 5. Extract Skills
  const skillsIdx = lines.findIndex(l => l.toLowerCase() === 'top skills' || l.toLowerCase() === 'skills');
  if (skillsIdx !== -1) {
    for (let i = skillsIdx + 1; i < lines.length; i++) {
      const nextLine = lines[i];
      if (['experience', 'summary', 'education', 'languages', 'projects', 'certifications', 'contact', 'about'].includes(nextLine.toLowerCase())) {
        break;
      }
      // Clean up common bullet prefixes
      const cleaned = nextLine.replace(/^[•\-*]\s*/, '').trim();
      if (cleaned) {
        skills.push(cleaned);
      }
    }
  }

  // Fallback to name extraction if name is missing or matches contact keyword
  if (!name || name.toLowerCase() === 'contact') {
    // Look for first line that is not a section heading or email/url
    name = lines.find(l => {
      const lower = l.toLowerCase();
      return !['contact', 'summary', 'skills', 'experience', 'education', 'about'].includes(lower) && 
             !lower.includes('@') && 
             !lower.includes('linkedin.com');
    }) || 'Unknown Contact';
  }

  let company = null;
  let title = null;
  if (headline) {
    const atMatch = headline.match(/(.+?)\s+(?:at|@)\s+(.+)/i);
    if (atMatch) {
      title = atMatch[1].trim();
      company = atMatch[2].trim();
    } else {
      title = headline;
    }
  }

  return {
    name: name || 'Unknown',
    email: email || null,
    profileUrl: profileUrl || null,
    headline: headline || null,
    company,
    title,
    skills: skills.length > 0 ? skills : null,
    profileSummary: profileSummary || null,
    externalLinks: externalLinks.length > 0 ? externalLinks : null
  };
}
