import IORedis from 'ioredis';
import { env } from './env.js';

let redisClient = null;
let isRedisConnected = false;

if (env.redisEnabled && env.aiQueueDriver === 'redis') {
  try {
    redisClient = new IORedis(env.redisUrl, {
      maxRetriesPerRequest: null, // REQUIRED for BullMQ
      enableReadyCheck: false,
      connectTimeout: 5000, // Timeout after 5s if offline
      retryStrategy(times) {
        // Retry strategy up to 3 times before failing
        if (times > 3) {
          console.warn('[QueueService] Redis connection failed after 3 attempts. Gracefully falling back.');
          isRedisConnected = false;
          return null; 
        }
        return Math.min(times * 100, 2000);
      }
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('[QueueService] Redis connected successfully.');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      console.warn(`[QueueService] Redis connection error: ${err.message}`);
    });
  } catch (err) {
    console.error(`[QueueService] Failed to initialize Redis client: ${err.message}`);
    isRedisConnected = false;
  }
}

export function getRedisClient() {
  return redisClient;
}

export function isRedisAvailable() {
  return isRedisConnected && redisClient !== null;
}
