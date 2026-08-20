import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';
import {
  extractSkillsFromText,
  calculateMatchScore,
  calculateReferralScore,
  calculateOpportunityScore,
  determineActionRecommendation
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
