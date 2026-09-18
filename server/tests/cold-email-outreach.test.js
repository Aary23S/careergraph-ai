import { describe, it, beforeAll, expect } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { models, resetDatabase } from '../src/config/database.js';
import { ColdEmailOutreachService } from '../src/services/cold-email-outreach.service.js';
import { CopilotToolRegistry } from '../src/services/copilot/copilot-tool-registry.js';
import { CopilotChatService } from '../src/services/copilot/copilot-chat.service.js';

describe('Cold Email & Outreach Tracking Feature', () => {
  let app;
  let user;
  let token;
  let existingCompany;
  let existingConnection;

  beforeAll(async () => {
    app = createApp();
    await resetDatabase();

    const authRes = await request(app)
      .post('/api/auth/register')
      .send({ email: `cold-email-user-${Date.now()}@example.com`, password: 'Password123!', name: 'Cold Email Tester' });

    token = authRes.body.data.tokens.accessToken;
    user = authRes.body.data.user;

    // Seed existing company
    existingCompany = await models.Company.create({
      name: 'Apple Inc.',
      normalizedName: 'apple'
    });

    // Seed existing connection
    existingConnection = await models.Connection.create({
      user_id: user.id,
      name: 'Vishal Johri',
      email: 'vjohri@apple.com',
      company: 'Apple',
      title: 'Lead Software Engineer',
      relationshipStatus: 'not_contacted'
    });
  });

  it('1. should ingest cold emails and auto-link to existing CRM Company & Connection', async () => {
    const sampleEmails = [
      {
        recipientEmail: 'vjohri@apple.com',
        recipientName: 'Vishal Johri',
        organizationName: 'Apple',
        recipientRole: 'talent_acquisition',
        subject: 'DevOps Engineer Opportunity Inquiry at Apple',
        sentDate: new Date('2026-09-01'),
        emailBody: 'Hi Vishal, I saw your work leading engineering teams at Apple...'
      },
      {
        recipientEmail: 'recruiter@microsoft.com',
        recipientName: 'Sarah Jenkins',
        organizationName: 'Microsoft',
        recipientRole: 'recruiter',
        subject: 'Backend Opportunities at Microsoft',
        sentDate: new Date('2026-09-05'),
        emailBody: 'Hi Sarah, reaching out regarding open positions at Microsoft...'
      }
    ];

    const result = await ColdEmailOutreachService.ingestColdEmails({
      userId: user.id,
      emails: sampleEmails,
      source: 'gmail_sync'
    });

    expect(result.totalIngested).toBe(2);
    expect(result.linkedCompanies).toBeGreaterThanOrEqual(1);
    expect(result.linkedConnections).toBeGreaterThanOrEqual(1);

    // Verify database record linked to connection
    const appleRecord = await models.ColdEmailOutreach.findOne({
      where: { user_id: user.id, recipient_email: 'vjohri@apple.com' }
    });
    expect(appleRecord).toBeDefined();
    expect(appleRecord.connectionId).toBe(existingConnection.id);
    expect(appleRecord.companyId).toBe(existingCompany.id);

    // Verify connection status was updated
    const updatedConn = await models.Connection.findByPk(existingConnection.id);
    expect(updatedConn.relationshipStatus).toBe('contacted');
  });

  it('2. should fetch cold emails list and summary stats via REST API', async () => {
    const listRes = await request(app)
      .get('/api/cold-emails')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.total).toBe(2);
    expect(listRes.body.stats.totalSent).toBe(2);

    const statsRes = await request(app)
      .get('/api/cold-emails/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.stats.awaitingReply).toBe(2);
  });

  it('3. should log a received revert/reply and update connection status', async () => {
    const appleRecord = await models.ColdEmailOutreach.findOne({
      where: { user_id: user.id, recipient_email: 'vjohri@apple.com' }
    });

    const revertRes = await request(app)
      .post(`/api/cold-emails/${appleRecord.id}/revert`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        replyStatus: 'interview_offered',
        revertDate: '2026-09-10',
        revertMessage: 'Thanks for reaching out! We would love to set up an initial screening call next Tuesday.',
        nextActionDate: '2026-09-15',
        nextActionNotes: 'Prepare system architecture demo'
      });

    expect(revertRes.status).toBe(200);
    expect(revertRes.body.item.replyStatus).toBe('interview_offered');

    // Connection relationship status should now be updated to conversation/replied
    const updatedConn = await models.Connection.findByPk(existingConnection.id);
    expect(updatedConn.relationshipStatus).toBe('conversation');
  });

  it('4. should integrate with Copilot tool search for cold email outreach', async () => {
    const toolRes = await CopilotToolRegistry.searchColdEmails({
      userId: user.id,
      company: 'Apple'
    });

    expect(toolRes.grounding.status).toBe('grounded');
    expect(toolRes.message).toContain('cold email outreach record');
    expect(toolRes.references.length).toBeGreaterThanOrEqual(1);

    const chatRes = await CopilotChatService.sendChat({
      userId: user.id,
      message: 'Show my cold email to Apple recruiters'
    });

    expect(chatRes.intent).toBe('cold_email_outreach');
    expect(chatRes.grounding.status).toBe('grounded');
  });
});
