import fetch from 'node-fetch';

async function test() {
  try {
    console.log('Sending register request over network to port 5001...');
    const res = await fetch('http://localhost:5001/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: `test-net-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Network Test User'
      })
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text);
  } catch (err) {
    console.error('Network request failed:', err);
  }
}

test();
