import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';
import {
  extractSkillsFromText,
  calculateMatchScore,
  calculateReferralScore,
  calculateOpportunityScore,
  determineActionRecommendation,
  computeSkillGapAnalysis
} from '../src/services/intelligence.service.js';

describe('CareerGraph Intelligence Services Tests', () => {
  let app;
  let userToken;

  beforeAll(async () => {
    app = createApp();
    await resetDatabase();

    // Create user for integration tests
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'intel@example.com', password: 'password123', name: 'Intelligence User' });
    userToken = res.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  describe('1. Job Normalization & Skill Extraction', () => {
    it('extracts technical skills from general job text', () => {
      const text = 'Looking for a Senior React developer who knows JavaScript, Node.js and SQL database configurations.';
      const skills = extractSkillsFromText(text);
      expect(skills).toContain('react');
      expect(skills).toContain('javascript');
      expect(skills).toContain('node.js');
      expect(skills).toContain('sql');
      expect(skills).not.toContain('python');
    });

    it('returns empty array when text has no matchable skills', () => {
      const skills = extractSkillsFromText('Customer support specialist for logistics management.');
      expect(skills).toEqual([]);
    });
  });

  describe('2. Job Matching and Score Calculations', () => {
    const profile = {
      skills: ['React', 'JavaScript', 'Node.js', 'SQL'],
      targetRoles: ['Software Engineer', 'Fullstack Engineer'],
      remotePreference: 'remote',
      preferredLocations: ['New York'],
      experience: '4 years'
    };

    it('calculates job match score with high alignment', () => {
      const job = {
        title: 'Fullstack Software Engineer',
        description: 'React, Node.js, SQL developer needed.',
        location: 'Remote',
        experienceMin: 3
      };
      
      const score = calculateMatchScore(profile, job);
      expect(score).toBeGreaterThanOrEqual(80); // Title, skills, remote, and experience all match
    });

    it('calculates connection referral score', () => {
      const connection = {
        company: 'Stripe',
        relationshipStrength: 'strong',
        title: 'Senior Software Engineer'
      };
      const job = {
        title: 'Backend Engineer',
        company: { name: 'Stripe' }
      };

      const score = calculateReferralScore(connection, job);
      expect(score).toBe(100); // 50 (company) + 30 (relationship) + 20 (title match)
    });

    it('returns 0 referral score if connection does not work at company', () => {
      const connection = {
        company: 'Stripe',
        relationshipStrength: 'strong'
      };
      const job = {
        title: 'Engineer',
        company: { name: 'Google' }
      };

      const score = calculateReferralScore(connection, job);
      expect(score).toBe(0);
    });

    it('calculates combined opportunity score', () => {
      const matchScore = 80;
      const referralScore = 100;
      
      const oppScoreWithRef = calculateOpportunityScore(matchScore, referralScore);
      expect(oppScoreWithRef).toBe(Math.round(80 * 0.6 + 100 * 0.4)); // 88

      const oppScoreNoRef = calculateOpportunityScore(matchScore, 0);
      expect(oppScoreNoRef).toBe(Math.round(80 * 0.6)); // 48
    });

    it('determines action recommendations based on match and referral inputs', () => {
      const bestConn = { name: 'Alice', title: 'Developer', referralScore: 90 };
      const rec = determineActionRecommendation(85, bestConn);
      expect(rec).toContain('Request a referral from Alice');

      const noConnRec = determineActionRecommendation(75, null);
      expect(noConnRec).toBe('Apply directly via the job link');

      const lowMatchNoConn = determineActionRecommendation(40, null);
      expect(lowMatchNoConn).toContain('Build new connections');
    });
  });

  describe('2b. Resume-driven match scoring (calculateMatchScore options)', () => {
    it('falls back to the legacy algorithm when no resumeEnrichment is passed', () => {
      const profile = {
        skills: ['React', 'JavaScript'],
        targetRoles: ['Software Engineer'],
        remotePreference: 'remote',
        preferredLocations: [],
        experience: '4 years'
      };
      const job = { title: 'Software Engineer', description: 'React developer.', location: 'Remote' };

      const withoutOptions = calculateMatchScore(profile, job);
      const withEmptyOptions = calculateMatchScore(profile, job, {});
      const withIncompleteEnrichment = calculateMatchScore(profile, job, {
        resumeEnrichment: { status: 'processing' }
      });

      expect(withoutOptions).toBe(withEmptyOptions);
      expect(withoutOptions).toBe(withIncompleteEnrichment);
    });

    it('scores a perfect resume/job match at exactly 100', () => {
      const profile = {
        skills: ['PostgreSQL'],
        targetRoles: ['Senior Backend Engineer'],
        remotePreference: 'remote',
        preferredLocations: []
      };
      const resumeEnrichment = {
        status: 'completed',
        skills: ['React', 'Node.js'],
        technicalDomains: ['backend'],
        careerLevel: 'senior',
        totalExperienceYears: 5,
        projects: [{ name: 'App', technologies: ['React', 'Node.js'] }],
        certifications: [{ name: 'React Developer Certification' }]
      };
      const jobEnrichment = {
        requiredSkills: ['React', 'Node.js'],
        preferredSkills: ['PostgreSQL'],
        domain: ['backend'],
        seniority: 'senior'
      };
      const job = {
        title: 'Senior Backend Engineer',
        description: 'React and Node.js role.',
        location: 'Remote',
        experienceMin: 3,
        experienceMax: 7
      };

      const score = calculateMatchScore(profile, job, { resumeEnrichment, jobEnrichment });
      expect(score).toBe(100);
    });

    it('redistributes the preferred-skills weight into required-skills when no preferred list exists', () => {
      const profile = { skills: [], targetRoles: [], preferredLocations: [] };
      const job = { title: 'Widget Role', description: 'No skill keywords here.' };
      const resumeEnrichment = { status: 'completed', skills: ['React'] };

      const noPreferred = calculateMatchScore(profile, job, {
        resumeEnrichment,
        jobEnrichment: { requiredSkills: ['React'] }
      });
      const withUnmatchedPreferred = calculateMatchScore(profile, job, {
        resumeEnrichment,
        jobEnrichment: { requiredSkills: ['React'], preferredSkills: ['Foo'] }
      });

      expect(noPreferred).toBe(40);
      expect(withUnmatchedPreferred).toBe(30);
    });

    it('absorbs the domain-overlap weight into location when domain data is unavailable', () => {
      const profile = { skills: [], targetRoles: [], remotePreference: 'remote', preferredLocations: [] };
      const job = { title: 'Widget Role', description: 'No skill keywords here.', location: 'Remote' };
      const resumeEnrichment = { status: 'completed', skills: [] };

      const withDomain = calculateMatchScore(profile, job, {
        resumeEnrichment: { ...resumeEnrichment, technicalDomains: ['backend'] },
        jobEnrichment: { domain: ['backend'] }
      });
      const withoutDomain = calculateMatchScore(profile, job, {
        resumeEnrichment,
        jobEnrichment: {}
      });

      expect(withDomain).toBe(20); // 10 domain + 10 location
      expect(withoutDomain).toBe(20); // 0 domain + 20 location (fully absorbed, not dropped)
    });

    it('degrades the seniority/years bucket gracefully when only one sub-signal is available', () => {
      const profile = { skills: [], targetRoles: [], preferredLocations: [] };
      const job = { title: 'Widget Coordinator', description: 'Manage widgets.' };

      const rankOnly = calculateMatchScore(profile, job, {
        resumeEnrichment: { status: 'completed', skills: [], careerLevel: 'senior' },
        jobEnrichment: { seniority: 'senior' }
      });
      const neitherAvailable = calculateMatchScore(profile, job, {
        resumeEnrichment: { status: 'completed', skills: [], totalExperienceYears: 5 },
        jobEnrichment: {}
      });
      const jobWithYearsRange = { ...job, experienceMin: 3, experienceMax: 7 };
      const yearsOnly = calculateMatchScore(profile, jobWithYearsRange, {
        resumeEnrichment: { status: 'completed', skills: [], totalExperienceYears: 5 },
        jobEnrichment: {}
      });

      expect(rankOnly).toBe(15);
      // No job.experienceMin means yearsRatio can't be computed either, so this
      // isn't "one sub-signal" but confirms neither-available degrades to 0, not a crash.
      expect(neitherAvailable).toBe(0);
      expect(yearsOnly).toBe(15);
    });

    it('credits a required skill demonstrated in a project even when absent from the flat skills list', () => {
      const profile = { skills: [], targetRoles: [], preferredLocations: [] };
      const job = { title: 'Widget Role', description: 'No skill keywords here.' };
      const score = calculateMatchScore(profile, job, {
        resumeEnrichment: {
          status: 'completed',
          skills: [],
          projects: [{ name: 'App', technologies: ['Kubernetes'] }]
        },
        jobEnrichment: { requiredSkills: ['Kubernetes'] }
      });
      expect(score).toBe(5);
    });

    it('scores certification relevance via token overlap with the job title/required skills', () => {
      const profile = { skills: [], targetRoles: [], preferredLocations: [] };
      const job = { title: 'React Engineer', description: '' };
      const score = calculateMatchScore(profile, job, {
        resumeEnrichment: {
          status: 'completed',
          skills: [],
          certifications: [{ name: 'React Developer Certification' }]
        },
        jobEnrichment: {}
      });
      expect(score).toBe(5);
    });
  });

  describe('2c. computeSkillGapAnalysis', () => {
    it('uses canonicalized resume/job skills when a completed resume enrichment is available', () => {
      const profile = { skills: [] };
      const job = { title: 'Backend Engineer', description: '' };
      const { matchedSkills, missingSkills } = computeSkillGapAnalysis(
        profile,
        job,
        { status: 'completed', skills: ['React'] },
        { requiredSkills: ['React', 'Node.js'] }
      );
      expect(matchedSkills).toContain('React');
      expect(missingSkills).toContain('Node.js');
    });

    it('falls back to the legacy hardcoded-list comparison without a completed resume enrichment', () => {
      const profile = { skills: ['react'] };
      const job = { title: 'Backend Engineer using React and SQL', description: '' };
      const { matchedSkills, missingSkills } = computeSkillGapAnalysis(profile, job, null, null);
      expect(matchedSkills).toContain('react');
      expect(missingSkills).toContain('sql');
    });
  });

  describe('3. Job Ingestion & Deduplication (Integration)', () => {
    it('deduplicates duplicate job ingestion by URL', async () => {
      const jobData = {
        title: 'Staff Developer',
        companyName: 'Meta',
        description: 'React developer',
        url: 'https://meta.com/jobs/staff-dev'
      };

      // Ingest once
      const res1 = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${userToken}`)
        .send(jobData);
      expect(res1.status).toBe(201);
      const firstId = res1.body.data.id;

      // Ingest again
      const res2 = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${userToken}`)
        .send(jobData);
      
      // Should return status 200 (duplicate found and updated) and return the same ID
      expect(res2.status).toBe(200);
      expect(res2.body.data.id).toBe(firstId);
    });
  });

  describe('4. Email Digest Generation (Integration)', () => {
    it('successfully triggers daily digest creation', async () => {
      const res = await request(app)
        .post('/api/dashboard/digest')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.sent).toBe(true);
      expect(res.body.data.recipient).toBe('intel@example.com');
    });
  });
});
