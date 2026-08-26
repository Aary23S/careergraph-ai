import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase, models } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { getOrGenerateEmbedding, backfillConnectionsEmbedding } from '../src/services/embedding.service.js';
import { cosineSimilarity } from '../src/services/semantic-search.service.js';

describe('Semantic Search & pgvector Fallback Test Suite', () => {
  let app;
  let tokenA;
  let tokenB;
  let userIdA;
  let userIdB;
  let connectionA;

  beforeAll(async () => {
    env.aiEnabled = true;
    env.aiProvider = 'mock';

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

    // Create Connection for User A
    connectionA = await models.Connection.create({
      user_id: userIdA,
      name: 'John Cloud',
      company: 'AWS',
      title: 'DevOps Lead'
    });

    // Create Connection for User B (Tenant Isolation verification)
    await models.Connection.create({
      user_id: userIdB,
      name: 'Jane Cloud',
      company: 'AWS',
      title: 'DevOps Lead'
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Cosine Similarity Algorithm Fallback', () => {
    it('accurately computes similarity coefficients between floating point vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const vec3 = [0, 1, 0];
      const vec4 = [1, 1, 0];

      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1.0);
      expect(cosineSimilarity(vec1, vec3)).toBeCloseTo(0.0);
      expect(cosineSimilarity(vec1, vec4)).toBeCloseTo(0.7071);
    });
  });

  describe('Embedding Service Ingestion', () => {
    it('creates or retrieves embeddings and implements hashing cache bypass', async () => {
      const text = 'AWS DevOps Architect specialized in Terraform cloud solutions.';
      const res1 = await getOrGenerateEmbedding({
        userId: userIdA,
        entityType: 'connection',
        entityId: connectionA.id,
        text
      });

      expect(res1).toBeDefined();
      expect(res1.contentHash).toBeDefined();

      const start = Date.now();
      const res2 = await getOrGenerateEmbedding({
        userId: userIdA,
        entityType: 'connection',
        entityId: connectionA.id,
        text
      });
      const duration = Date.now() - start;

      // Should load instantly from hash cache rather than generating
      expect(duration).toBeLessThan(100);
      expect(res2.id).toBe(res1.id);
    });

    it('successfully processes backfill operations', async () => {
      const stats = await backfillConnectionsEmbedding({
        userId: userIdA,
        limit: 10,
        onlyMissing: true
      });
      expect(stats.processed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('REST Endpoints & Security Checks', () => {
    it('searches connections semantically via POST /api/search/semantic', async () => {
      const res = await request(app)
        .post('/api/search/semantic')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          query: 'DevOps specialists',
          entityTypes: ['connection'],
          limit: 5
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].connection.name).toBe('John Cloud');
    });

    it('strictly isolates vectors (User B cannot retrieve User A records)', async () => {
      const res = await request(app)
        .post('/api/search/semantic')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          query: 'DevOps specialists',
          entityTypes: ['connection'],
          limit: 5
        });

      expect(res.status).toBe(200);
      expect(res.body.data.every(item => item.connection.user_id === userIdB)).toBe(true);
    });
  });
});
