import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase } from '../src/config/database.js';

describe('CareerGraph MVP Integration & Isolation Tests', () => {
  let app;
  let userAToken;
  let userBToken;
  let userARefresh;

  // Shared entity IDs for User B to test isolation
  let userBJobId;
  let userBConnectionId;
  let userBResumeId;
  let userBApplicationId;
  let userBOutreachId;
  let userBNotificationId;

  beforeAll(async () => {
    app = createApp();
    await resetDatabase();
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  describe('1. Authentication Module', () => {
    it('successfully registers User A and User B', async () => {
      // User A
      const resA = await request(app)
        .post('/api/auth/register')
        .send({ email: 'userA@example.com', password: 'password123', name: 'User A' });
      expect(resA.status).toBe(201);
      expect(resA.body.data.user.email).toBe('userA@example.com');
      expect(resA.body.data.tokens.accessToken).toBeDefined();
      userAToken = resA.body.data.tokens.accessToken;
      userARefresh = resA.body.data.tokens.refreshToken;

      // User B
      const resB = await request(app)
        .post('/api/auth/register')
        .send({ email: 'userB@example.com', password: 'password123', name: 'User B' });
      expect(resB.status).toBe(201);
      userBToken = resB.body.data.tokens.accessToken;
    });

    it('rejects duplicate email registrations', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'userA@example.com', password: 'password1234', name: 'Duplicate User' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_IN_USE');
    });

    it('rejects register with invalid password (too short)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'short@example.com', password: '123', name: 'Short Password' });
      expect(res.status).toBe(400);
    });

    it('successful login for User A', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'userA@example.com', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.data.tokens.accessToken).toBeDefined();
      userAToken = res.body.data.tokens.accessToken;
      userARefresh = res.body.data.tokens.refreshToken;
    });

    it('rejects login with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'userA@example.com', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });

    it('successfully refreshes token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: userARefresh });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      userAToken = res.body.data.accessToken;
      userARefresh = res.body.data.refreshToken; // Update refresh token as well!
    });

    it('protects routes from unauthorized requests', async () => {
      const res = await request(app).get('/api/profile');
      expect(res.status).toBe(401);
    });
  });

  describe('2. Setting up User B resources', () => {
    it('creates resources for User B', async () => {
      // 1. Profile
      const resProf = await request(app)
        .post('/api/profile')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          name: 'User B',
          phone: '9876543210',
          location: 'San Francisco',
          skills: ['Node.js'],
        });
      expect(resProf.status).toBe(201);

      // 2. Resume
      const resResume = await request(app)
        .post('/api/resumes')
        .set('Authorization', `Bearer ${userBToken}`)
        .attach('file', Buffer.from('PDF Content B'), 'resume_b.pdf');
      expect(resResume.status).toBe(201);
      userBResumeId = resResume.body.data.id;

      // 3. Connection
      const resConnection = await request(app)
        .post('/api/connections')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ name: 'Connection B', company: 'Google', title: 'HR Manager' });
      expect(resConnection.status).toBe(201);
      userBConnectionId = resConnection.body.data.id;

      // 4. Job
      const resJob = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ title: 'Software Engineer B', companyName: 'Google', location: 'Remote' });
      expect(resJob.status).toBe(201);
      userBJobId = resJob.body.data.id;

      // 5. Application
      const resApp = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ jobId: userBJobId, status: 'applied' });
      expect(resApp.status).toBe(201);
      userBApplicationId = resApp.body.data.id;

      // 6. Outreach
      const resOutreach = await request(app)
        .post('/api/outreach')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ connectionId: userBConnectionId, status: 'contacted' });
      expect(resOutreach.status).toBe(201);
      userBOutreachId = resOutreach.body.data.id;

      // 7. Notification (Outreach event creation automatically triggers notification)
      const resNotif = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userBToken}`);
      expect(resNotif.body.data.length).toBeGreaterThan(0);
      userBNotificationId = resNotif.body.data[0].id;
    });
  });

  describe('3. Strict Tenant Isolation (User A cannot access/modify User B\'s data)', () => {
    it('prevents User A from viewing User B\'s profile', async () => {
      const res = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${userAToken}`);
      // User A should get their own profile, not User B's profile
      expect(res.body.data.name).toBe('User A');
    });

    it('prevents User A from accessing/downloading User B\'s resume', async () => {
      const res = await request(app)
        .get(`/api/resumes/${userBResumeId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(404);

      const resDl = await request(app)
        .get(`/api/resumes/${userBResumeId}/download`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resDl.status).toBe(404);
    });

    it('prevents User A from deleting User B\'s resume', async () => {
      const res = await request(app)
        .delete(`/api/resumes/${userBResumeId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(404);
    });

    it('prevents User A from accessing User B\'s connections', async () => {
      const resGet = await request(app)
        .get(`/api/connections/${userBConnectionId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resGet.status).toBe(404);

      const resPut = await request(app)
        .put(`/api/connections/${userBConnectionId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Connection A Hack' });
      expect(resPut.status).toBe(404);

      const resDelete = await request(app)
        .delete(`/api/connections/${userBConnectionId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resDelete.status).toBe(404);
    });

    it('prevents User A from accessing User B\'s jobs', async () => {
      const resGet = await request(app)
        .get(`/api/jobs/${userBJobId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resGet.status).toBe(404);

      const resPut = await request(app)
        .put(`/api/jobs/${userBJobId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ title: 'Hacked Job Title', companyName: 'HackCorp' });
      expect(resPut.status).toBe(404);

      const resDelete = await request(app)
        .delete(`/api/jobs/${userBJobId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resDelete.status).toBe(404);
    });

    it('prevents User A from accessing User B\'s applications', async () => {
      const resGet = await request(app)
        .get(`/api/applications/${userBApplicationId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resGet.status).toBe(404);

      const resPatch = await request(app)
        .patch(`/api/applications/${userBApplicationId}/status`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ status: 'rejected' });
      expect(resPatch.status).toBe(404);
    });

    it('prevents User A from accessing User B\'s outreach logs', async () => {
      const resGet = await request(app)
        .get(`/api/outreach/${userBOutreachId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resGet.status).toBe(404);

      const resPut = await request(app)
        .put(`/api/outreach/${userBOutreachId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ status: 'closed' });
      expect(resPut.status).toBe(404);
    });

    it('prevents User A from marking User B\'s notifications as read', async () => {
      const resPatch = await request(app)
        .patch(`/api/notifications/${userBNotificationId}/read`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resPatch.status).toBe(404);
    });
  });

  describe('4. Session Logout', () => {
    it('logs out User A successfully', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: userARefresh });
      expect(res.status).toBe(200);
      expect(res.body.data.loggedOut).toBe(true);

      // Refreshing again should fail
      const resRefresh = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: userARefresh });
      expect(resRefresh.status).toBe(401);
    });
  });
});
