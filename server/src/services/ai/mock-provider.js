import { AIProvider } from './provider.js';

export class MockProvider extends AIProvider {
  constructor() {
    super();
    this.delayMs = 0;
  }

  async generateStructured(prompt) {
    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }
    const promptLower = prompt.toLowerCase();

    // Specific evaluation test cases
    if (promptLower.includes('senior backend engineer') || promptLower.includes('job-001') || promptLower.includes('software_engineering')) {
      return {
        roleCategory: "software_engineering",
        seniority: "senior",
        requiredSkills: ["NodeJS", "Postgres", "AWS ECS"],
        preferredSkills: [],
        domain: ["backend"],
        remoteType: "onsite",
        confidence: 0.95
      };
    }
    if (promptLower.includes('junior frontend engineer') || promptLower.includes('job-002') || promptLower.includes('frontend_engineering')) {
      return {
        roleCategory: "frontend_engineering",
        seniority: "junior",
        requiredSkills: ["React", "CSS", "HTML5", "JavaScript"],
        preferredSkills: [],
        domain: ["frontend"],
        remoteType: "remote",
        confidence: 0.95
      };
    }
    if (promptLower.includes('resume_dev.pdf') || promptLower.includes('resume-001') || promptLower.includes('alex dev')) {
      return {
        roleCategory: "software_engineering",
        seniority: "mid",
        skills: ["NodeJS", "React", "Redux", "Express", "Python"],
        domains: ["fullstack"],
        experienceYears: 3,
        confidence: 0.95
      };
    }
    if (promptLower.includes('sarah architect') || promptLower.includes('conn-001') || promptLower.includes('devops architect')) {
      return {
        roleCategory: "devops_infrastructure",
        seniority: "lead",
        skills: ["Kubernetes", "Terraform"],
        domains: ["cloud", "devops"],
        confidence: 0.95
      };
    }

    // General fallback for job understanding/enrichment
    if (promptLower.includes('job') || promptLower.includes('hiring') || promptLower.includes('role')) {
      return {
        roleCategory: 'engineering',
        seniority: 'senior',
        requiredSkills: ['Node.js', 'PostgreSQL', 'AWS'],
        preferredSkills: [],
        domain: ['backend'],
        remoteType: 'remote',
        employmentType: 'full-time',
        experienceMinYears: 3,
        experienceMaxYears: 5,
        responsibilities: ['Write code'],
        summary: 'A role.',
        confidence: 0.95,
        title: 'Backend Developer',
        companyName: 'Mock Technologies',
        location: 'Remote',
        skills: ['Node.js', 'PostgreSQL', 'AWS'],
        salary: '100k-120k',
        experience: '3+ years'
      };
    }

    // General fallback for resume intelligence
    if (promptLower.includes('resume') || promptLower.includes('cv')) {
      return {
        roleCategory: 'engineering',
        seniority: 'mid',
        skills: ['JavaScript', 'React', 'Node.js'],
        domains: ['frontend', 'backend'],
        experienceYears: 2,
        careerProfile: 'Frontend Developer with backend familiarity.',
        technologies: ['Git', 'Docker'],
        experience: '2 years'
      };
    }

    // General fallback for connections
    if (promptLower.includes('profile') || promptLower.includes('connection')) {
      return {
        roleCategory: 'engineering',
        seniority: 'senior',
        skills: ['Node.js', 'React', 'PostgreSQL'],
        domains: ['frontend', 'backend'],
        confidence: 0.95
      };
    }

    // Generic fallback object matching schema
    return {
      status: 'success',
      mockResult: true,
      message: 'Simulated mock response payload'
    };
  }

  async generateText(prompt) {
    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }
    return `Simulated mock text response for prompt: ${prompt.substring(0, 30)}...`;
  }

  async generateEmbedding(text) {
    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }
    const dimension = 384;
    const embedding = [];
    for (let i = 0; i < dimension; i++) {
      const charVal = text ? (text.charCodeAt(i % text.length) || 0) : 0;
      embedding.push(Math.sin(i + charVal) * 0.1);
    }
    return embedding;
  }

  async healthCheck() {
    return true;
  }
}
