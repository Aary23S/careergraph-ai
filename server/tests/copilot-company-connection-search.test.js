import { models, resetDatabase } from '../src/config/database.js';
import { CopilotChatService } from '../src/services/copilot/copilot-chat.service.js';

describe('Copilot explicit company connection search', () => {
  let user;
  let selectedPwJob;

  beforeAll(async () => {
    await resetDatabase();
    user = await models.User.create({
      email: 'company-search@example.com',
      passwordHash: 'hash',
    });

    selectedPwJob = await models.Job.create({
      user_id: user.id,
      title: 'DevOps Engineer',
      status: 'saved',
    });

    await models.Connection.bulkCreate([
      {
        user_id: user.id,
        name: 'Mira Patel',
        company: 'Microsoft',
        title: 'Cloud Engineer',
      },
      {
        user_id: user.id,
        name: 'Nitin Manjunath',
        company: 'PW (PhysicsWallah)',
        title: 'Software Engineer',
      },
    ], { individualHooks: true });
  });

  it('uses the explicitly named company instead of selected job context', async () => {
    const result = await CopilotChatService.sendChat({
      userId: user.id,
      message: 'Find all connections in Microsoft',
      context: { jobId: selectedPwJob.id },
    });

    expect(result.intent).toBe('referral_search');
    expect(result.message).toContain('Microsoft');
    expect(result.message).toContain('Mira Patel');
    expect(result.message).not.toContain('PhysicsWallah');
    expect(result.message).not.toContain('DevOps Engineer');
    expect(result.references).toHaveLength(1);
    expect(result.references[0].label).toContain('Microsoft');
    expect(result.data.connections).toHaveLength(1);
    expect(result.data.connections[0].company).toBe('Microsoft');
  });

  it('does not append unrelated connections when the named company has no matches', async () => {
    const result = await CopilotChatService.sendChat({
      userId: user.id,
      message: 'Find all connections in Amazon',
      context: { jobId: selectedPwJob.id },
    });

    expect(result.message).toContain('no connections at **Amazon**');
    expect(result.message).not.toContain('PhysicsWallah');
    expect(result.references).toHaveLength(0);
    expect(result.data.connections).toHaveLength(0);
  });

  it.each([
    'give me the list of connections from Microsoft',
    'find connections from Microsoft',
  ])('extracts Microsoft from conversational company queries: %s', async (message) => {
    const result = await CopilotChatService.sendChat({
      userId: user.id,
      message,
      context: { jobId: selectedPwJob.id },
    });

    expect(result.message).toContain('Microsoft');
    expect(result.message).toContain('Mira Patel');
    expect(result.message).not.toContain('PhysicsWallah');
    expect(result.data.connections).toHaveLength(1);
    expect(result.data.connections[0].company).toBe('Microsoft');
  });
});
