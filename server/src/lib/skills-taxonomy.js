// Canonicalizes free-text skill labels so the same underlying skill (however
// a resume or job posting spells it) compares equal across extraction runs,
// resumes, and job postings. Alias keys must be lowercase/trimmed.
const SKILL_ALIASES = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  node: 'Node.js',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  reactjs: 'React',
  'react.js': 'React',
  react: 'React',
  vuejs: 'Vue',
  'vue.js': 'Vue',
  vue: 'Vue',
  angularjs: 'Angular',
  angular: 'Angular',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  pg: 'PostgreSQL',
  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  k8s: 'Kubernetes',
  kubernetes: 'Kubernetes',
  docker: 'Docker',
  py: 'Python',
  python: 'Python',
  golang: 'Go',
  go: 'Go',
  'c++': 'C++',
  cpp: 'C++',
  'c#': 'C#',
  csharp: 'C#',
  aws: 'AWS',
  gcp: 'GCP',
  'google cloud': 'GCP',
  azure: 'Azure',
  'ci/cd': 'CI/CD',
  cicd: 'CI/CD',
  html5: 'HTML',
  html: 'HTML',
  css3: 'CSS',
  css: 'CSS',
  express: 'Express',
  'express.js': 'Express',
  expressjs: 'Express',
  django: 'Django',
  flask: 'Flask',
  fastapi: 'FastAPI',
  graphql: 'GraphQL',
  sql: 'SQL',
  nosql: 'NoSQL',
  redis: 'Redis',
  jest: 'Jest',
  mocha: 'Mocha',
  cypress: 'Cypress',
};

function normalizeKey(rawSkill) {
  return String(rawSkill || '').trim().toLowerCase();
}

export function canonicalizeSkill(rawSkill) {
  const key = normalizeKey(rawSkill);
  if (!key) return '';
  if (SKILL_ALIASES[key]) return SKILL_ALIASES[key];
  const trimmed = String(rawSkill).trim();
  return trimmed;
}

export function canonicalizeSkillList(skills) {
  if (!Array.isArray(skills)) return [];
  const seen = new Set();
  const result = [];
  skills.forEach((skill) => {
    const canonical = canonicalizeSkill(skill);
    if (!canonical) return;
    const dedupeKey = canonical.toLowerCase();
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      result.push(canonical);
    }
  });
  return result;
}
