import { models, sequelize } from '../src/config/database.js';

async function run() {
  await sequelize.sync({ force: true });
  try {
    const activeApplications = await models.Application.findAll({
      where: { 
        user_id: '1234',
        status: 'applied'
      },
      order: [['nextFollowUpDate', 'ASC NULLS LAST']],
      limit: 5,
      attributes: ['id', 'status', 'nextFollowUpDate', 'appliedAt']
    });
    console.log('App Success');
  } catch (err) {
    console.error('App Error:', err.message);
  }

  try {
    const topConnections = await models.Connection.findAll({
      where: { user_id: '1234' },
      order: [['referralScore', 'DESC NULLS LAST']],
      limit: 5,
      attributes: ['id', 'name', 'company', 'title', 'referralScore']
    });
    console.log('Conn Success');
  } catch (err) {
    console.error('Conn Error:', err.message);
  }
  process.exit(0);
}
run();
