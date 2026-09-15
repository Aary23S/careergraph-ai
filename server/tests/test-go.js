import { models, sequelize } from '../src/config/database.js';
import { validateClaims } from '../src/services/ai/guardrails.service.js';
import { ContextBuilder } from '../src/services/copilot/context/context-builder.service.js';
import { DecisionDigestService } from '../src/services/copilot/decision-digest.service.js';

async function run() {
  await sequelize.sync({ force: true });
  
  const userA = await models.User.create({
    email: 'digest_userA@example.com',
    passwordHash: 'hash'
  });

  await models.Profile.create({
    user_id: userA.id,
    name: 'User A',
    title: 'Backend Engineer',
    skills: ['Node.js', 'PostgreSQL'],
    experience_level: 'Senior'
  });

  const jobA = await models.Job.create({
    user_id: userA.id,
    title: 'Senior Backend Engineer',
    company: 'TechCorp',
    status: 'saved',
    matchScore: 0
  });

  const contextPackage = await ContextBuilder.buildContext(userA.id, {
    intent: 'decision_digest',
    query: ''
  });

  const contextText = JSON.stringify(contextPackage.entities || {});
  
  console.log('Context Text:', contextText);
  const claimCheck = validateClaims(contextText, { skills: ['Go'] });
  console.log('Claim Check:', claimCheck);
  
  process.exit(0);
}
run();
