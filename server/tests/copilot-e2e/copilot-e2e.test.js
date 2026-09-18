import fs from 'fs';
import path from 'path';
import { resetDemoDataset } from '../../scripts/demo-reset.js';
import { models } from '../../src/config/database.js';
import { CopilotChatService } from '../../src/services/copilot/copilot-chat.service.js';
import { QueryUnderstandingService } from '../../src/services/copilot/query-understanding.service.js';
import { CompanyNormalizerService } from '../../src/services/copilot/company-normalizer.service.js';

describe('Copilot Grounded Operations Agent - E2E Suite', () => {
  let userId;

  beforeAll(async () => {
    process.env.AI_ENABLED = 'false';
    await resetDemoDataset();
    const userFixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'demo', 'fixtures', 'demo-user.json'), 'utf8'));
    userId = userFixture.id;
  });

  describe('Phase 1: Query Understanding & Precedence', () => {
    test('extracts explicit company entity with highest precedence', () => {
      const res = QueryUnderstandingService.understandQuery({
        message: 'connections from Microsoft',
        selectedContext: { company: 'Google' },
        userId
      });

      expect(res.entities.company.value.toLowerCase()).toContain('microsoft');
      expect(res.entities.company.source).toBe('explicit_query');
      expect(res.intent).toBe('connection_search');
    });

    test('uses UI selected context when query lacks explicit company', () => {
      const res = QueryUnderstandingService.understandQuery({
        message: 'show network connections',
        selectedContext: { company: 'Apple' },
        userId
      });

      expect(res.entities.company.value).toBe('Apple');
      expect(res.entities.company.source).toBe('ui_selected');
    });
  });

  describe('Phase 1.1: Company Normalizer', () => {
    test('canonicalizes company aliases correctly', () => {
      expect(CompanyNormalizerService.normalizeCompany('Microsoft India')).toBe('microsoft');
      expect(CompanyNormalizerService.normalizeCompany('Microsoft Corporation')).toBe('microsoft');
      expect(CompanyNormalizerService.normalizeCompany('MSFT')).toBe('microsoft');
      expect(CompanyNormalizerService.normalizeCompany('AWS')).toBe('amazon');
    });

    test('rejects stop words to prevent false positive entity extractions', () => {
      expect(CompanyNormalizerService.isPlausibleEntity('from')).toBe(false);
      expect(CompanyNormalizerService.isPlausibleEntity('the')).toBe(false);
      expect(CompanyNormalizerService.isPlausibleEntity('Microsoft')).toBe(true);
    });
  });

  describe('Phase 2 & 3: Tool Registry & Grounding Contract', () => {
    test('explicit company query returns only matching company records', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId,
        message: 'connections from CloudScale'
      });

      expect(chatRes.aiStatus).toBe('success');
      expect(chatRes.grounding.status).toBe('grounded');
      expect(chatRes.grounding.fallbackUsed).toBe(false);
      expect(chatRes.data.connections).toBeDefined();

      chatRes.data.connections.forEach(conn => {
        expect(conn.company.toLowerCase()).toContain('cloudscale');
      });
    });

    test('explicit query with 0 database records returns no_data and NO fallback', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId,
        message: 'Find people at Amazon'
      });

      expect(chatRes.grounding.status).toBe('no_data');
      expect(chatRes.grounding.sourceCount).toBe(0);
      expect(chatRes.grounding.fallbackUsed).toBe(false);
      expect(chatRes.message).toContain('found no records matching Amazon');
    });

    test('refuses unrecorded hiring claim questions', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId,
        message: 'Who is hiring at Microsoft?'
      });

      expect(chatRes.grounding.status).toBe('no_data');
      expect(chatRes.message).toContain('do not have verified hiring or internal operational records');
    });

    test('direct draft generation produces instant editable draft with verified fields', async () => {
      const chatRes = await CopilotChatService.sendChat({
        userId,
        message: 'Draft a message to Marcus Vance'
      });

      expect(chatRes.grounding.status).toBe('draft');
      expect(chatRes.data.draft).toBeDefined();
      expect(chatRes.data.draft).toContain('Marcus Vance');
      expect(chatRes.data.recipient.company).toBeDefined();
    });

    test('tenant isolation guarantees zero cross-user data leakage', async () => {
      const otherUser = await models.User.create({
        email: `isolated_${Date.now()}@example.com`,
        passwordHash: 'dummy_hash_123',
        name: 'Isolated User',
        role: 'user'
      });

      const chatRes = await CopilotChatService.sendChat({
        userId: otherUser.id,
        message: 'connections from CloudScale'
      });

      expect(chatRes.grounding.status).toBe('no_data');
      expect(chatRes.grounding.sourceCount).toBe(0);
    });
  });
});
