import Joi from 'joi';
import { aiService } from './ai/ai.service.js';
import { env } from '../config/env.js';

const JOB_KEYWORDS = [
  'hiring', 'vacancy', 'open position', 'recruiting', 'jd', 'job description',
  'opportunity', 'role', 'apply', 'careers', 'salary', 'experience', 'skills'
];

const CONVERSATION_TOKENS = [
  'good morning', 'good afternoon', 'hello', 'hi team', 'how are you',
  'thank you', 'thanks', 'please help', 'anyone here', 'discuss'
];

export const telegramJobExtractionSchema = Joi.object({
  title: Joi.string().allow('', null).default(''),
  companyName: Joi.string().allow('', null).default(''),
  location: Joi.string().allow('', null).default(''),
  jobUrl: Joi.string().allow('', null).default(''),
  contactEmail: Joi.string().allow('', null).default(''),
  experience: Joi.string().allow('', null).default(''),
  salary: Joi.string().allow('', null).default(''),
  employmentType: Joi.string().valid('full-time', 'part-time', 'contract', 'internship', '').default(''),
  remoteType: Joi.string().valid('remote', 'hybrid', 'onsite', '').default(''),
  skills: Joi.array().items(Joi.string()).default([]),
  summary: Joi.string().allow('', null).default(''),
  isJobPosting: Joi.boolean().default(true),
  confidence: Joi.number().min(0).max(1).default(0.9)
});

