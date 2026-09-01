import { Sequelize } from 'sequelize';
import { env } from './env.js';
import { initializeModels } from '../database/models.js';

const sequelizeOptions = {
  dialect: env.databaseDialect,
  logging: false,
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 300000,
  },
};

if (env.databaseDialect === 'sqlite') {
  sequelizeOptions.storage = env.databaseStorage;
}

export const sequelize =
  env.databaseDialect === 'sqlite'
    ? new Sequelize(sequelizeOptions)
    : new Sequelize(env.databaseUrl, sequelizeOptions);

export const models = initializeModels(sequelize);

export async function connectDatabase() {
  await sequelize.authenticate();
  return sequelize;
}

export async function resetDatabase() {
  const force = env.nodeEnv === 'test';
  await sequelize.sync({ force });
}
