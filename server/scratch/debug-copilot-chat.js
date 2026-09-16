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
    const res = await CopilotChatService.sendChat({
      userId: user.id,
      message: 'Who can refer me for my top job?',
      authorizedContext: {}
    });
    console.log('CopilotChatService result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Caught top-level error:', err);
  }
}

debugChat().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
