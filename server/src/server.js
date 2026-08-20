try {
  const { startServer } = await import('./start.js');
  await startServer();
} catch (error) {
  console.error('Failed to start CareerGraph API:', error);
  process.exit(1);
}
