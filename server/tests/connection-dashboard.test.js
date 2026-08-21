import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';
import { models } from '../src/config/database.js';

describe('CareerGraph Phase 2.5-E: Connection Intelligence Overview Dashboard Tests', () => {
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
        user_id: userIdA,
        name: 'Alice Google',
        company: 'Google',
        title: 'Staff Software Engineer',
        email: 'alice@google.com',
        location: 'SF',
        connectedDate: '2026-01-15',
        relationshipStatus: 'contacted',
        relationshipStrength: 'strong',
        priority: 'high'
      },
      {
        user_id: userIdA,
        name: 'Bob Google',
        company: 'Google',
        title: 'Senior Software Engineer',
        email: 'bob@google.com',
        location: 'NY',
        connectedDate: '2026-01-20',
        relationshipStatus: 'not_contacted',
        relationshipStrength: 'warm',
        priority: 'medium'
      },
      {
        user_id: userIdA,
        name: 'Charlie Microsoft',
        company: 'Microsoft',
        title: 'Product Manager',
        email: '',
        location: 'WA',
        connectedDate: '2026-02-10',
        relationshipStatus: 'not_contacted',
        relationshipStrength: 'cold',
        priority: 'low'
      }
    ], { individualHooks: true });

    // Create seed connections for User B
    await models.Connection.bulkCreate([
      {
        user_id: userIdB,
        name: 'Bob Apple',
        company: 'Apple',
        title: 'Hardware Engineer',
        email: 'bob@apple.com',
        location: 'Cupertino',
        connectedDate: '2026-03-01',
        relationshipStatus: 'not_contacted',
        relationshipStrength: 'strong',
        priority: 'high'
      }
    ], { individualHooks: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('GET /api/connections/overview', () => {
    it('should aggregate only User A connections and calculate summaries correctly', async () => {
      const res = await request(app)
        .get('/api/connections/overview')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify summaries
      expect(res.body.data.summary.totalConnections).toBe(3);
      expect(res.body.data.summary.companies).toBe(2); // Google, Microsoft
      expect(res.body.data.summary.highPriority).toBe(1); // Alice
      expect(res.body.data.summary.neverContacted).toBe(2); // Bob, Charlie
      expect(res.body.data.summary.withEmail).toBe(2); // Alice, Bob (Charlie's email is empty)

      // Verify top companies
      expect(res.body.data.topCompanies.length).toBe(2);
      expect(res.body.data.topCompanies[0].name).toBe('Google');
      expect(res.body.data.topCompanies[0].count).toBe(2);

      // Verify roles distribution
      const engRole = res.body.data.roles.find(r => r.category === 'engineering');
      expect(engRole).toBeDefined();
      expect(engRole.count).toBe(2);

      // Verify seniority distribution
      const srSeniority = res.body.data.seniority.find(s => s.level === 'senior');
      expect(srSeniority).toBeDefined();
      expect(srSeniority.count).toBe(1);

      // Verify relationships
      const notContactedRel = res.body.data.relationships.find(r => r.status === 'not_contacted');
      expect(notContactedRel).toBeDefined();
      expect(notContactedRel.count).toBe(2);

      // Verify growth data (cumulative chronological monthly additions)
      expect(res.body.data.growth.length).toBe(2); // 2026-01, 2026-02
      expect(res.body.data.growth[0].month).toBe('2026-01');
      expect(res.body.data.growth[0].total).toBe(2);
      expect(res.body.data.growth[1].month).toBe('2026-02');
      expect(res.body.data.growth[1].total).toBe(3);
    });

    it('should aggregate only User B connections and keep isolation', async () => {
      const res = await request(app)
        .get('/api/connections/overview')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalConnections).toBe(1);
      expect(res.body.data.summary.companies).toBe(1);
      expect(res.body.data.topCompanies[0].name).toBe('Apple');
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app).get('/api/connections/overview');
      expect(res.status).toBe(401);
    });
  });
});
