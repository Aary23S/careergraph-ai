import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize } from '../src/config/database.js';

async function test() {
  const app = createApp();
  const email = `test-login-${Date.now()}@example.com`;
  const password = 'Password123!';

  try {
    console.log('1. Registering user...');
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password,
        name: 'Login Test User'
      });
    console.log('Register Status:', registerRes.status);

    console.log('2. Logging in...');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email,
        password
      });
    console.log('Login Status:', loginRes.status);
    console.log('Login Body:', loginRes.body);
  } catch (err) {
    console.error('Captured test error:', err);
  } finally {
    await sequelize.close();
  }
}

test();
