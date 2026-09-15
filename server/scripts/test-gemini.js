import { aiService } from '../src/services/ai/ai.service.js';
import { env } from '../src/config/env.js';
import { GeminiProvider } from '../src/services/ai/gemini-provider.js';

console.log('==================================================');
console.log('WARNING: DEVELOPMENT ONLY SCRIPT');
console.log('This script tests the Gemini API provider integration.');
console.log('==================================================\n');

async function testGemini() {
  console.log('[Configuration]');
  console.log(`GEMINI_ENABLED: ${env.geminiEnabled}`);
  console.log(`GEMINI_MODEL: ${env.geminiModel}`);
  console.log(`AI_PROVIDER: ${env.aiProvider}`);
  console.log(`AI_FALLBACK_PROVIDER: ${env.aiFallbackProvider}`);
  
  const hasKey = !!env.geminiApiKey;
  console.log(`GEMINI_API_KEY Configured: ${hasKey}`);
  
  if (!hasKey || !env.geminiEnabled) {
    console.error('\n[Error] Cannot test Gemini: provider is disabled or missing API key.');
    process.exit(1);
  }

  // Force provider to Gemini for this script
  aiService.provider = new GeminiProvider();
  
  console.log('\n[Generation Test]');
  console.log('Provider resolving to:', aiService.provider.constructor.name);
  console.log('Model Name:', aiService.provider.modelName);
  console.log('Sending minimal test prompt...');

  try {
    const start = Date.now();
    const result = await aiService.generateText('Respond with exactly this word: "SUCCESS"', { operation: 'test' });
    const latency = Date.now() - start;

    console.log('\n[Result]');
    console.log(`Latency: ${latency}ms`);
    console.log(`Response: ${result}`);
    console.log('\n✅ Gemini integration works!');
  } catch (err) {
    console.error('\n❌ Gemini integration failed:');
    console.error(err.message);
  }
}

testGemini().catch(console.error);
