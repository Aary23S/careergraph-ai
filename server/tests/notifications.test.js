import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase, models } from '../src/config/database.js';

let app;

beforeAll(async () => {
  app = createApp();
  await resetDatabase();
});

afterAll(async () => {
  await sequelize.close();
});

describe('Notifications bulk mark-as-read', () => {
  let userAId;
  let userAToken;
  let userBId;

  beforeAll(async () => {
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ email: 'notif-a@example.com', password: 'Password123!', name: 'Notif A' });
    userAId = resA.body.data.user.id;
    userAToken = resA.body.data.tokens.accessToken;

    const resB = await request(app)
      .post('/api/auth/register')
      .send({ email: 'notif-b@example.com', password: 'Password123!', name: 'Notif B' });
    userBId = resB.body.data.user.id;

    await models.Notification.bulkCreate([
      { user_id: userAId, type: 'job_alert', title: 'Job 1', message: 'msg', isRead: false },
      { user_id: userAId, type: 'job_alert', title: 'Job 2', message: 'msg', isRead: false },
      { user_id: userAId, type: 'follow_up_due', title: 'Follow up', message: 'msg', isRead: true },
      { user_id: userBId, type: 'job_alert', title: 'B Job', message: 'msg', isRead: false },
    ]);
  });

  it('marks only the authenticated user\'s unread notifications as read', async () => {
    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const userANotifs = await models.Notification.findAll({ where: { user_id: userAId } });
    expect(userANotifs.every((n) => n.isRead)).toBe(true);

    const userBNotifs = await models.Notification.findAll({ where: { user_id: userBId } });
    expect(userBNotifs.every((n) => n.isRead === false)).toBe(true);
  });

  it('is a no-op when there are no unread notifications left', async () => {
    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('requires authentication', async () => {
    const res = await request(app).patch('/api/notifications/read-all');
    expect(res.status).toBe(401);
  });
});
