import { jest, expect } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { models, resetDatabase } from '../src/config/database.js';

describe('Followed Companies Feature', () => {
  let app;
  let user;
  let token;

  beforeAll(async () => {
    app = createApp();
    await resetDatabase();
    
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `test-followed-companies-${Date.now()}@example.com`, password: 'Password123!', name: 'User A' });
    
    token = res.body.data.tokens.accessToken;
    user = res.body.data.user;
  });

  afterAll(async () => {
    // optional cleanup
  });

  it('should import followed companies via CSV', async () => {
    const csvContent = `Organization,URL
Google,https://linkedin.com/company/google
Microsoft,https://linkedin.com/company/microsoft
"Apple Inc.",https://linkedin.com/company/apple
`;

    const res = await request(app)
      .post('/api/followed-companies/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(csvContent), 'companies.csv');
    console.log('API CSV Response Body:', res.body);
    expect(res.status).toBe(200);
    expect(res.body.data.imported).toBe(3);

    const companies = await models.FollowedCompany.findAll({ where: { user_id: user.id } });
    expect(companies.length).toBe(3);
    
    const names = companies.map(c => c.name).sort();
    expect(names).toEqual(['Apple Inc.', 'Google', 'Microsoft']);
  });

  it('should correctly merge followed companies in company directory', async () => {
    await models.Connection.create({
      user_id: user.id,
      name: 'Test Connection',
      company: 'Google',
      normalized_company: 'google'
    });

    const res = await request(app)
      .get('/api/connections/companies')
      .set('Authorization', `Bearer ${token}`)
      .query({ limit: 50, page: 1 });

    expect(res.status).toBe(200);
    const companies = res.body.data;
    console.log('API Companies Response:', companies);
    
    expect(companies.length).toBeGreaterThanOrEqual(3);
    
    const google = companies.find(c => c.companyKey === 'google');
    expect(google).toBeDefined();
    expect(google.connectionCount).toBe(1);
    expect(google.isFollowed).toBe(true);

    const microsoft = companies.find(c => c.companyKey === 'microsoft');
    expect(microsoft).toBeDefined();
    expect(microsoft.connectionCount).toBe(0);
    expect(microsoft.isFollowed).toBe(true);
  });
});
