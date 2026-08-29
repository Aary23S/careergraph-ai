import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase, models } from '../src/config/database.js';

describe('Application and Outreach deletion', () => {
  let app;
  let tokenA;
  let tokenB;
  let userIdA;
  let connA;

  beforeAll(async () => {
    app = createApp();
    await resetDatabase();

    const resA = await request(app)
      .post('/api/auth/register')
      .send({ email: 'deleteUserA@example.com', password: 'Password123!', name: 'Delete User A' });
    tokenA = resA.body.data.tokens.accessToken;
    userIdA = resA.body.data.user.id;

    const resB = await request(app)
      .post('/api/auth/register')
      .send({ email: 'deleteUserB@example.com', password: 'Password123!', name: 'Delete User B' });
    tokenB = resB.body.data.tokens.accessToken;

    connA = await models.Connection.create({
      user_id: userIdA,
      name: 'Delete Test Contact',
      company: 'Acme',
      title: 'Engineer',
      email: 'contact@acme.com',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('DELETE /api/applications/:applicationId', () => {
    let applicationId;

    beforeAll(async () => {
      const ingestRes = await request(app)
        .post('/api/jobs/ingest')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Job To Delete Application For',
          companyName: 'Acme',
          location: 'Remote',
          sourceUrl: 'https://acme.com/careers/delete-app-job',
          externalJobId: 'acme-delete-app-job',
          description: 'A job used only to test application deletion.',
          source: 'manual',
        });
      const jobId = ingestRes.body.data.job.id;

      const appRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ jobId, status: 'saved' });
      applicationId = appRes.body.data.id;

      await request(app)
        .post(`/api/applications/${applicationId}/events`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ eventType: 'note_added', status: 'saved', notes: 'timeline entry to verify cascade delete' });
    });

    it('prevents another user from deleting someone else\'s application', async () => {
      const res = await request(app)
        .delete(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it('rejects an unauthenticated delete request', async () => {
      const res = await request(app).delete(`/api/applications/${applicationId}`);
      expect(res.status).toBe(401);
    });

    it('deletes the application and its timeline events', async () => {
      const res = await request(app)
        .delete(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ deleted: true });

      const getRes = await request(app)
        .get(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(getRes.status).toBe(404);

      const remainingEvents = await models.ApplicationEvent.findAll({ where: { application_id: applicationId } });
      expect(remainingEvents).toHaveLength(0);
    });

    it('returns 404 when deleting an application that no longer exists', async () => {
      const res = await request(app)
        .delete(`/api/applications/${applicationId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/outreach/:outreachId', () => {
    let outreachId;

    beforeAll(async () => {
      const outreachRes = await request(app)
        .post('/api/outreach')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ connectionId: connA.id, status: 'not_contacted', notes: 'initial log' });
      outreachId = outreachRes.body.data.id;

      await request(app)
        .post(`/api/outreach/${outreachId}/events`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'contacted', notes: 'timeline entry to verify cascade delete' });
    });

    it('prevents another user from deleting someone else\'s outreach record', async () => {
      const res = await request(app)
        .delete(`/api/outreach/${outreachId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it('deletes the outreach record and its timeline events', async () => {
      const res = await request(app)
        .delete(`/api/outreach/${outreachId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ deleted: true });

      const getRes = await request(app)
        .get(`/api/outreach/${outreachId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(getRes.status).toBe(404);

      const remainingEvents = await models.OutreachEvent.findAll({ where: { outreach_id: outreachId } });
      expect(remainingEvents).toHaveLength(0);
    });

    it('returns 404 when deleting an outreach record that no longer exists', async () => {
      const res = await request(app)
        .delete(`/api/outreach/${outreachId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(404);
    });
  });
});
