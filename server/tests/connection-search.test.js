import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';
import { models } from '../src/config/database.js';

describe('CareerGraph Phase 2.5-C: Search, Filtering, Sorting and Pagination Tests', () => {
  let app;
  let tokenA;
  let tokenB;
  let userIdA;
  let userIdB;

  beforeAll(async () => {
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

    // Create seed connections for User A
    await models.Connection.bulkCreate([
      {
        id: '10000000-0000-0000-0000-000000000001',
        user_id: userIdA,
        name: 'Alice Smith',
        company: 'Google LLC',
        title: 'Senior Software Engineer',
        email: 'alice@google.com',
        location: 'SF',
        connectedDate: '2026-01-01',
        lastContactedDate: '2026-02-01',
        nextFollowUpDate: '2026-03-01', // due
        relationshipStatus: 'contacted',
        relationshipStrength: 'strong',
        connectionScore: 85
      },
      {
        id: '10000000-0000-0000-0000-000000000002',
        user_id: userIdA,
        name: 'Bob Jones',
        company: 'Microsoft Corp',
        title: 'Product Manager II',
        email: 'bob@microsoft.com',
        location: 'Redmond',
        connectedDate: '2026-01-15',
        lastContactedDate: '2026-02-10',
        nextFollowUpDate: '2026-09-01', // not due
        relationshipStatus: 'replied',
        relationshipStrength: 'medium',
        connectionScore: 60
      },
      {
        id: '10000000-0000-0000-0000-000000000003',
        user_id: userIdA,
        name: 'Charlie Brown',
        company: 'Stripe',
        title: 'Junior Developer',
        email: null,
        location: 'NYC',
        connectedDate: '2026-02-01',
        lastContactedDate: null,
        nextFollowUpDate: null,
        relationshipStatus: 'not_contacted',
        relationshipStrength: 'weak',
        connectionScore: 30
      }
    ], { individualHooks: true });

    // Create duplicate matching connection for User B to verify tenant-isolation
    await models.Connection.create({
      id: '20000000-0000-0000-0000-000000000001',
      user_id: userIdB,
      name: 'Alice Smith',
      company: 'Google LLC',
      title: 'Senior Software Engineer',
      email: 'alice@google.com',
      location: 'SF',
      connectedDate: '2026-01-01',
      lastContactedDate: '2026-02-01',
      nextFollowUpDate: '2026-03-01',
      relationshipStatus: 'contacted',
      relationshipStrength: 'strong',
      connectionScore: 85
    });
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  describe('1. Security Tenant Isolation', () => {
    it('returns only connections owned by User A and isolates from User B', async () => {
      const res = await request(app)
        .get('/api/connections')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      expect(res.body.pagination.total).toBe(3);

      // Verify none of User B's connections are returned
      const ids = res.body.data.map(c => c.id);
      expect(ids).not.toContain('20000000-0000-0000-0000-000000000001');
    });

    it('returns User B records only for User B queries', async () => {
      const res = await request(app)
        .get('/api/connections')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.total).toBe(1);
      expect(res.body.data[0].id).toBe('20000000-0000-0000-0000-000000000001');
    });
  });

  describe('2. Search Functionality', () => {
    it('searches by name partial match case-insensitive', async () => {
      const res = await request(app)
        .get('/api/connections?search=smith')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Alice Smith');
    });

    it('searches by company', async () => {
      const res = await request(app)
        .get('/api/connections?search=google')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].company).toBe('Google LLC');
    });
  });

  describe('3. Filtering Capabilities', () => {
    it('filters by multiple companies (OR semantics within category)', async () => {
      const res = await request(app)
        .get('/api/connections?companies=google,stripe')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      const names = res.body.data.map(c => c.name);
      expect(names).toContain('Alice Smith');
      expect(names).toContain('Charlie Brown');
    });

    it('filters by seniority levels', async () => {
      const res = await request(app)
        .get('/api/connections?seniority=senior')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Alice Smith');
    });

    it('filters by email availability', async () => {
      const resHasEmail = await request(app)
        .get('/api/connections?hasEmail=true')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resHasEmail.status).toBe(200);
      expect(resHasEmail.body.data.length).toBe(2);

      const resNoEmail = await request(app)
        .get('/api/connections?hasEmail=false')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resNoEmail.status).toBe(200);
      expect(resNoEmail.body.data.length).toBe(1);
      expect(resNoEmail.body.data[0].name).toBe('Charlie Brown');
    });

    it('filters by follow-up due status', async () => {
      const resDue = await request(app)
        .get('/api/connections?followUpDue=true')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resDue.status).toBe(200);
      expect(resDue.body.data.length).toBe(1);
      expect(resDue.body.data[0].name).toBe('Alice Smith');
    });
  });

  describe('4. Sorting & Pagination', () => {
    it('sorts connections by connection score DESC', async () => {
      const res = await request(app)
        .get('/api/connections?sortBy=connectionScore&sortOrder=desc')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const scores = res.body.data.map(c => c.connectionScore);
      expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
      expect(scores[1]).toBeGreaterThanOrEqual(scores[2]);
    });

    it('enforces limit boundary and pagination pages', async () => {
      const res = await request(app)
        .get('/api/connections?limit=25&page=1')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(25);
      expect(res.body.pagination.page).toBe(1);
    });

    it('rejects invalid query limits with HTTP 400', async () => {
      const res = await request(app)
        .get('/api/connections?limit=11')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
    });

    it('rejects invalid connected date format with HTTP 400', async () => {
      const res = await request(app)
        .get('/api/connections?connectedFrom=01-01-2026')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
    });
  });
});
