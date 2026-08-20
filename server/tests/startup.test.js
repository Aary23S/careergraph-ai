import { jest } from '@jest/globals';
import { startServer } from '../src/start.js';

describe('application startup', () => {
  it('starts successfully after the database connection is established', async () => {
    const connect = jest.fn().mockResolvedValue(undefined);

    const server = await startServer({
      connect,
      port: 0,
      host: '127.0.0.1',
    });

    try {
      expect(connect).toHaveBeenCalledTimes(1);
      expect(server.address()).toEqual(
        expect.objectContaining({
          address: '127.0.0.1',
        }),
      );
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});
