import { jest } from '@jest/globals';
import { GeminiProvider } from '../src/services/ai/gemini-provider.js';
import { env } from '../src/config/env.js';

describe('GeminiProvider', () => {
  let provider;

  beforeEach(() => {
    jest.resetAllMocks();
    env.geminiApiKey = 'test-api-key';
    env.geminiEnabled = true;
    env.geminiModel = 'gemini-2.5-flash';
    provider = new GeminiProvider();
    
    if (provider.client) {
      provider.client.models = {
        generateContent: jest.fn()
      };
    }
  });

  it('should throw if disabled', async () => {
    env.geminiEnabled = false;
    const disabledProvider = new GeminiProvider();
    
    await expect(disabledProvider.generateText('hello')).rejects.toThrow('GEMINI_ENABLED is false.');
  });

  it('should generate text successfully', async () => {
    provider.client.models.generateContent.mockResolvedValueOnce({
      text: 'Hello world'
    });

    const result = await provider.generateText('Say hello');
    expect(result).toBe('Hello world');
    expect(provider.client.models.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-flash',
        contents: 'Say hello'
      })
    );
  });

  it('should generate structured JSON output', async () => {
    provider.client.models.generateContent.mockResolvedValueOnce({
      text: '{"result":"success"}'
    });

    const result = await provider.generateStructured('Test output', null);
    expect(result).toEqual({ result: 'success' });
    expect(provider.client.models.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          responseMimeType: 'application/json'
        })
      })
    );
  });

  it('should normalize rate limit errors', async () => {
    provider.client.models.generateContent.mockRejectedValueOnce(new Error('API quota exceeded (429)'));
    
    let error;
    try {
      await provider.generateText('hello');
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.status).toBe(429);
    expect(error.message).toContain('Rate limit exceeded');
  });

  it('should not leak API keys in auth errors', async () => {
    provider.client.models.generateContent.mockRejectedValueOnce(new Error('Invalid API_KEY test-api-key'));
    
    await expect(provider.generateText('hello')).rejects.toThrow('Authentication failed with Gemini API. Check API key configuration.');
  });
});
