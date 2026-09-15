import request from 'supertest';
import { createApp } from '../src/app.js';
import { models, sequelize } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { signAccessToken } from '../src/lib/auth.js';

function generateAuthToken(user) {
  return signAccessToken(user);
}

describe('Copilot Context / RAG Layer', () => {
  let app;
  let userA, userB;
  let userAToken, userBToken;
  let jobA, connectionA, connectionB;

  beforeAll(async () => {
    app = createApp();
    await sequelize.sync({ force: true });
    env.jwtAccessSecret = 'test-secret';

    // 1. Create Users
    userA = await models.User.create({
      email: 'usera@example.com',
      passwordHash: 'hash',
    });
    userB = await models.User.create({
      email: 'userb@example.com',
      passwordHash: 'hash',
    });

    userAToken = generateAuthToken(userA);
    userBToken = generateAuthToken(userB);

    // 2. Create Entities
    jobA = await models.Job.create({
      user_id: userA.id,
      title: 'Backend Engineer',
      status: 'new'
    });

    connectionA = await models.Connection.create({
      user_id: userA.id,
      name: 'Alice',
      company: 'Microsoft',
      title: 'Senior Engineer',
      notes: 'Secret note'
    });

    connectionB = await models.Connection.create({
      user_id: userB.id,
      name: 'Bob',
      company: 'Google',
      title: 'Manager',
      notes: 'Another secret note'
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Authorization', () => {
    test('User A cannot retrieve User B connection context', async () => {
      const response = await request(app)
        .post('/api/copilot/context')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          intent: 'referral_search',
          connectionId: connectionB.id
        });

      expect(response.status).toBe(200);
      expect(response.body.entities.connections.length).toBe(0);
    });

    test('User B cannot retrieve User A job context', async () => {
      const response = await request(app)
        .post('/api/copilot/context')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          intent: 'referral_search',
          jobId: jobA.id
        });

      expect(response.status).toBe(200);
      expect(response.body.entities.jobs.length).toBe(0);
    });
  });

  describe('Intents and Limits', () => {
    test('referral_search pulls connections and jobs, but no resume', async () => {
      const response = await request(app)
        .post('/api/copilot/context')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          intent: 'referral_search',
          jobId: jobA.id,
          connectionId: connectionA.id
        });

      expect(response.status).toBe(200);
      const pkg = response.body;
      expect(pkg.intent).toBe('referral_search');
      expect(pkg.entities.jobs.length).toBe(1);
      expect(pkg.entities.connections.length).toBe(1);
      expect(pkg.entities.resume).toBeNull();
      
      // Provenance check
      expect(pkg.facts.length).toBeGreaterThan(0);
      expect(pkg.facts[0].source).toBe('connection');
    });

    test('match_explanation pulls resume and jobs, but no connections', async () => {
      const response = await request(app)
        .post('/api/copilot/context')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          intent: 'match_explanation',
          jobId: jobA.id,
          connectionId: connectionA.id // Should be ignored
        });

      expect(response.status).toBe(200);
      const pkg = response.body;
      expect(pkg.intent).toBe('match_explanation');
      expect(pkg.entities.connections.length).toBe(0);
      // Resume might be null if not created, but it shouldn't be an error
    });
  });

  describe('Sanitization', () => {
    test('Connection context sanitizes appropriately', async () => {
      const response = await request(app)
        .post('/api/copilot/context')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          intent: 'referral_search',
          connectionId: connectionA.id
        });

      const conn = response.body.entities.connections[0];
      expect(conn).toBeDefined();
      expect(conn.name).toBe('Alice');
      expect(conn.notes).toBe('Secret note'); // Notes are included, truncated
    });
  });
});
