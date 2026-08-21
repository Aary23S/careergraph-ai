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

  // 1. Extract Email and LinkedIn Profile URL first so we can use them for name matching
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const linkedinRegex = /(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-%\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+/g;
  
  const allEmails = text.match(emailRegex) || [];
  if (allEmails.length > 0) {
    email = allEmails[0];
  }

  const allUrls = text.match(linkedinRegex) || [];
  if (allUrls.length > 0) {
    profileUrl = allUrls[0];
    if (!profileUrl.startsWith('http')) {
      profileUrl = `https://${profileUrl}`;
    }
  }

  // Extract name components from handle slug or email
  let slugWords = [];
  if (profileUrl) {
    const slug = profileUrl.split('/in/')[1]?.split('/')[0]?.split('?')[0] || '';
    slugWords = slug.toLowerCase().split(/[^a-z0-9]/).filter(w => w.length >= 3 && !/^\d+$/.test(w));
  }
  if (slugWords.length === 0 && email) {
    const emailUser = email.split('@')[0] || '';
    slugWords = emailUser.toLowerCase().split(/[^a-z0-9]/).filter(w => w.length >= 3 && !/^\d+$/.test(w));
  }

  // 2. Extract Name & Headline using component heuristics
  let nameIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    
    if (
      lower.includes('(linkedin)') ||
      lower.includes('linkedin.com') ||
      lower.includes('@') ||
      ['contact', 'summary', 'skills', 'experience', 'education', 'about', 'top skills'].includes(lower) ||
      /page\s+\d+/i.test(lower)
    ) {
      continue;
    }
    
    // Match against slug component words if available
    if (slugWords.length > 0) {
      const matchesSlug = slugWords.some(w => lower.includes(w));
      if (!matchesSlug) {
        continue;
      }
    }
    
    name = line;
    nameIdx = i;
    break;
  }

  // Fallback to first non-excluded line if slug match fails
  if (!name || name === 'Unknown Contact') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();
      
      if (
        lower.includes('(linkedin)') ||
        lower.includes('linkedin.com') ||
        lower.includes('@') ||
        ['contact', 'summary', 'skills', 'experience', 'education', 'about', 'top skills'].includes(lower) ||
        /page\s+\d+/i.test(lower)
      ) {
        continue;
      }
      
      name = line;
      nameIdx = i;
      break;
    }
  }
  
  if (!name) {
    name = 'Unknown Contact';
  }

  // Extract Headline (first valid line immediately following the name)
  if (nameIdx !== -1 && nameIdx + 1 < lines.length) {
    for (let i = nameIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();
      
      if (
        lower.includes('(linkedin)') ||
        lower.includes('linkedin.com') ||
        lower.includes('@') ||
        ['contact', 'summary', 'skills', 'experience', 'education', 'about', 'top skills'].includes(lower) ||
        /page\s+\d+/i.test(lower)
      ) {
        continue;
      }
      
      headline = line;
      break;
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

  // 5. Extract Skills (bounded so profile details don't bleed in)
  const skillsIdx = lines.findIndex(l => l.toLowerCase() === 'top skills' || l.toLowerCase() === 'skills');
  if (skillsIdx !== -1) {
    const endIdx = nameIdx !== -1 ? nameIdx : lines.length;
    for (let i = skillsIdx + 1; i < endIdx; i++) {
      const nextLine = lines[i];
      if (['experience', 'summary', 'education', 'languages', 'projects', 'certifications', 'contact', 'about'].includes(nextLine.toLowerCase())) {
        break;
      }
      const cleaned = nextLine.replace(/^[•\-*]\s*/, '').trim();
      if (cleaned) {
        skills.push(cleaned);
      }
    }
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
