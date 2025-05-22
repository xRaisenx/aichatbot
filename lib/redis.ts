// lib/redis.ts
import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';
import pino from 'pino';
import { ChatApiResponse, ChatHistory } from './types';

export const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://verified-whale-32144.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'AX2QAAIjcDEyNDQxMjMwMTc0MGQ0YjA2YTA1Y2MxNDVmZDMzNTBhYnAxMA',
});

const logger = pino({ level: 'info' });

const RESPONSE_CACHE_PREFIX = 'chat:response:';
const SESSION_PREFIX = 'chat:session:';
const KNOWLEDGEBASE_PREFIX = 'chat:knowledgebase:';
const EMBEDDING_PREFIX = 'chat:embedding:';

const RESPONSE_TTL = 600;
const SESSION_TTL = 1800;
const KNOWLEDGEBASE_TTL = 2592000;
const EMBEDDING_TTL = 86400;

export interface CachedResponse {
  response: ChatApiResponse;
  timestamp: number;
}

export interface KnowledgebaseEntry {
  query: string;
  answer: string;
  keywords: string[];
  productTypes?: string[];
  attributes?: string[];
  confidence: number;
  timestamp: number;
}

export interface CachedEmbedding {
  query: string;
  intent: string;
  fields: Partial<ChatApiResponse>;
  timestamp: number;
}

