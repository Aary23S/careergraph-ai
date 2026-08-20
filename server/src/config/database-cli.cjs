require('dotenv').config();

const dialect = process.env.DATABASE_DIALECT || 'postgres';
const shared = dialect === 'postgres'
  ? {
    dialect: 'postgres',
    url: process.env.DATABASE_URL,
  }
  : {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
  };

module.exports = {
  development: shared,
  test: shared,
  production: shared,
};