function buildTelegramJobPrompt(text) {
  return `You are an expert AI recruiting coordinator. Analyze the following Telegram message or job posting text:

--- BEGIN TEXT ---
${text}
--- END TEXT ---

Extract key structured job information accurately regardless of whether the post is very short, informal, or a long multi-paragraph description.

Rules:
1. "title": Clean job title (e.g. "Senior React Developer", "Software Engineer", "Competitive Programmer"). Exclude emojis, "Hiring:", "Opportunity Alert", etc.
2. "companyName": Name of the hiring company or startup (e.g. "Google", "Stripe", "micro1", "Acme Corp"). If not explicitly mentioned, check email domain or URLs.
3. "location": Primary work location or city/country (e.g. "Bangalore", "San Francisco, CA", "Remote").
4. "jobUrl": Any direct web application link or URL present.
5. "contactEmail": Any HR or recruiter contact email address present.
6. "experience": Required experience range (e.g. "2-4 years", "5+ yrs", "Freshers").
7. "salary": Compensation, salary range, or hourly rate (e.g. "$40 - $80 per hour", "12-18 LPA", "$140,000").
8. "employmentType": One of ['full-time', 'part-time', 'contract', 'internship', ''].
9. "remoteType": One of ['remote', 'hybrid', 'onsite', ''].
10. "skills": Array of relevant skills or technologies required (e.g. ["Node.js", "React", "AWS"]).
11. "summary": Concise 1-2 sentence summary of the role.
12. "isJobPosting": boolean (true if this text is a job opening/hiring announcement, false if generic discussion).
13. "confidence": Number between 0.0 and 1.0 indicating confidence in extracted fields.

Return JSON strictly matching the schema.`;
}

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
 * Parses raw text message to extract job fields and calculate confidence (Heuristic Fallback)
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
  const salaryMatch = text.match(/(?:salary|package|compensation|lpa|\$)\s*[:\-]?\s*([\d\w\s,.\-+/]+(?:\s*per\s*hour|\s*lpa|\/hr|\/yr)?)(?=\n|$)/i);
  if (salaryMatch) {
    salary = salaryMatch[1].trim();
  }

  // 6. Extract Skills
  const commonSkills = [
    'Node.js', 'React', 'Python', 'PostgreSQL', 'AWS', 'Java', 'Javascript',
    'TypeScript', 'Vue', 'Angular', 'Go', 'Golang', 'Rust', 'Docker', 'Kubernetes',
    'C++', 'Ruby', 'Rails', 'Kotlin', 'Swift', 'Flutter', 'HTML', 'CSS', 'SQL',
    'gRPC', 'Distributed Systems'
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
    const titleMatch = line.match(/(?:role(?:\s*name)?|title|position|job\s*role|job\s*title)\s*[:\-]\s*(.+)/i);
    if (titleMatch && !title) {
      title = titleMatch[1].trim();
    }

    const companyMatch = line.match(/(?:company(?:\s*name)?|organization|employer)\s*[:\-]\s*(.+)/i);
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
        title = firstLine.replace(/🚀|🔥|📢/g, '').replace(/^hiring[:\s]*/i, '').trim();
      }
    }
  }

  if (!companyName) {
    const companyFallback = text.match(/(?:hiring by|at|join|team|@)\s+([A-Z][a-zA-Z0-9\s.]{1,20})(?=\s+|$)/);
    if (companyFallback) {
      companyName = companyFallback[1].trim();
    } else if (contactEmail) {
      const domain = contactEmail.split('@')[1];
      if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain.toLowerCase())) {
        const namePart = domain.split('.')[0];
        companyName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      }
    }
  }

  if (!location) {
    const cities = ['Bangalore', 'Bengaluru', 'Pune', 'Noida', 'Gurugram', 'Hyderabad', 'Mumbai', 'Delhi', 'New York', 'San Francisco', 'NYC', 'London', 'Remote'];
    for (const city of cities) {
      if (lower.includes(city.toLowerCase())) {
        location = city === 'bengaluru' ? 'Bangalore' : city;
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
      location: location || (remoteType === 'remote' ? 'Remote' : 'Location Not Specified'),
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

/**
 * Async parsing function that leverages AI structured extraction when available,
 * falling back to heuristic parsing when AI is disabled or fails.
 */
export async function parseTelegramJobAsync(text) {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const detectedEmail = emailMatch ? emailMatch[0] : '';

  const urlMatch = text.match(/https?:\/\/[^\s]+(?=\b|$)/);
  const detectedUrl = urlMatch ? urlMatch[0] : '';

  if (env.aiEnabled) {
    try {
      const prompt = buildTelegramJobPrompt(text);
      const aiResult = await aiService.generateStructured(prompt, telegramJobExtractionSchema, {
        operation: 'telegram_job_parse',
        promptVersion: 1,
        schemaVersion: 1
      });

      if (aiResult && aiResult.isJobPosting !== false) {
        const cleanTitle = (aiResult.title || '').replace(/^[\s🚀🔥📢]*hiring[:\s]*/i, '').trim();
        const companyName = aiResult.companyName || '';
        const location = aiResult.location || '';
        const jobUrl = aiResult.jobUrl || detectedUrl;
        const contactEmail = aiResult.contactEmail || detectedEmail;
        const experience = aiResult.experience || '';
        const salary = aiResult.salary || '';
        const employmentType = aiResult.employmentType || '';
        const remoteType = aiResult.remoteType || '';
        const skills = Array.isArray(aiResult.skills) ? aiResult.skills : [];

        let finalCompany = companyName;
        if ((!finalCompany || finalCompany.toLowerCase() === 'unknown company') && contactEmail) {
          const domain = contactEmail.split('@')[1];
          if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain.toLowerCase())) {
            const namePart = domain.split('.')[0];
            finalCompany = namePart.charAt(0).toUpperCase() + namePart.slice(1);
          }
        }

        let confidence = aiResult.confidence !== undefined ? aiResult.confidence : 0.85;
        if (!cleanTitle || cleanTitle.toLowerCase() === 'unknown role') confidence -= 0.3;
        if (!finalCompany || finalCompany.toLowerCase() === 'unknown company') confidence -= 0.2;

        return {
          parsedJob: {
            title: cleanTitle || 'Unknown Role',
            companyName: finalCompany || 'Unknown Company',
            location: location || (remoteType === 'remote' ? 'Remote' : 'Location Not Specified'),
            jobUrl: jobUrl || detectedUrl,
            contactEmail: contactEmail || detectedEmail,
            experience,
            salary,
            employmentType,
            remoteType,
            skills,
            summary: aiResult.summary || ''
          },
          confidence: Math.max(0, Math.min(1, confidence))
        };
      }
    } catch (err) {
      console.warn('[TelegramJobParser] AI parsing failed, using heuristic fallback:', err.message);
    }
  }

  return parseTelegramJob(text);
}

