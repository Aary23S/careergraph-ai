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

    // Mock response for job understanding/enrichment
    if (promptLower.includes('job') || promptLower.includes('hiring') || promptLower.includes('role')) {
      return {
        title: 'Backend Developer',
        companyName: 'Mock Technologies',
        location: 'Remote',
        skills: ['Node.js', 'PostgreSQL', 'AWS'],
        salary: '100k-120k',
        experience: '3+ years'
      };
    }

    // Mock response for resume intelligence
    if (promptLower.includes('resume') || promptLower.includes('cv')) {
      return {
        skills: ['JavaScript', 'React', 'Node.js'],
        technologies: ['Git', 'Docker'],
        experience: '2 years',
        careerProfile: 'Frontend Developer with backend familiarity.'
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

  async healthCheck() {
    return true;
  }
}