function generateDynamicCacheKey(userId: string, query: string, chatHistory: ChatHistory): string {
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
  const historyString = JSON.stringify(chatHistory.map(msg => ({
    role: msg.role,
    content: (msg.content ?? msg.text ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  })));
  const combinedKeyData = `${userId}:::${normalizedQuery}:::${historyString}`;
  const hash = createHash('sha1').update(combinedKeyData).digest('hex');
  return `${RESPONSE_CACHE_PREFIX}${hash}`;
}

const normalizeQuerySimple = (query: string): string => {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
};

const extractKeywordsSimple = (query: string): string[] => {
  const queryLower = query.toLowerCase();
  return queryLower
    .split(/\s+/)
    .filter(word =>
      [
        'serum', 'eye', 'mascara', 'skincare', 'lipstick', 'sunscreen',
        'moisturizer', 'cleanser', 'toner', 'shampoo', 'conditioner',
        'lotion', 'mask', 'treatment', 'oil', 'balm', 'cream', 'gel',
        'powder', 'spray', 'set', 'combo', 'brands', 'vegan', 'cruelty-free',
        'dark circles', 'dry', 'oily', 'sensitive', 'redness', 'acne',
        'cheap', 'cheapest', 'recommend', 'find', 'show', 'best', 'top',
        'paraben-free', 'sulfate-free', 'fragrance-free', 'hyaluronic',
        'retinol', 'vitamin c', 'niacinamide', 'ceramides', 'spf', 'face', 'body'
      ].includes(word)
    );
};

export async function cacheResponse(userId: string, query: string, response: ChatApiResponse, history: ChatHistory, ttlSeconds = RESPONSE_TTL): Promise<void> {
  const cacheKey = generateDynamicCacheKey(userId, query, history);
  const dataToCache: CachedResponse = { response, timestamp: Date.now() };
  try {
    const ttl = response.cache_ttl_override || ttlSeconds;
    await redisClient.setex(cacheKey, ttl, JSON.stringify(dataToCache));
    logger.info({ cacheKey, ttl }, 'Cached response.');
  } catch (error) {
    logger.error({ error, cacheKey }, 'Failed to cache response.');
  }
}

export async function getCachedResponse(userId: string, query: string, history: ChatHistory): Promise<CachedResponse | null> {
  const cacheKey = generateDynamicCacheKey(userId, query, history);
  try {
    const cached = await redisClient.get<string>(cacheKey);
    if (cached) {
      logger.info({ cacheKey }, 'Cache hit for response.');
      try {
        const parsed = JSON.parse(cached) as CachedResponse;
        return parsed;
      } catch (parseError) {
        logger.error({ parseError, cacheKey, rawData: cached }, 'Failed to parse cached response.');
        return null;
      }
    }
    logger.debug({ cacheKey }, 'Cache miss for response.');
    return null;
  } catch (error) {
    logger.error({ error, cacheKey }, 'Error retrieving cached response.');
    return null;
  }
}

export async function cacheSessionHistory(userId: string, history: ChatHistory): Promise<void> {
  const cacheKey = `${SESSION_PREFIX}${userId}`;
  try {
    await redisClient.setex(cacheKey, SESSION_TTL, JSON.stringify(history));
    logger.info({ cacheKey }, 'Cached session history.');
  } catch (error) {
    logger.error({ error, cacheKey }, 'Failed to cache session history.');
  }
}

export async function getSessionHistory(userId: string): Promise<ChatHistory | null> {
  const cacheKey = `${SESSION_PREFIX}${userId}`;
  try {
    const history = await redisClient.get<string>(cacheKey);
    if (history) {
      logger.debug({ cacheKey, rawHistory: history }, 'Attempting to parse session history.');
      try {
        const cleanedHistory = history.replace(/^\uFEFF/, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        const parsedHistory: ChatHistory = JSON.parse(cleanedHistory);
        return parsedHistory.map(msg => ({
          role: msg.role,
          content: msg.content ?? msg.text ?? ''
        }));
      } catch (parseError) {
        logger.error({ parseError, cacheKey, rawData: history }, 'Failed to parse session history.');
        return null;
      }
    }
    return null;
  } catch (error) {
    logger.error({ error, cacheKey }, 'Error retrieving session history.');
    return null;
  }
}

export async function cacheEmbedding(userId: string, query: string, intent: string, fields: Partial<ChatApiResponse>): Promise<void> {
  const normalizedQuery = normalizeQuerySimple(query);
  const cacheKey = `${EMBEDDING_PREFIX}${userId}:${normalizedQuery}`;
  const cached: CachedEmbedding = { query: normalizedQuery, intent, fields, timestamp: Date.now() };
  try {
    await redisClient.setex(cacheKey, EMBEDDING_TTL, JSON.stringify(cached));
    logger.info({ cacheKey }, 'Cached embedding.');
  } catch (error) {
    logger.error({ error, cacheKey }, 'Failed to cache embedding.');
  }
}

export async function getCachedEmbedding(userId: string, query: string): Promise<CachedEmbedding | null> {
  const normalizedQuery = normalizeQuerySimple(query);
  const cacheKey = `${EMBEDDING_PREFIX}${userId}:${normalizedQuery}`;
  try {
    const cached = await redisClient.get<string>(cacheKey);
    if (cached) {
      try {
        const cleanedCached = cached.replace(/^\uFEFF/, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        return JSON.parse(cleanedCached);
      } catch (parseError) {
        logger.error({ parseError, cacheKey, rawData: cached }, 'Failed to parse cached embedding.');
        return null;
      }
    }
    return null;
  } catch (error) {
    logger.error({ error, cacheKey }, 'Error retrieving cached embedding.');
    return null;
  }
}

export async function updateKnowledgebase(query: string, answer: string, productTypes?: string[], attributes?: string[]): Promise<void> {
  const normalizedQuery = normalizeQuerySimple(query);
  const entry: KnowledgebaseEntry = {
    query: normalizedQuery,
    answer,
    keywords: extractKeywordsSimple(query),
    productTypes,
    attributes,
    confidence: 0.5,
    timestamp: Date.now(),
  };
  const cacheKey = `${KNOWLEDGEBASE_PREFIX}${normalizedQuery}`;
  try {
    const dataToStore = JSON.stringify(entry);
    logger.debug({ cacheKey, dataToStore }, 'Writing to knowledgebase');
    await redisClient.setex(cacheKey, KNOWLEDGEBASE_TTL, dataToStore);
    logger.info({ cacheKey }, 'Updated knowledgebase.');
  } catch (error) {
    logger.error({ error, cacheKey }, 'Failed to update knowledgebase.');
  }
}

// lib/redis.ts (only showing getKnowledgebaseEntry)
export async function getKnowledgebaseEntry(query: string): Promise<KnowledgebaseEntry | null> {
  const normalizedQuery = normalizeQuerySimple(query);
  const cacheKey = `${KNOWLEDGEBASE_PREFIX}${normalizedQuery}`;
  try {
    const entry = await redisClient.get<string>(cacheKey);
    if (entry) {
      logger.info({ cacheKey }, 'Knowledgebase hit.');
      logger.debug({ cacheKey, rawEntry: entry }, 'Attempting to parse knowledgebase entry.');
      let cleanedEntry = entry;
      try {
        cleanedEntry = entry.replace(/^\uFEFF/, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        return JSON.parse(cleanedEntry);
      } catch (parseError) {
        logger.error({ parseError, cacheKey, rawData: entry, cleanedData: cleanedEntry }, 'Failed to parse knowledgebase entry.');
        return null;
      }
    }
    const queryKeywords = extractKeywordsSimple(query);
    if (queryKeywords.length === 0) return null;
    const keys = await redisClient.keys(`${KNOWLEDGEBASE_PREFIX}*`);
    let bestMatch: KnowledgebaseEntry | null = null;
    let maxOverlapScore = 0;
    for (const key of keys) {
      const kbEntry = await redisClient.get<string>(key);
      if (!kbEntry) continue;
      try {
        const cleanedKbEntry = kbEntry.replace(/^\uFEFF/, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        const parsed: KnowledgebaseEntry = JSON.parse(cleanedKbEntry);
        const entryKeywords = parsed.keywords || [];
        const overlapCount = entryKeywords.filter(k => queryKeywords.includes(k)).length;
        const score = overlapCount / Math.max(entryKeywords.length, queryKeywords.length, 1);
        if (score > 0.3 && score > maxOverlapScore) {
          bestMatch = parsed;
          maxOverlapScore = score;
        }
      } catch (parseError) {
        logger.error({ parseError, key, rawEntry: kbEntry }, 'Failed to parse KB entry during scan.');
        continue;
      }
    }
    if (bestMatch) {
      logger.info({ cacheKey, overlapScore: maxOverlapScore }, 'Similar knowledgebase match found.');
      bestMatch.confidence = Math.max(bestMatch.confidence, maxOverlapScore);
      return bestMatch;
    }
    logger.debug({ query: normalizedQuery }, 'Knowledgebase miss.');
    return null;
  } catch (error) {
    logger.error({ error, query: normalizedQuery }, 'Error retrieving knowledgebase entry.');
    return null;
  }
}

export async function invalidateProductCaches(): Promise<void> {
  try {
    const keys = await redisClient.keys(`${RESPONSE_CACHE_PREFIX}*`);
    if (keys.length) {
      await redisClient.del(...keys);
      logger.info({ count: keys.length }, 'Invalidated dynamic response caches.');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to invalidate dynamic response caches.');
  }
}