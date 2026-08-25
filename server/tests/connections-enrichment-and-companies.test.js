import request from 'supertest';
import { jest } from '@jest/globals';
import { sequelize, resetDatabase } from '../src/config/database.js';
import { models } from '../src/config/database.js';

// Mock pdf parser
jest.unstable_mockModule('../src/services/linkedin-pdf-parser.js', () => ({
  parseLinkedInPDF: jest.fn().mockImplementation(async () => ({
    name: 'Soham Page',
    email: 'soham@saffronedge.com',
    profileUrl: 'https://linkedin.com/in/sohampage',
    headline: 'Software Engineer at SaffronEdge',
    company: 'SaffronEdge',
    title: 'Senior Software Engineer',
    skills: ['Node.js', 'React'],
    profileSummary: 'Experienced developer',
    externalLinks: ['https://github.com/sohampage']
  }))
}));

describe('CareerGraph Phase 2.5-H2: CRM Enrichment & Company Directory API Tests', () => {
  let app;
  let tokenA;
  let tokenB;
  let userIdA;
  let userIdB;
  let connectionA;

  beforeAll(async () => {
    const { createApp } = await import('../src/app.js');
    app = createApp();
    await resetDatabase();

    // Register User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ email: 'userA@example.com', password: 'Password123!', name: 'User A' });
    tokenA = resA.body.data.tokens.accessToken;
    userIdA = resA.body.data.user.id;

    // Register User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ email: 'userB@example.com', password: 'Password123!', name: 'User B' });
    tokenB = resB.body.data.tokens.accessToken;
    userIdB = resB.body.data.user.id;

    // Set up Connections for User A
    connectionA = await models.Connection.create({
      user_id: userIdA,
      name: 'Soham Page',
      company: 'SaffronEdge',
      normalizedCompany: 'saffronedge',
      title: 'Senior Software Engineer',
      email: 'soham@saffronedge.com',
      profileUrl: 'https://linkedin.com/in/sohampage',
      relationshipStatus: 'contacted',
      priority: 'high',
      roleCategory: 'engineering'
    });

    await models.Connection.create({
      user_id: userIdA,
      name: 'Priya Recruiter',
      company: 'SaffronEdge',
      normalizedCompany: 'saffronedge',
      title: 'Technical Recruiter',
      email: 'priya@saffronedge.com',
      relationshipStatus: 'not_contacted',
      priority: 'medium',
      seniorityLevel: 'mid',
      roleCategory: 'recruiting'
    });

    // Set up Connection for User B (Tenant Isolation Test)
    await models.Connection.create({
      user_id: userIdB,
      name: 'User B Connection',
      company: 'SaffronEdge',
      normalizedCompany: 'saffronedge',
      title: 'Product Manager'
    });
  }, 15000);

  afterAll(async () => {
    await sequelize.close();
  });

  describe('GET /api/connections/companies', () => {
    it('should return aggregated company statistics for the user', async () => {
      const res = await request(app)
        .get('/api/connections/companies')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      
      const comp = res.body.data[0];
      expect(comp.companyName).toBe('SaffronEdge');
      expect(comp.connectionCount).toBe(2);
      expect(comp.seniorPlusCount).toBe(1); // Soham
      expect(comp.engineeringCount).toBe(1); // Soham
      expect(comp.recruiterCount).toBe(1); // Priya
      expect(comp.contactedCount).toBe(1); // Soham
      expect(comp.notContactedCount).toBe(1); // Priya
      expect(comp.highPriorityCount).toBe(1); // Soham
    });

    it('should support searching companies', async () => {
      const res = await request(app)
        .get('/api/connections/companies?search=saffron')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('GET /api/connections/companies/:companyKey', () => {
    it('should return detailed aggregated data for a specific company', async () => {
      const res = await request(app)
        .get('/api/connections/companies/saffronedge')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalConnections).toBe(2);
      expect(res.body.data.recruiters).toBe(1);
      expect(res.body.data.rolesDistribution.length).toBeGreaterThan(0);
    });

    it('should isolate company detail query to authenticated user', async () => {
      // User B should see their own aggregates (1 connection) instead of User A's
      const res = await request(app)
        .get('/api/connections/companies/saffronedge')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalConnections).toBe(1);
    });
  });

  describe('POST /api/connections/enrichment/import', () => {
    it('should match existing connection and return preview payload', async () => {
      const res = await request(app)
        .post('/api/connections/enrichment/import')
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('file', Buffer.from('mock pdf content'), 'profile.pdf');

      expect(res.status).toBe(200);
      expect(res.body.data.matched.length).toBe(1);
      expect(res.body.data.matched[0].name).toBe('Soham Page');
      expect(res.body.data.new.length).toBe(0);
    });
  });

  describe('POST /api/connections/enrichment/confirm', () => {
    it('should enrich target connection and track data source provenance', async () => {
      const parsed = {
        name: 'Soham Page',
        email: 'soham@saffronedge.com',
        profileUrl: 'https://linkedin.com/in/sohampage',
        headline: 'Lead Software Architect',
        skills: ['Node.js', 'React', 'PostgreSQL'],
        profileSummary: 'Senior Lead Architect'
      };

      const res = await request(app)
        .post('/api/connections/enrichment/confirm')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          action: 'enrich',
          connectionId: connectionA.id,
          parsed
        });

      expect(res.status).toBe(200);
      expect(res.body.data.headline).toBe('Lead Software Architect');
      expect(res.body.data.skills).toContain('PostgreSQL');
      expect(res.body.data.dataSources.headline).toBe('linkedin_pdf');
    });

    it('should support creating a new connection if unmatched', async () => {
      const parsed = {
        name: 'New Person',
        email: 'new@example.com',
        headline: 'Frontend Designer at Figma',
        company: 'Figma',
        title: 'Frontend Designer'
      };

      const res = await request(app)
        .post('/api/connections/enrichment/confirm')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          action: 'create',
          parsed
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Person');
      expect(res.body.data.company).toBe('Figma');
    });
  });
});
