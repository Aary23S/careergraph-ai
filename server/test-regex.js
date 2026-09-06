import { extractSkillsFromText } from './src/services/intelligence.service.js';

const start = Date.now();
const hugeText = "javascript ".repeat(1000000); // ~11MB string
console.log('String created:', Date.now() - start);

const s2 = Date.now();
const skills = extractSkillsFromText(hugeText);
console.log('Skills extracted:', Date.now() - s2);
console.log(skills);
