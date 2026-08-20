import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /api/health', () => {
  it('returns application health information', async () => {
    const response = await request(createApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('careergraph-api');
    expect(response.body.database.configured).toBe(true);
    expect(response.body.uptimeSeconds).toEqual(expect.any(Number));
    expect(response.body.version).toBe('0.1.0');
    expect(response.body.timestamp).toBeDefined();
  });
});
