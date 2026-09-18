import request from 'supertest';
import { createApp } from '../src/app.js';
import { resetDatabase } from '../src/config/database.js';

describe('Actions API authentication context', () => {
  let app;
  let token;
  let userId;

  beforeAll(async () => {
    app = createApp();
    await resetDatabase();

    const registration = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'action-route-user@example.com',
        password: 'Password123!',
        name: 'Action Route User',
      });

    token = registration.body.data.tokens.accessToken;
    userId = registration.body.data.user.id;
  });

  it('confirms a pending action for an authenticated request', async () => {
    const actionId = 'bd782f71-ca19-4dca-8174-bcb57e8dd93b';
    const response = await request(app)
      .post(`/api/actions/${actionId}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        action: {
          actionId,
          actionType: 'add_note',
          status: 'pending_confirmation',
          userId,
          target: { type: 'connection', id: 'connection-123' },
          payload: { content: 'Follow up after the next conversation.' },
          reason: 'User requested a follow-up note.',
          requestId: 'action-route-confirmation-test',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('confirmed');
    expect(response.body.action.userId).toBe(userId);
  });
});
