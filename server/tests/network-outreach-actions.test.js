import { jest } from '@jest/globals';
import { ActionExecutor } from '../src/services/actions/action-executor.service.js';
import { ActionModel } from '../src/services/actions/action.model.js';
import { TargetResolver } from '../src/services/actions/target-resolver.js';
import { ActionTypes, TargetTypes, ActionStatuses, OUTREACH_STATUSES } from '../src/services/actions/action-registry.js';
import { models, resetDatabase } from '../src/config/database.js';
import { emailService } from '../src/services/email.service.js';

describe('Phase H7-G: Network & Outreach Actions', () => {
  const userAId = 'user-h7g-a-1111-1111-111111111111';
  const userBId = 'user-h7g-b-2222-2222-222222222222';

  let connUserA;
  let connUserB;
  let jobUserA;
  let jobUserB;

  beforeAll(async () => {
    await resetDatabase();

    // Seed test users
    await models.User.create({ id: userAId, email: 'usera@careergraph.ai', passwordHash: 'hash' });
    await models.User.create({ id: userBId, email: 'userb@careergraph.ai', passwordHash: 'hash' });

    // Seed jobs
    jobUserA = await models.Job.create({
      user_id: userAId,
      title: 'Senior Backend Engineer',
      company: 'Microsoft',
      status: 'saved'
    });

    jobUserB = await models.Job.create({
      user_id: userBId,
      title: 'Staff Frontend Engineer',
      company: 'Google',
      status: 'saved'
    });

    // Seed connections
    connUserA = await models.Connection.create({
      user_id: userAId,
      name: 'Rahul Sharma',
      company: 'Microsoft',
      title: 'Principal Engineering Manager',
      email: 'rahul@microsoft.com',
      relationshipStatus: 'not_contacted'
    });

    connUserB = await models.Connection.create({
      user_id: userBId,
      name: 'Sarah Connor',
      company: 'Google',
      title: 'Director of Product',
      email: 'sarah@google.com',
      relationshipStatus: 'not_contacted'
    });
  });

  function createConfirmedAction(userId, actionType, target, payload = {}) {
    const action = new ActionModel({
      userId,
      actionType,
      target,
      payload,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      expirationMs: 60000
    });
    action.status = ActionStatuses.CONFIRMED;
    return action;
  }

  describe('Connection Target Resolution', () => {
    it('resolves connection target by name for user A', async () => {
      const res = await TargetResolver.resolve(userAId, TargetTypes.CONNECTION, 'Rahul');
      expect(res.resolvedTarget).toBeDefined();
      expect(res.resolvedTarget.id).toBe(connUserA.id);
    });

    it('resolves connection target by company for user A', async () => {
      const res = await TargetResolver.resolve(userAId, TargetTypes.CONNECTION, 'Microsoft');
      expect(res.resolvedTarget).toBeDefined();
      expect(res.resolvedTarget.id).toBe(connUserA.id);
    });

    it('resolves connection target by title for user A', async () => {
      const res = await TargetResolver.resolve(userAId, TargetTypes.CONNECTION, 'Principal Engineering');
      expect(res.resolvedTarget).toBeDefined();
      expect(res.resolvedTarget.id).toBe(connUserA.id);
    });

    it('resolves connection target by email for user A', async () => {
      const res = await TargetResolver.resolve(userAId, TargetTypes.CONNECTION, 'rahul@microsoft.com');
      expect(res.resolvedTarget).toBeDefined();
      expect(res.resolvedTarget.id).toBe(connUserA.id);
    });

    it('does not resolve user B connection when user A searches', async () => {
      const res = await TargetResolver.resolve(userAId, TargetTypes.CONNECTION, 'Sarah');
      expect(res.resolvedTarget).toBeUndefined();
      expect(res.candidates.length).toBe(0);
    });
  });

  describe('Outreach Draft Creation & External Send Guard', () => {
    it('creates outreach draft record with status generated', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.CREATE_OUTREACH_DRAFT, { type: TargetTypes.CONNECTION, id: connUserA.id }, {
        jobId: jobUserA.id,
        intent: 'referral_request',
        tone: 'professional',
        message: 'Hi Rahul, I noticed an open Backend Engineer role at Microsoft.'
      });

      const res = await ActionExecutor.executeAction({ action, authenticatedUserId: userAId });

      expect(res.status).toBe(ActionStatuses.COMPLETED);
      expect(res.result.draftId).toBeDefined();
      expect(res.result.status).toBe('generated');
      expect(res.result.note).toContain('No external message was sent');

      const persistedDraft = await models.OutreachAiDraft.findByPk(res.result.draftId);
      expect(persistedDraft).not.toBeNull();
      expect(persistedDraft.draft).toContain('Rahul');
    });

    it('MANDATORY GUARD: zero external communication sends occur during draft creation', async () => {
      const sendDigestSpy = jest.spyOn(emailService, 'sendDigest').mockImplementation(() => Promise.resolve({ success: true }));
      const providerSpy = jest.spyOn(emailService.provider, 'sendEmail').mockImplementation(() => Promise.resolve({ success: true }));

      const action = createConfirmedAction(userAId, ActionTypes.CREATE_OUTREACH_DRAFT, { type: TargetTypes.CONNECTION, id: connUserA.id }, {
        intent: 'networking',
        message: 'Hello Rahul, let us connect.'
      });

      await ActionExecutor.executeAction({ action, authenticatedUserId: userAId });

      expect(sendDigestSpy).toHaveBeenCalledTimes(0);
      expect(providerSpy).toHaveBeenCalledTimes(0);

      sendDigestSpy.mockRestore();
      providerSpy.mockRestore();
    });

    it('rejects outreach draft creation if target job belongs to another tenant', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.CREATE_OUTREACH_DRAFT, { type: TargetTypes.CONNECTION, id: connUserA.id }, {
        jobId: jobUserB.id, // User B's job!
        intent: 'referral_request',
        message: 'Cross tenant test'
      });

      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userAId })
      ).rejects.toThrow(/Unauthorized/i);
    });
  });

  describe('Outreach Logging & Relationship Status', () => {
    it('logs outreach and updates relationship status atomically', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.LOG_OUTREACH, { type: TargetTypes.CONNECTION, id: connUserA.id }, {
        outreachStatus: 'contacted',
        jobId: jobUserA.id,
        notes: 'Sent message asking for referral for Backend role.'
      });

      const res = await ActionExecutor.executeAction({ action, authenticatedUserId: userAId });

      expect(res.status).toBe(ActionStatuses.COMPLETED);
      expect(res.result.outreachId).toBeDefined();

      const updatedConn = await models.Connection.findByPk(connUserA.id);
      expect(updatedConn.relationshipStatus).toBe('contacted');

      const outreachEvents = await models.OutreachEvent.findAll({ where: { outreach_id: res.result.outreachId } });
      expect(outreachEvents.length).toBeGreaterThan(0);
      expect(outreachEvents[0].status).toBe('contacted');
    });

    it('updates relationship status independently', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.UPDATE_RELATIONSHIP_STATUS, { type: TargetTypes.CONNECTION, id: connUserA.id }, {
        relationshipStatus: 'conversation'
      });

      const res = await ActionExecutor.executeAction({ action, authenticatedUserId: userAId });

      expect(res.status).toBe(ActionStatuses.COMPLETED);
      expect(res.result.relationshipStatus).toBe('conversation');

      const updatedConn = await models.Connection.findByPk(connUserA.id);
      expect(updatedConn.relationshipStatus).toBe('conversation');
    });

    it('rejects update relationship status if invalid status enum provided', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.UPDATE_RELATIONSHIP_STATUS, { type: TargetTypes.CONNECTION, id: connUserA.id }, {
        relationshipStatus: 'super_best_friends'
      });

      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userAId })
      ).rejects.toThrow(/Invalid relationship status/i);
    });
  });

  describe('Schedule Follow-Up & Add Note for Connection', () => {
    it('schedules follow up for connection target', async () => {
      const followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const action = createConfirmedAction(userAId, ActionTypes.SCHEDULE_FOLLOWUP, { type: TargetTypes.CONNECTION, id: connUserA.id }, {
        followUpAt: followUpDate,
        jobId: jobUserA.id
      });

      const res = await ActionExecutor.executeAction({ action, authenticatedUserId: userAId });

      expect(res.status).toBe(ActionStatuses.COMPLETED);

      const outreach = await models.Outreach.findOne({ where: { connection_id: connUserA.id, user_id: userAId } });
      expect(outreach).not.toBeNull();
      expect(outreach.followUpDate).toBeDefined();
    });

    it('rejects scheduling follow-up if linked job belongs to another user', async () => {
      const followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const action = createConfirmedAction(userAId, ActionTypes.SCHEDULE_FOLLOWUP, { type: TargetTypes.CONNECTION, id: connUserA.id }, {
        followUpAt: followUpDate,
        jobId: jobUserB.id // User B job!
      });

      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userAId })
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('adds a CRM note for connection target', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.ADD_NOTE, { type: TargetTypes.CONNECTION, id: connUserA.id }, {
        content: 'Rahul offered to refer me for the Backend Engineer position at Microsoft.'
      });

      const res = await ActionExecutor.executeAction({ action, authenticatedUserId: userAId });

      expect(res.status).toBe(ActionStatuses.COMPLETED);
      expect(res.result.noteId).toBeDefined();

      const noteRecord = await models.Note.findByPk(res.result.noteId);
      expect(noteRecord.entityType).toBe(TargetTypes.CONNECTION);
      expect(noteRecord.entityId).toBe(connUserA.id);
      expect(noteRecord.content).toContain('offered to refer me');
    });
  });

  describe('Tenant Security & Idempotency', () => {
    it('rejects user A attempting to execute connection action belonging to user B', async () => {
      const action = createConfirmedAction(userBId, ActionTypes.ADD_NOTE, { type: TargetTypes.CONNECTION, id: connUserB.id }, {
        content: 'Test note'
      });

      await expect(
        ActionExecutor.executeAction({ action, authenticatedUserId: userAId })
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('returns cached result on double execution without duplicate records', async () => {
      const action = createConfirmedAction(userAId, ActionTypes.ADD_NOTE, { type: TargetTypes.CONNECTION, id: connUserA.id }, {
        content: 'Unique note content for idempotency check'
      });

      const firstRes = await ActionExecutor.executeAction({ action, authenticatedUserId: userAId });
      const secondRes = await ActionExecutor.executeAction({ action, authenticatedUserId: userAId });

      expect(firstRes.result.noteId).toBe(secondRes.result.noteId);

      const notesCount = await models.Note.count({
        where: { content: 'Unique note content for idempotency check' }
      });
      expect(notesCount).toBe(1);
    });
  });
});
