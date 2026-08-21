import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';
import {
  normalizeCompany,
  normalizePosition,
  classifySeniority,
  classifyRoleCategory,
  calculateProfileCompleteness,
  calculateConnectionScore,
  determinePriority
} from '../src/services/enrichment.service.js';

describe('CareerGraph Connection Enrichment Tests', () => {
  let app;
  let userToken;

  beforeAll(async () => {
    app = createApp();
    await resetDatabase();

    const uniqueEmail = `enrich_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail, password: 'password123', name: 'Enrichment User' });
    userToken = res.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  describe('1. Company and Position Normalization', () => {
    it('normalizes company names by stripping common suffixes and title-casing', () => {
      expect(normalizeCompany('stripe inc.')).toBe('Stripe');
      expect(normalizeCompany('google llc')).toBe('Google');
      expect(normalizeCompany('Microsoft Corp')).toBe('Microsoft');
      expect(normalizeCompany('Acme Co.  ')).toBe('Acme');
      expect(normalizeCompany('Siemens gmbh')).toBe('Siemens');
      expect(normalizeCompany(null)).toBeNull();
    });

    it('normalizes position titles by replacing abbreviations and title-casing', () => {
      expect(normalizePosition('sr. software eng')).toBe('Senior Software Engineer');
      expect(normalizePosition('jr. dev')).toBe('Junior Dev');
      expect(normalizePosition('vp of product')).toBe('Vice President Of Product');
      expect(normalizePosition('engineering mgr')).toBe('Engineering Manager');
      expect(normalizePosition(null)).toBeNull();
    });
  });

  describe('2. Seniority & Role Classification', () => {
    it('classifies seniority levels correctly based on position title', () => {
      expect(classifySeniority('Software Intern')).toBe('intern');
      expect(classifySeniority('Apprentice Coder')).toBe('trainee');
      expect(classifySeniority('Junior developer')).toBe('junior');
      expect(classifySeniority('Senior Architect')).toBe('senior');
      expect(classifySeniority('Lead Developer')).toBe('lead');
      expect(classifySeniority('Engineering Manager')).toBe('manager');
      expect(classifySeniority('Director of Engineering')).toBe('director');
      expect(classifySeniority('CTO')).toBe('executive');
      expect(classifySeniority('Co-Founder')).toBe('founder');
      expect(classifySeniority('Associate Specialist')).toBe('entry');
      expect(classifySeniority('Software Engineer')).toBe('mid');
      expect(classifySeniority(null)).toBe('unknown');
    });

    it('classifies role categories correctly based on position title', () => {
      expect(classifyRoleCategory('Data Scientist')).toBe('ml_ai');
      expect(classifyRoleCategory('DevOps Engineer')).toBe('devops_cloud');
      expect(classifyRoleCategory('Cyber Security Analyst')).toBe('security');
      expect(classifyRoleCategory('React Frontend Engineer')).toBe('frontend');
      expect(classifyRoleCategory('Node.js Backend Developer')).toBe('backend');
      expect(classifyRoleCategory('Full Stack Engineer')).toBe('fullstack');
      expect(classifyRoleCategory('iOS Developer')).toBe('mobile');
      expect(classifyRoleCategory('Systems Engineer')).toBe('engineering');
      expect(classifyRoleCategory('Technical Product Manager')).toBe('product');
      expect(classifyRoleCategory('UX/UI Designer')).toBe('design');
      expect(classifyRoleCategory('Sales Manager')).toBe('sales');
      expect(classifyRoleCategory('Recruiter')).toBe('hr_recruiting');
      expect(classifyRoleCategory('operations specialist')).toBe('operations');
      expect(classifyRoleCategory('CTO')).toBe('executive');
      expect(classifyRoleCategory('Teacher')).toBe('education');
      expect(classifyRoleCategory('Plumber')).toBe('other');
      expect(classifyRoleCategory(null)).toBe('unknown');
    });
  });

  describe('3. Profile Completeness, Scores, Priorities', () => {
    it('calculates profile completeness percentage correctly', () => {
      const emptyConn = {};
      expect(calculateProfileCompleteness(emptyConn)).toBe(0);

      const partialConn = {
        name: 'Alice',
        company: 'Stripe',
        title: 'Engineer',
        email: 'alice@stripe.com'
      };
      // 4 out of 12 fields = 33%
      expect(calculateProfileCompleteness(partialConn)).toBe(33);

      const completeConn = {
        name: 'Alice',
        company: 'Stripe',
        title: 'Engineer',
        location: 'SF',
        email: 'alice@stripe.com',
        profileUrl: 'http://linkedin.com',
        connectedDate: '2026-08-20',
        industry: 'Tech',
        notes: 'Met at conference',
        relationshipStatus: 'contacted',
        relationshipStrength: 'strong',
        nextFollowUpDate: '2026-09-01'
      };
      // 12 out of 12 fields = 100%
      expect(calculateProfileCompleteness(completeConn)).toBe(100);
    });

    it('calculates connection score boundaries correctly', () => {
      // Test boundaries and calculations
      // calculateConnectionScore(completeness, relationshipStrength, seniorityLevel)
      
      // Weak relationship, junior seniority, low completeness
      const scoreLow = calculateConnectionScore(20, 'weak', 'junior');
      // completeness (20 * 0.3 = 6) + relationship (10) + seniority (10) = 26
      expect(scoreLow).toBe(26);

      // Strong relationship, executive seniority, high completeness
      const scoreHigh = calculateConnectionScore(100, 'strong', 'executive');
      // completeness (100 * 0.3 = 30) + relationship (40) + seniority (30) = 100
      expect(scoreHigh).toBe(100);
    });

    it('determines priority level correctly', () => {
      expect(determinePriority('executive', 'strong')).toBe('high');
      expect(determinePriority('senior', 'weak')).toBe('medium');
      expect(determinePriority('intern', 'weak')).toBe('low');
    });
  });

  describe('4. Model Integration Hook (creating connection)', () => {
    it('automatically enriches connection fields on save', async () => {
      const res = await request(app)
        .post('/api/connections')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Jane Doe',
          company: 'Stripe Inc.',
          title: 'Sr. Backend Developer',
          email: 'jane@stripe.com',
          relationshipStrength: 'strong'
        });

      expect(res.status).toBe(201);
      const conn = res.body.data;
      expect(conn.normalizedCompany).toBe('Stripe');
      expect(conn.normalizedPosition).toBe('Senior Backend Developer');
      expect(conn.seniorityLevel).toBe('senior');
      expect(conn.roleCategory).toBe('backend');
      expect(conn.priority).toBe('medium');
      expect(conn.profileCompleteness).toBeGreaterThan(0);
      expect(conn.connectionScore).toBeGreaterThan(0);
      expect(conn.lastEnrichedAt).toBeDefined();
    });
  });
});
