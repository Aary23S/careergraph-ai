import assert from 'node:assert';
import { CopilotChatService } from '../src/services/copilot/copilot-chat.service.js';

describe('Copilot Multi-Turn Conversation & Intent Routing Suite', () => {
  it('should classify "create a professional message to Hari Bala Ganesh" as action_proposal', () => {
    const intent = CopilotChatService.classifyIntentDeterminist('create a professional message to Hari Bala Ganesh');
    assert.strictEqual(intent, 'action_proposal', `Expected action_proposal, got ${intent}`);
  });

  it('should classify "send a message to John" as action_proposal', () => {
    const intent = CopilotChatService.classifyIntentDeterminist('send a message to John');
    assert.strictEqual(intent, 'action_proposal', `Expected action_proposal, got ${intent}`);
  });

  it('should classify "draft outreach for Google" as action_proposal', () => {
    const intent = CopilotChatService.classifyIntentDeterminist('draft outreach for Google');
    assert.strictEqual(intent, 'action_proposal', `Expected action_proposal, got ${intent}`);
  });

  it('should classify "who are the suitable connections in Apple?" as referral_search', () => {
    const intent = CopilotChatService.classifyIntentDeterminist('who are the suitable connections in Apple?');
    assert.strictEqual(intent, 'referral_search', `Expected referral_search, got ${intent}`);
  });
});
