import pg from 'pg';

async function recreate() {
  const client = new pg.Client({
    connectionString: 'postgresql://postgres:aary234786@localhost:5432/postgres'
  });
  await client.connect();
  console.log('Connected to default postgres database.');
  
  // Terminate backend processes
  try {
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'careergraph_test'
        AND pid <> pg_backend_pid();
    `);
    console.log('Terminated active connections to careergraph_test.');
  } catch (err) {
    console.log('No active connections to terminate or error: ' + err.message);
  }

  await client.query('DROP DATABASE IF EXISTS careergraph_test;');
  console.log('Dropped database careergraph_test.');
  
  await client.query('CREATE DATABASE careergraph_test;');
  console.log('Created database careergraph_test.');
  
  await client.end();
}

recreate().catch(console.error);
