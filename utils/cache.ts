// d:\PB_NEW7\utils\cache.ts
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * A caching utility function that:
 * 1. Generates a consistent cache key
 * 2. Checks Redis cache first
 * 3. Falls back to origin if cache miss
 * 4. Updates cache with new data
 * 
 * @param key - Base key for caching
 * @param getter - Function to get fresh data if cache miss
 * @param ttl - Time to live in seconds
 * @returns Cached or fresh data
 */
export async function cache<T>(
  key: string,
  getter: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  try {
    // Generate consistent cache key
    const cacheKey = generateCacheKey(key);
    
    // Try to get from Redis cache
    const cached = await redis.get<T>(cacheKey);
    
    if (cached) {
      console.log(`Cache hit for key: ${cacheKey}`);
      return cached;
    }
    
    console.log(`Cache miss for key: ${cacheKey}`);
    
    // Get fresh data
    const freshData = await getter();
    
    // Store in cache
    await redis.set(cacheKey, freshData, { ex: ttl });
    
    return freshData;
  } catch (error) {
    console.error('Cache operation failed:', error);
    // Fallback to direct getter on error
    return getter();
  }
}

/**
 * Generate a consistent, Redis-safe cache key
 * 
 * @param baseKey - Base key to hash
 * @returns SHA-1 hash of the key
 */
export function generateCacheKey(baseKey: string): string {
  const crypto = require('crypto');
  return `cache:${crypto.createHash('sha1').update(baseKey).digest('hex')}`;
}