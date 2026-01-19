import Redis from 'ioredis';
import { logger } from './logger';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis error', { error: err.message });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

// Cache helper functions
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Cache get error', { key, error });
    return null;
  }
};

export const cacheSet = async (
  key: string,
  value: any,
  ttlSeconds: number = 300
): Promise<void> => {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error('Cache set error', { key, error });
  }
};

export const cacheDelete = async (key: string): Promise<void> => {
  try {
    await redis.del(key);
  } catch (error) {
    logger.error('Cache delete error', { key, error });
  }
};

export const cacheDeletePattern = async (pattern: string): Promise<void> => {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.error('Cache delete pattern error', { pattern, error });
  }
};

// Rate limiting helpers
export const checkRateLimit = async (
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> => {
  try {
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
    };
  } catch (error) {
    logger.error('Rate limit check error', { key, error });
    return { allowed: true, remaining: maxRequests };
  }
};

// Real-time metrics helpers
export const incrementMetric = async (
  metricKey: string,
  value: number = 1
): Promise<void> => {
  try {
    await redis.incrbyfloat(metricKey, value);
  } catch (error) {
    logger.error('Metric increment error', { metricKey, error });
  }
};

export const getMetric = async (metricKey: string): Promise<number> => {
  try {
    const value = await redis.get(metricKey);
    return value ? parseFloat(value) : 0;
  } catch (error) {
    logger.error('Metric get error', { metricKey, error });
    return 0;
  }
};

export default redis;
