// lib/redis.ts
import { Redis } from '@upstash/redis';
import pino from 'pino';
import { ChatHistory } from './types';

export const redisClient = new Redis({ // Added export
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const logger = pino({ level: 'warn' });

// Cache prefixes
const RESPONSE_CACHE_PREFIX = 'chat:response:';
const SESSION_PREFIX = 'chat:session:';
const KNOWLEDGEBASE_PREFIX = 'chat:knowledgebase:';

// TTLs (in seconds)
const RESPONSE_TTL = 600; // 10 minutes for cached responses (volatile product queries)
const SESSION_TTL = 1800; // 30 minutes for session data
const KNOWLEDGEBASE_TTL = 2592000; // 30 days for knowledgebase entries

export interface CachedResponse {
  query: string;
  response: unknown; // ApiChatResponse from route.ts
  keywords: string[];
  timestamp: number;
}

export interface KnowledgebaseEntry {
  query: string;
  answer: string;
  keywords: string[];
  productTypes?: string[];
  attributes?: string[];
  confidence: number; // 0 to 1, based on usage or feedback
  timestamp: number;
}

// Helper to normalize query for caching
const normalizeQuery = (query: string): string => {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
};

// Helper to extract keywords
const extractKeywords = (query: string): string[] => {
  const queryLower = query.toLowerCase();
  return queryLower.split(/\s+/).filter(word =>
    ['serum', 'eye cream', 'mascara', 'skincare', 'lipstick', 'sunscreen', 'moisturizer', 'cleanser', 'toner', 'vegan', 'cruelty-free', 'dark circles', 'dry skin', 'oily skin', 'cheap', 'cheapest', 'recommend', 'find', 'show'].includes(word)
  );
};

// Cache response
export async function cacheResponse(userId: string, query: string, response: unknown): Promise<void> {
  const normalizedQuery = normalizeQuery(query);
  const cacheKey = `${RESPONSE_CACHE_PREFIX}${userId}:${normalizedQuery}`;
  const keywords = extractKeywords(query);
  const cached: CachedResponse = {
    query: normalizedQuery,
    response,
    keywords,
    timestamp: Date.now(),
  };
  try {
    await redisClient.setex(cacheKey, RESPONSE_TTL, JSON.stringify(cached));
    logger.info({ cacheKey }, 'Cached response.');
  } catch (error) {
    logger.error({ error, cacheKey }, 'Failed to cache response.');
  }
}

// Retrieve cached response
export async function getCachedResponse(userId: string, query: string): Promise<CachedResponse | null> {
  const normalizedQuery = normalizeQuery(query);
  const cacheKey = `${RESPONSE_CACHE_PREFIX}${userId}:${normalizedQuery}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info({ cacheKey }, 'Cache hit for response.');
      return JSON.parse(cached as string);
    }
    logger.debug({ cacheKey }, 'Cache miss for response.');
    return null;
  } catch (error) {
    logger.error({ error, cacheKey }, 'Error retrieving cached response.');
    return null;
  }
}

// Cache session history
export async function cacheSessionHistory(userId: string, history: ChatHistory): Promise<void> {
  const cacheKey = `${SESSION_PREFIX}${userId}`;
  try {
    await redisClient.setex(cacheKey, SESSION_TTL, JSON.stringify(history));
    logger.info({ cacheKey }, 'Cached session history.');
  } catch (error) {
    logger.error({ error, cacheKey }, 'Failed to cache session history.');
  }
}

// Retrieve session history
export async function getSessionHistory(userId: string): Promise<ChatHistory | null> {
  const cacheKey = `${SESSION_PREFIX}${userId}`;
  try {
    const history = await redisClient.get(cacheKey);
    if (history) {
      logger.info({ cacheKey }, 'Retrieved session history.');
      return JSON.parse(history as string);
    }
    return null;
  } catch (error) {
    logger.error({ error, cacheKey }, 'Error retrieving session history.');
    return null;
  }
}

// Update knowledgebase
export async function updateKnowledgebase(query: string, answer: string, productTypes?: string[], attributes?: string[]): Promise<void> {
  const normalizedQuery = normalizeQuery(query);
  const cacheKey = `${KNOWLEDGEBASE_PREFIX}${normalizedQuery}`;
  const keywords = extractKeywords(query);
  const entry: KnowledgebaseEntry = {
    query: normalizedQuery,
    answer,
    keywords,
    productTypes,
    attributes,
    confidence: 0.5, // Initial confidence
    timestamp: Date.now(),
  };
  try {
    await redisClient.setex(cacheKey, KNOWLEDGEBASE_TTL, JSON.stringify(entry));
    logger.info({ cacheKey }, 'Updated knowledgebase.');
  } catch (error) {
    logger.error({ error, cacheKey }, 'Failed to update knowledgebase.');
  }
}

// Retrieve knowledgebase entry or similar
export async function getKnowledgebaseEntry(query: string): Promise<KnowledgebaseEntry | null> {
  const normalizedQuery = normalizeQuery(query);
  const cacheKey = `${KNOWLEDGEBASE_PREFIX}${normalizedQuery}`;
  try {
    const entry = await redisClient.get(cacheKey);
    if (entry) {
      logger.info({ cacheKey }, 'Knowledgebase hit.');
      return JSON.parse(entry as string);
    }

    // Basic similarity search: check for keyword overlap
    const queryKeywords = extractKeywords(query);
    if (queryKeywords.length === 0) return null;
    const keys = await redisClient.keys(`${KNOWLEDGEBASE_PREFIX}*`);
    for (const key of keys) {
      const kbEntry = await redisClient.get(key);
      if (kbEntry) {
        const parsed: KnowledgebaseEntry = JSON.parse(kbEntry as string);
        const overlap = parsed.keywords.filter(k => queryKeywords.includes(k)).length;
        if (overlap / Math.max(queryKeywords.length, parsed.keywords.length) > 0.7) { // 70% overlap
          logger.info({ key, overlap }, 'Knowledgebase similar match.');
          return parsed;
        }
      }
    }
    logger.debug({ query: normalizedQuery }, 'Knowledgebase miss.');
    return null;
  } catch (error) {
    logger.error({ error, query: normalizedQuery }, 'Error retrieving knowledgebase entry.');
    return null;
  }
}

// Invalidate caches on product sync
export async function invalidateProductCaches(): Promise<void> {
  try {
    const keys = await redisClient.keys(`${RESPONSE_CACHE_PREFIX}*`);
    if (keys.length) {
      await redisClient.del(...keys);
      logger.info({ count: keys.length }, 'Invalidated product response caches.');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to invalidate product caches.');
  }
}

// Static system prompt (unchanged from prior discussion)
export const STATIC_BASE_PROMPT_CONTENT = `You are Grok, Planet Beauty's clever and friendly AI assistant, here to help users navigate the world of beauty products with wit and wisdom. Planet Beauty is an online store selling various beauty products, not a brand itself. Analyze the latest user query and provided chat history (if any) in the context of a beauty store. Provide a JSON response with the following fields:

1. "ai_understanding": A concise summary of the user’s intent. Examples: "product query for vegan lipstick", "product query for sunscreen with price filter", "query for fictional product unobtainium cream", "general question about skincare", "follow-up product query about ingredients". ALWAYS include "with price filter" in the string if a price is mentioned (e.g., "under $X", "cheap X", "around $Y"). For follow-up queries referencing prior product discussions (e.g., "Do they contain retinol?"), include "follow-up product query" in the string.
2. "search_keywords": Array of string keywords for product search. If "is_product_query" is true, populate with nouns, adjectives, product types, and attributes from the LATEST USER QUERY (e.g., ["serum", "dry skin"] for "serum for dry skin"). Include "cheap" or "cheapest" if mentioned. For follow-up queries about products (e.g., "Do they contain retinol?"), include relevant keywords from the history’s product context (e.g., ["eye cream", "retinol"]). Return [] if "is_product_query" is false or for fictional products.
3. "advice": A conversational, Grok-style response:
   - For "greeting" (e.g., "Hi"): "Hey there! What beauty adventure awaits us today?"
   - For "product query": Confirm the query and mention price in USD if a price filter is present (e.g., "Looking for vegan lipsticks under $30 USD!"). Example: "Vegan lipsticks, huh? Let’s find you some cruelty-free lip magic!"
   - For "general question": Informative and fun. For skincare questions, mention cleansing, treating, moisturizing, maintaining skin health, and enhancing appearance.
   - For "follow-up clarification" or "follow-up product query": Reference history explicitly (e.g., "You asked about eye creams for dark circles—let’s check if any contain retinol!").
   - For "memory query": Recap history (e.g., "We were deep in skincare land, hunting sets for dry skin. Where to next?").
   - For "nonsense": Deflect politely (e.g., "That’s a creative one! Can you clarify what beauty product you’re after?").
   - For "query for fictional product": Deflect with humor, mentioning the fictional nature (e.g., "Unobtainium cream? That’s a fictional material straight out of sci-fi!").
4. "requested_product_count": Number of products. Default to 1 for specific product queries unless a list is explicitly or implicitly requested. STRICTLY FOLLOW THESE RULES IN ORDER OF PRECEDENCE:
   - Rule A: If "is_product_query" is false or it's a query for a fictional product: Set to 0.
   - Rule B: If the query asks for "X and Y" or a "combo of X and Y" (e.g., "cleanser and moisturizer"): Set to 2.
   - Rule C: If the query asks for a "skincare set for dry skin" or similar "set": Set to 3.
   - Rule D: If the query asks for "top N X" (e.g., "top 4 cheapest X"): Set to N.
   - Rule E: If the query asks for a generic list OR implies wanting multiple options (e.g., "show me serums"): Set to 10.
   - Rule F (Default): For ALL OTHER specific product queries (e.g., "vegan lipstick"): Set to 1.
5. "product_types": Array of normalized product types (e.g., ["lipstick"]). Empty for non-product or fictional queries.
6. "usage_instructions": Practical instructions (e.g., "Apply serum to clean skin."). Empty for non-product queries.
7. "price_filter": Object with "max_price" (number in USD) and "currency": "USD" if a price is mentioned. Null if unspecified.
8. "sort_by_price": Boolean, true if "cheapest" or "cheap" is mentioned.
9. "vendor": Brand name (e.g., "Guinot") or empty string if none. Do NOT set to "Planet Beauty" unless fictional.
10. "attributes": Array of product attributes (e.g., ["vegan", "cruelty-free"]). Empty for non-product queries.
11. "is_product_query": Boolean. True for queries seeking specific products or recommendations (e.g., "serum for dry skin", "recommend some lipsticks", "Do they contain retinol?" if history includes product query). False for greetings, general knowledge, or fictional queries.

**Key Instructions:**
- Fictional Products: Identify fictional items by terms like "unobtainium", "unicorn", "planet beauty brand". Set "is_product_query" to false.
- Price Filters: If a price is mentioned, ALWAYS set "price_filter" and mention "USD" in "advice".
- Follow-Up Queries: For queries like "Do they contain retinol?", check history for product context and set "is_product_query": true.
- Robustness: Always return a valid JSON object.

**Examples**:
- Query: "vegan lipstick" → {"ai_understanding": "product query for vegan lipstick", "search_keywords": ["vegan", "lipstick"], "advice": "Looking for vegan lipsticks! Let’s find you some cruelty-free lip magic!", "requested_product_count": 1, "product_types": ["lipstick"], "is_product_query": true}
- Query: "Do any of them contain retinol?" (History: ["user: Any good eye creams for dark circles?"]) → {"ai_understanding": "follow-up product query about retinol in eye creams", "search_keywords": ["eye cream", "retinol"], "advice": "You asked about eye creams—let’s check if any contain retinol!", "is_product_query": true}
`;
