import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';
import { models } from '../src/config/database.js';

describe('CareerGraph Phase 2.5-F: Saved Connection Views API and Integration Tests', () => {
  let app;
  let tokenA;
  let tokenB;
  let userIdA;
  let viewIdA;

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

    // Seed some connections for User A
    await models.Connection.create({
      user_id: userIdA,
      name: 'Alice Google',
      company: 'Google',
      title: 'Senior Engineer',
      relationshipStatus: 'contacted',
      priority: 'high'
    });
    await models.Connection.create({
      user_id: userIdA,
      name: 'Bob Microsoft',
      company: 'Microsoft',
      title: 'Product Manager',
      relationshipStatus: 'not_contacted',
      priority: 'low'
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Saved Connection Views CRUD', () => {
    it('should allow User A to create a saved connection view', async () => {
      const res = await request(app)
        .post('/api/connections/views')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Google Senior Contacts',
          description: 'Custom view segment for Google senior team',
          filters: {
            companies: ['google'],
            priority: ['high']
          },
          sort: {
            sortBy: 'connectionScore',
            sortOrder: 'desc'
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Google Senior Contacts');
      viewIdA = res.body.data.id;
    });

    it('should reject creating views with duplicate names for the same user', async () => {
      const res = await request(app)
        .post('/api/connections/views')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Google Senior Contacts',
          filters: {},
          sort: { sortBy: 'name', sortOrder: 'asc' }
        });

      expect(res.status).toBe(409);
    });

    it('should allow User B to create a view with the same name (unique per user)', async () => {
      const res = await request(app)
        .post('/api/connections/views')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          name: 'Google Senior Contacts',
          filters: {},
          sort: { sortBy: 'name', sortOrder: 'asc' }
        });

      expect(res.status).toBe(201);
    });

    it('should list saved views for the authenticated user', async () => {
      const res = await request(app)
        .get('/api/connections/views')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Google Senior Contacts');
    });

    it('should load a single saved view and update lastUsedAt', async () => {
      const res = await request(app)
        .get(`/api/connections/views/${viewIdA}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.filtersJson.companies).toContain('google');
      expect(res.body.data.lastUsedAt).toBeDefined();
    });

    it('should support view duplication', async () => {
      const res = await request(app)
        .post(`/api/connections/views/${viewIdA}/duplicate`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Google Senior Contacts (Copy)');
    });

    it('should prevent User B from reading User A saved views (Tenant Isolation)', async () => {
      const res = await request(app)
        .get(`/api/connections/views/${viewIdA}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it('should prevent User B from updating User A saved views', async () => {
      const res = await request(app)
        .put(`/api/connections/views/${viewIdA}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(404);
    });

    it('should prevent User B from deleting User A saved views', async () => {
      const res = await request(app)
        .delete(`/api/connections/views/${viewIdA}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it('should allow User A to update a saved view', async () => {
      const res = await request(app)
        .put(`/api/connections/views/${viewIdA}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Updated Google Contacts',
          description: 'Updated description text'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Google Contacts');
    });

    it('should allow User A to delete their saved view', async () => {
      const res = await request(app)
        .delete(`/api/connections/views/${viewIdA}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);

      // Verify deletion
      const checkRes = await request(app)
        .get(`/api/connections/views/${viewIdA}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(checkRes.status).toBe(404);
    });
  });
});
