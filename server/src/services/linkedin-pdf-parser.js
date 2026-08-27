import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pdf = require('pdf-parse');
if (typeof pdf !== 'function' && pdf.default) {
  pdf = pdf.default;
}

function shouldJoinLines(line1, line2) {
  const headingLower = line1.toLowerCase();
  if (['contact', 'skills', 'top skills', 'languages', 'certifications', 'summary', 'about', 'experience', 'education', 'projects'].includes(headingLower)) {
    return { join: false };
  }

  const combined = (line1 + line2).replace(/\s+/g, '');
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailRegex.test(combined) && !line1.includes(' ') && !line2.includes(' ')) {
    return { join: true, text: combined };
  }

  const isUrl1 = line1.includes('linkedin.com/in/') || line1.startsWith('www.') || line1.startsWith('http');
  if (isUrl1 && !line1.includes(' ') && !line2.includes(' ')) {
    return { join: true, text: line1 + line2 };
  }

  if (line1.endsWith('-')) {
    return { join: true, text: line1.slice(0, -1) + line2 };
  }

  return { join: false };
}

export async function parseLinkedInPDF(buffer, overrideText = null) {
  let text = '';
  if (overrideText !== null) {
    text = overrideText;
  } else {
    const parser = new pdf.PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      text = result.text || '';
    } finally {
      await parser.destroy();
    }
  }

  // Normalize Unicode control/space characters
  text = text.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');
  
  // 1. Page-aware line normalization
  const pages = text.split(/\f/);
  const rawLines = [];
  pages.forEach((pageText, pageIdx) => {
    const pageLines = pageText.split('\n').map(line => line.trim()).filter(Boolean);
    pageLines.forEach((lineText, lineIdx) => {
      rawLines.push({
        page: pageIdx + 1,
        line: lineIdx + 1,
        rawText: lineText,
        normalizedText: lineText.trim()
      });
    });
  });

  // Filter out headers/footers
  const filteredLines = rawLines.filter(item => {
    const txt = item.normalizedText;
    return !(/^page\s+\d+/i.test(txt) || /^\d+\s+of\s+\d+$/i.test(txt) || /^linkedin\s+profile\s+pdf/i.test(txt));
  });

  // Line reconstruction layer
  const lines = [];
  for (let i = 0; i < filteredLines.length; i++) {
    const curr = filteredLines[i];
    if (i + 1 < filteredLines.length) {
      const next = filteredLines[i + 1];
      const joinResult = shouldJoinLines(curr.normalizedText, next.normalizedText);
      if (joinResult.join) {
        lines.push({
          page: curr.page,
          line: curr.line,
          rawText: curr.rawText + ' ' + next.rawText,
          normalizedText: joinResult.text
        });
        i++; // skip next line
        continue;
      }
    }
    lines.push(curr);
  }

  // Section detector headings
  const SECTION_HEADINGS = {
    'contact': 'CONTACT',
    'top skills': 'SKILLS',
    'skills': 'SKILLS',
    'certifications': 'CERTIFICATIONS',
    'projects': 'PROJECTS',
    'languages': 'LANGUAGES',
    'summary': 'SUMMARY',
    'about': 'SUMMARY',
    'experience': 'EXPERIENCE',
    'education': 'EDUCATION'
  };

  // Find the start of the main column (first main section heading)
  let firstMainHeadingIdx = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const txt = lines[i].normalizedText.toLowerCase();
    if (txt === 'summary' || txt === 'about' || txt === 'experience' || txt === 'education') {
      firstMainHeadingIdx = i;
      break;
    }
  }

  // Extract email and profileUrl globally since they are highly unique patterns
  let email = '';
  let profileUrl = '';
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const linkedinRegex = /(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-%\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+/g;

  lines.forEach(l => {
    const txt = l.normalizedText;
    const matchEmail = txt.match(emailRegex);
    if (matchEmail && !email) {
      email = matchEmail[0].trim();
    }
    const matchUrl = txt.match(linkedinRegex);
    if (matchUrl && !profileUrl) {
      profileUrl = matchUrl[0].trim();
      if (!profileUrl.startsWith('http')) {
        profileUrl = `https://${profileUrl}`;
      }
    }
  });

  // Extract linkedinId from URL
  let linkedinId = '';
  if (profileUrl) {
    linkedinId = profileUrl.split('/in/')[1]?.split('/')[0]?.split('?')[0]?.trim() || '';
  }

  // Candidate scoring for name extraction
  function scoreNameCandidate(lineText, targetSlug = '', targetEmailUser = '') {
    const text = lineText.trim();
    const lower = text.toLowerCase();

    if (!text) return -1000;
    if (lower.includes('@') || lower.includes('linkedin.com') || lower.includes('http') || lower.includes('www.')) return -1000;
    if (SECTION_HEADINGS[lower]) return -1000;

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return -1000;

    let score = 0;

    // Person names are typically 2 to 3 words
    if (words.length === 2 || words.length === 3) {
      score += 40;
    } else if (words.length === 4) {
      score += 20;
    } else if (words.length === 1) {
      score -= 10;
    } else {
      score -= 30;
    }

    const nameParts = lower.split(/[^a-z]/).filter(p => p.length >= 3);
    let slugMatchCount = 0;
    let emailMatchCount = 0;

    if (nameParts.length > 0) {
      nameParts.forEach(part => {
        if (targetSlug && targetSlug.toLowerCase().includes(part)) slugMatchCount++;
        if (targetEmailUser && targetEmailUser.toLowerCase().includes(part)) emailMatchCount++;
      });

      if (slugMatchCount > 0 || emailMatchCount > 0) {
        score += 150;
        score += (slugMatchCount + emailMatchCount) * 10;
      }
    }

    const locationKeywords = ['india', 'area', 'united states', 'usa', 'uk', 'london', 'bengaluru', 'bangalore', 'noida', 'delhi', 'mumbai', 'san francisco', 'bay area', 'california', 'new york', 'germany', 'singapore', 'ncr', 'district', 'county', 'region', 'city'];
    const headlineKeywords = ['engineer', 'developer', 'manager', 'lead', 'director', 'vice president', 'vp', 'architect', 'analyst', 'consultant', 'specialist', 'intern', 'student', 'fellow', 'head', 'founder', 'co-founder', 'ceo', 'cto', 'cfo', 'executive', 'officer', 'scientist', 'researcher', 'designer', 'writer', 'hiring', 'recruiter', 'talent', 'ex-', 'adobe', 'google', 'microsoft', 'amazon', 'meta', 'apple', 'netflix', 'uber', 'salesforce'];
    const certificationKeywords = [
      'certified', 'certification', 'license', 'credential', 'aws', 'gcp', 'azure', 'cisco', 'oracle', 'java', 'python', 'scrum', 'agile', 'pmp',
      'course', 'training', 'network', 'networks', 'learning', 'deep', 'machine', 'data', 'science', 'database', 'development', 'programming', 
      'software', 'introduction', 'basics', 'advanced', 'systems', 'cloud', 'architecture', 'security', 'foundations'
    ];

    const locationMatch = locationKeywords.some(kw => lower.includes(kw));
    if (locationMatch) score -= 40;

    const headlineMatch = headlineKeywords.some(kw => lower.includes(kw));
    if (headlineMatch) score -= 30;

    const certificationMatch = certificationKeywords.some(kw => lower.includes(kw));
    if (certificationMatch) score -= 40;

    const isCapitalized = words.every(w => /^[A-Z]/.test(w));
    if (isCapitalized) score += 20;

    return score;
  }

  const emailUser = email ? email.split('@')[0] : '';
  const candidates = [];
  const searchStartIdx = Math.max(0, firstMainHeadingIdx - 5);
  for (let i = searchStartIdx; i < firstMainHeadingIdx; i++) {
    let score = scoreNameCandidate(lines[i].normalizedText, linkedinId, emailUser);
    
    // Heuristic: boost candidate if the immediately following line looks like a headline or location
    if (i + 1 < firstMainHeadingIdx) {
      const nextLineLower = lines[i + 1].normalizedText.toLowerCase();
      const locationKeywords = ['india', 'area', 'united states', 'usa', 'uk', 'london', 'bengaluru', 'bangalore', 'noida', 'delhi', 'mumbai', 'san francisco', 'bay area', 'california', 'new york', 'germany', 'singapore', 'ncr', 'district', 'county', 'region', 'city'];
      const headlineKeywords = ['engineer', 'developer', 'manager', 'lead', 'director', 'vice president', 'vp', 'architect', 'analyst', 'consultant', 'specialist', 'intern', 'student', 'fellow', 'head', 'founder', 'co-founder', 'ceo', 'cto', 'cfo', 'executive', 'officer', 'scientist', 'researcher', 'designer', 'writer', 'hiring', 'recruiter', 'talent', 'ex-', 'adobe', 'google', 'microsoft', 'amazon', 'meta', 'apple', 'netflix', 'uber', 'salesforce'];
      
      const nextIsHeadline = headlineKeywords.some(kw => nextLineLower.includes(kw)) || nextLineLower.includes('@') || nextLineLower.includes('||') || nextLineLower.includes('|');
      const nextIsLocation = locationKeywords.some(kw => nextLineLower.includes(kw)) || nextLineLower.includes(',');
      
      if (nextIsHeadline || nextIsLocation) {
        score += 30;
      }
    }

    candidates.push({ index: i, line: lines[i], score });
  }

  candidates.sort((a, b) => b.score - a.score);

  let name = '';
  let nameIdx = -1;
  if (candidates.length > 0 && candidates[0].score > -100) {
    name = candidates[0].line.rawText;
    nameIdx = candidates[0].index;
  }

  // Fallback to first non-contact line if no candidate matched
  if (!name) {
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].normalizedText.toLowerCase();
      if (
        lower.includes('(linkedin)') ||
        lower.includes('linkedin.com') ||
        lower.includes('@') ||
        SECTION_HEADINGS[lower]
      ) {
        continue;
      }
      name = lines[i].rawText;
      nameIdx = i;
      break;
    }
  }

  let headline = '';
  let location = '';
  if (nameIdx !== -1) {
    const diff = firstMainHeadingIdx - nameIdx;
    if (diff === 3) {
      headline = lines[nameIdx + 1].rawText;
      location = lines[nameIdx + 2].rawText;
    } else if (diff === 2) {
      const nextLine = lines[nameIdx + 1].normalizedText.toLowerCase();
      const locationKeywords = ['india', 'area', 'united states', 'usa', 'uk', 'london', 'bengaluru', 'bangalore', 'noida', 'delhi', 'mumbai', 'san francisco', 'bay area', 'california', 'new york', 'germany', 'singapore', 'ncr', 'district', 'county', 'region', 'city'];
      const hasLocationWord = locationKeywords.some(kw => nextLine.includes(kw)) || nextLine.includes(',');
      if (hasLocationWord) {
        location = lines[nameIdx + 1].rawText;
      } else {
        headline = lines[nameIdx + 1].rawText;
      }
    } else if (diff > 3) {
      const headlineParts = [];
      for (let k = nameIdx + 1; k < firstMainHeadingIdx - 1; k++) {
        headlineParts.push(lines[k].rawText);
      }
      headline = headlineParts.join(' ');
      location = lines[firstMainHeadingIdx - 1].rawText;
    }
  }

  // 2. Section state machine routing (second pass)
  let activeSection = 'NONE';
  const sectionContent = {
    CONTACT: [],
    SKILLS: [],
    CERTIFICATIONS: [],
    PROJECTS: [],
    LANGUAGES: [],
    SUMMARY: [],
    EXPERIENCE: [],
    EDUCATION: []
  };

  for (let i = 0; i < lines.length; i++) {
    const lineObj = lines[i];
    const textLower = lineObj.normalizedText.toLowerCase();

    if (SECTION_HEADINGS[textLower]) {
      activeSection = SECTION_HEADINGS[textLower];
      continue;
    }

    // Skip Name, Headline, and Location to prevent leakage into sidebar sections
    if (nameIdx !== -1 && i >= nameIdx && i < firstMainHeadingIdx) {
      continue;
    }

    if (activeSection !== 'NONE') {
      sectionContent[activeSection].push({ ...lineObj, originalIndex: i });
    }
  }

  // Extract Contact links (excluding main LinkedIn profile)
  const contact = {
    email: email || '',
    phone: '',
    linkedinUrl: profileUrl || '',
    linkedinId: linkedinId || '',
    otherLinks: []
  };
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  sectionContent.CONTACT.forEach(l => {
    const txt = l.normalizedText;
    const phones = txt.match(phoneRegex);
    if (phones && !contact.phone) {
      contact.phone = phones[0];
    }
    const generalUrlRegex = /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi;
    const urls = txt.match(generalUrlRegex);
    if (urls) {
      urls.forEach(u => {
        if (!u.toLowerCase().includes('linkedin.com') && !contact.otherLinks.includes(u)) {
          contact.otherLinks.push(u);
        }
      });
    }
  });

  // Parse Skills
  const skills = sectionContent.SKILLS.map(l => {
    return l.normalizedText.replace(/^[•\-*]\s*/, '').trim();
  }).filter(Boolean);

  // Parse Certifications
  const certifications = sectionContent.CERTIFICATIONS.map(l => {
    return l.normalizedText.replace(/^[•\-*]\s*/, '').trim();
  }).filter(Boolean);

  // Parse Languages
  const languages = sectionContent.LANGUAGES.map(l => {
    return l.normalizedText.replace(/^[•\-*]\s*/, '').trim();
  }).filter(Boolean);

  // Parse Summary
  const summary = sectionContent.SUMMARY.map(l => l.rawText).join('\n').trim();

  // Parse Projects
  const projects = sectionContent.PROJECTS.map(l => l.normalizedText).filter(Boolean);

  // Parse Education
  const education = [];
  let currentEdu = null;
  sectionContent.EDUCATION.forEach(l => {
    const txt = l.normalizedText;
    const isYearRange = /^\d{4}\s*[-–—]\s*(?:\d{4}|present)$/i.test(txt) || /^\d{4}$/.test(txt);
    const isDegree = /bachelor|master|btech|mtech|phd|diploma|degree|high school/i.test(txt);
    const isInstitution = !isYearRange && !isDegree;

    const schoolKeywords = /school|university|college|institute|academy|polytechnic|bits|nit|iit|sastra/i;
    const isNewInstitution = isInstitution && (
      !currentEdu ||
      schoolKeywords.test(txt) ||
      (currentEdu.startYear || currentEdu.endYear)
    );

    if (isNewInstitution) {
      if (currentEdu) {
        education.push(currentEdu);
      }
      currentEdu = {
        institution: txt,
        degree: '',
        field: '',
        startYear: '',
        endYear: ''
      };
    } else if (currentEdu) {
      if (isYearRange) {
        const years = txt.split(/[-–—]/).map(y => y.trim());
        currentEdu.startYear = years[0];
        currentEdu.endYear = years[1] || '';
      } else {
        if (currentEdu.degree) {
          currentEdu.field = txt;
        } else {
          currentEdu.degree = txt;
        }
      }
    }
  });
  if (currentEdu) {
    education.push(currentEdu);
  }

  // Parse Experience (supporting en-dash, em-dash and prevention of company override in promotion/multi-role flows)
  const experiences = [];
  const dateRangeRegex = /(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\s*[-–—]\s*(?:present|(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{4})/i;
  const yearRangeRegex = /^\d{4}\s*[-–—]\s*(?:present|\d{4})/i;
  
  let currentCompany = '';
  let currentCompanyDuration = '';
  const expLines = sectionContent.EXPERIENCE;

  for (let j = 0; j < expLines.length; j++) {
    const line = expLines[j].normalizedText;
    const isDate = dateRangeRegex.test(line) || yearRangeRegex.test(line);

    if (isDate) {
      const roleTitle = j > 0 ? expLines[j - 1].rawText : 'Unknown Title';
      const dateRange = line;
      let roleLocation = '';
      let nextIdx = j + 1;

      if (nextIdx < expLines.length) {
        const nextLine = expLines[nextIdx].normalizedText;
        const isLocation = nextLine.length < 50 && (
          nextLine.toLowerCase().includes('remote') ||
          nextLine.toLowerCase().includes('india') ||
          nextLine.toLowerCase().includes('area') ||
          /, [a-zA-Z\s]+$/.test(nextLine)
        );
        if (isLocation) {
          roleLocation = expLines[nextIdx].rawText;
          nextIdx++;
        }
      }

      const descriptionLines = [];
      while (nextIdx < expLines.length) {
        const lookahead = expLines[nextIdx].normalizedText;
        const lookaheadIsDate = dateRangeRegex.test(lookahead) || yearRangeRegex.test(lookahead);
        if (lookaheadIsDate) break;

        const lookaheadIsDuration = /^\d+\s+years?\s*(?:\d+\s+months?)?$/i.test(lookahead) || /^\d+\s+months?$/i.test(lookahead) || /less than a year/i.test(lookahead);
        if (lookaheadIsDuration) break;

        descriptionLines.push(expLines[nextIdx].rawText);
        nextIdx++;
      }

      let company = currentCompany;
      if (j > 1) {
        const prevPrev = expLines[j - 2].normalizedText;
        const isPrevPrevDuration = /^\d+\s+years?\s*(?:\d+\s+months?)?$/i.test(prevPrev) || /^\d+\s+months?$/i.test(prevPrev) || /less than a year/i.test(prevPrev);
        if (isPrevPrevDuration && j > 2) {
          company = expLines[j - 3].rawText;
          currentCompany = company;
          currentCompanyDuration = prevPrev;
        } else if (!isPrevPrevDuration) {
          const prevPrevIsWord = prevPrev.length > 0 && prevPrev.length < 50;
          let isNewCompany = prevPrevIsWord;
          if (prevPrevIsWord && j > 2) {
            const lineBeforePrevPrev = expLines[j - 3].normalizedText;
            const lineBeforeIsDateOrDuration = dateRangeRegex.test(lineBeforePrevPrev) || yearRangeRegex.test(lineBeforePrevPrev) || /^\d+\s+years?\s*(?:\d+\s+months?)?$/i.test(lineBeforePrevPrev) || /^\d+\s+months?$/i.test(lineBeforePrevPrev) || /less than a year/i.test(lineBeforePrevPrev);
            
            const locationKeywords = ['india', 'area', 'united states', 'usa', 'uk', 'london', 'bengaluru', 'bangalore', 'noida', 'delhi', 'mumbai', 'san francisco', 'bay area', 'california', 'new york', 'germany', 'singapore', 'ncr', 'district', 'county', 'region', 'city'];
            const prevPrevIsLocation = locationKeywords.some(kw => prevPrev.toLowerCase().includes(kw)) || prevPrev.includes(',');
            
            if (lineBeforeIsDateOrDuration || prevPrevIsLocation) {
              isNewCompany = false;
            }
          }
          if (isNewCompany) {
            company = expLines[j - 2].rawText;
            currentCompany = company;
          }
        }
      }

      let cleanCompany = company || 'Unknown Company';
      let cleanLocation = roleLocation;
      const separatorRegex = /&middot;|·|•|\||\s+-\s+|\s+–\s+/;
      if (cleanCompany && separatorRegex.test(cleanCompany)) {
        const parts = cleanCompany.split(separatorRegex);
        cleanCompany = parts[0].trim();
        if (!cleanLocation && parts[1]) {
          cleanLocation = parts.slice(1).join(' ').trim();
        }
      }

      experiences.push({
        company: cleanCompany,
        title: roleTitle,
        dateRange,
        location: cleanLocation || '',
        description: descriptionLines.join('\n').trim()
      });

      j = nextIdx - 1;
    } else {
      const isDuration = /^\d+\s+years?\s*(?:\d+\s+months?)?$/i.test(line) || /^\d+\s+months?$/i.test(line) || /less than a year/i.test(line);
      if (isDuration && j > 0) {
        currentCompany = expLines[j - 1].rawText;
        currentCompanyDuration = line;
      }
    }
  }

  let company = null;
  let title = null;
  if (experiences.length > 0) {
    company = experiences[0].company;
    title = experiences[0].title;
  } else if (headline) {
    const atMatch = headline.match(/(.+?)\s+(?:at|@)\s+(.+)/i);
    if (atMatch) {
      title = atMatch[1].trim();
      company = atMatch[2].trim();
    } else {
      title = headline;
    }
  }

  const separatorRegex = /&middot;|·|•|\||\s+-\s+|\s+–\s+/;
  if (company && separatorRegex.test(company)) {
    const parts = company.split(separatorRegex);
    company = parts[0].trim();
    if (!location && parts[1]) {
      location = parts.slice(1).join(' ').trim();
    }
  }

  const confidence = {
    name: name && name !== 'Unknown' ? 0.99 : 0.0,
    email: email ? 0.99 : 0.0,
    profileUrl: profileUrl ? 0.99 : 0.0,
    skills: skills.length > 0 ? 0.95 : 0.0,
    experience: experiences.length > 0 ? 0.9 : 0.0,
    education: education.length > 0 ? 0.9 : 0.0
  };

  const validation = {
    nameValid: name && name !== 'Unknown' && name.length >= 2,
    emailValid: email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : false,
    profileUrlValid: profileUrl ? profileUrl.includes('linkedin.com') : false,
    hasExperience: experiences.length > 0,
    hasSkills: skills.length > 0
  };

  const reviewRequired = !validation.nameValid || !validation.hasExperience;

  return {
    name: name || 'Unknown',
    email: email || null,
    profileUrl: profileUrl || null,
    linkedinId: linkedinId || null,
    headline: headline || null,
    location: location || null,
    company,
    title,
    skills: skills.length > 0 ? skills : null,
    languages: languages.length > 0 ? languages : null,
    certifications: certifications.length > 0 ? certifications : null,
    profileSummary: summary || null,
    externalLinks: contact.otherLinks.length > 0 ? contact.otherLinks : null,
    experience: experiences,
    education,
    projects,
    confidence,
    validation,
    reviewRequired
  };
}
