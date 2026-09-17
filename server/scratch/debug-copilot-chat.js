import { CopilotChatService } from '../src/services/copilot/copilot-chat.service.js';
import { models } from '../src/config/database.js';

async function debugChat() {
  const user = await models.User.findOne();
  if (!user) {
    console.error('No user found in database!');
    process.exit(1);
  }

  console.log('Testing sendChat for user:', user.id, user.email);
  try {
    console.log('\n--- TEST 1: Specific Company Query ("who can refer me in google?") ---');
    const res1 = await CopilotChatService.sendChat({
      userId: user.id,
      message: 'who can refer me in google?',
      authorizedContext: {}
    });
    console.log('Result 1 message:\n', res1.message);
    console.log('Result 1 references:', JSON.stringify(res1.references, null, 2));

    console.log('\n--- TEST 2: General Referral Query ("who can refer me for my top job?") ---');
    const res2 = await CopilotChatService.sendChat({
      userId: user.id,
      message: 'who can refer me for my top job?',
      authorizedContext: {}
    });
    console.log('Result 2 message:\n', res2.message);
    console.log('Result 2 references:', JSON.stringify(res2.references, null, 2));
  } catch (err) {
    console.error('Caught top-level error:', err);
  }
}

debugChat().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
