const JOB_KEYWORDS = [
  'hiring', 'vacancy', 'open position', 'recruiting', 'jd', 'job description',
  'opportunity', 'role', 'apply', 'careers', 'salary', 'experience', 'skills'
];

const CONVERSATION_TOKENS = [
  'good morning', 'good afternoon', 'hello', 'hi team', 'how are you',
  'thank you', 'thanks', 'please help', 'anyone here', 'discuss'
];

/**
 * Classifies an incoming text string as JOB, NON_JOB, or REVIEW_REQUIRED
 */
export function classifyMessage(text) {
  if (!text || text.trim().length < 15) {
    return 'NON_JOB';
  }

  const lower = text.toLowerCase();

  // If contains generic conversation and no job keywords, it's NON_JOB
  const hasConversation = CONVERSATION_TOKENS.some(token => lower.includes(token));
  const hasJobKeywords = JOB_KEYWORDS.some(kw => lower.includes(kw));

  if (hasConversation && !hasJobKeywords) {
    return 'NON_JOB';
  }

  if (!hasJobKeywords) {
    return 'NON_JOB';
  }

  // Strong job posting signals
  const hasTitleIndicator = /(role|title|position|hiring for)\s*:/i.test(lower) || /looking for/i.test(lower);
  const hasApplyIndicator = /(apply|link|email|contact|website)\s*:/i.test(lower) || /http/i.test(lower) || /@/i.test(lower);

  if (hasTitleIndicator && hasApplyIndicator) {
    return 'JOB';
  }

  // Ambiguous hiring message
  return 'REVIEW_REQUIRED';
}

/**
 * Parses raw text message to extract job fields and calculate confidence
 */
export function parseTelegramJob(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const lower = text.toLowerCase();

  let title = '';
  let companyName = '';
  let location = '';
  let jobUrl = '';
  let experience = '';
  let employmentType = '';
  let remoteType = '';
  const skills = [];
  let salary = '';
  let contactEmail = '';

  // 1. Extract email and URL
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    contactEmail = emailMatch[0];
  }

  const urlMatch = text.match(/https?:\/\/[^\s]+(?=\b|$)/);
  if (urlMatch) {
    jobUrl = urlMatch[0];
  }

  // 2. Extract Remote Type
  if (lower.includes('remote') || lower.includes('work from home') || lower.includes('wfh')) {
    remoteType = 'remote';
  } else if (lower.includes('hybrid')) {
    remoteType = 'hybrid';
  } else if (lower.includes('onsite') || lower.includes('office')) {
    remoteType = 'onsite';
  }

  // 3. Extract Employment Type
  if (lower.includes('full-time') || lower.includes('fulltime')) {
    employmentType = 'full-time';
  } else if (lower.includes('part-time') || lower.includes('parttime')) {
    employmentType = 'part-time';
  } else if (lower.includes('contract') || lower.includes('contractor')) {
    employmentType = 'contract';
  } else if (lower.includes('intern') || lower.includes('internship')) {
    employmentType = 'internship';
  }

  // 4. Extract Experience
  const expMatch = text.match(/(\d+[-+\s]*\d*\s*(?:years?|yrs?)(?:\s*exp)?)/i);
  if (expMatch) {
    experience = expMatch[1].trim();
  }

  // 5. Extract Salary
  const salaryMatch = text.match(/(?:salary|package|compensation|lpa|\$)\s*[:\-]?\s*([\d\w\s,.\-+/]+)(?=\n|$)/i);
  if (salaryMatch) {
    salary = salaryMatch[1].trim();
  }

  // 6. Extract Skills
  const commonSkills = [
    'Node.js', 'React', 'Python', 'PostgreSQL', 'AWS', 'Java', 'Javascript',
    'TypeScript', 'Vue', 'Angular', 'Go', 'Golang', 'Rust', 'Docker', 'Kubernetes',
    'C++', 'Ruby', 'Rails', 'Kotlin', 'Swift', 'Flutter', 'HTML', 'CSS', 'SQL'
  ];
  for (const skill of commonSkills) {
    const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const rx = new RegExp(`\\b${escaped}\\b`, 'i');
    if (rx.test(text)) {
      skills.push(skill);
    }
  }

  // 7. Parse Title, Company, Location line-by-line or with fallback key-values
  for (const line of lines) {
    const titleMatch = line.match(/(?:role|title|position)\s*[:\-]\s*(.+)/i);
    if (titleMatch && !title) {
      title = titleMatch[1].trim();
    }

    const companyMatch = line.match(/(?:company|organization|employer)\s*[:\-]\s*(.+)/i);
    if (companyMatch && !companyName) {
      companyName = companyMatch[1].trim();
    }

    const locMatch = line.match(/(?:location|loc)\s*[:\-]\s*(.+)/i);
    if (locMatch && !location) {
      location = locMatch[1].trim();
    }
  }

  // Fallbacks if structured headers were not found
  if (!title) {
    // Try matching common job title keywords
    const jobKeywordsRx = /\b(?:frontend|backend|fullstack|software|data|devops|product|qa|cloud)\s+(?:developer|engineer|designer|manager|analyst|intern)\b/i;
    const match = text.match(jobKeywordsRx);
    if (match) {
      title = match[0].trim();
    } else {
      // First line if not too long
      const firstLine = lines[0] || '';
      if (firstLine.length > 5 && firstLine.length < 50) {
        title = firstLine.replace(/🚀|🔥|📢/g, '').trim();
      }
    }
  }

  if (!companyName) {
    const companyFallback = text.match(/(?:hiring by|at|join|team)\s+([A-Z][a-zA-Z0-9\s.]{1,20})(?=\s+|$)/);
    if (companyFallback) {
      companyName = companyFallback[1].trim();
    }
  }

  if (!location) {
    const cities = ['Bangalore', 'Pune', 'Noida', 'Gurugram', 'Hyderabad', 'Mumbai', 'Delhi', 'Remote'];
    for (const city of cities) {
      if (lower.includes(city.toLowerCase())) {
        location = city;
        break;
      }
    }
  }

  // 8. Confidence calculation
  let confidence = 0.0;
  if (title) confidence += 0.4;
  if (companyName) confidence += 0.3;
  if (location) confidence += 0.1;
  if (jobUrl || contactEmail) confidence += 0.2;

  return {
    parsedJob: {
      title: title || 'Unknown Role',
      companyName: companyName || 'Unknown Company',
      location: location || 'Remote',
      jobUrl,
      experience,
      employmentType,
      remoteType,
      skills,
      salary,
      contactEmail
    },
    confidence
  };
}
