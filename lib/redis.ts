// lib/redis.ts

import { Redis as UpstashRedis } from '@upstash/redis';
import { Index } from '@upstash/vector';
import { ChatHistory } from './types'; // LLMStructuredResponse is not used here

export const UPSTASH_VECTOR_INDEX_NAME = 'idx:products_vss';

if (!process.env.UPSTASH_VECTOR_URL || !process.env.UPSTASH_VECTOR_TOKEN) {
  throw new Error('Missing Upstash Vector credentials. Set UPSTASH_VECTOR_URL (for presence check), UPSTASH_VECTOR_REST_URL (for actual URL), and UPSTASH_VECTOR_TOKEN in .env.local.');
}

export const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_TOKEN!,
});

export const redisClient = new UpstashRedis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  retry: {
    retries: 5,
    backoff: (retryCount) => Math.exp(retryCount) * 50,
  },
});

const CHAT_HISTORY_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export async function setEphemeralUserChatHistory(
  userId: string,
  history: ChatHistory,
  ttlSeconds: number = CHAT_HISTORY_TTL_SECONDS
): Promise<void> {
  const key = `user:${userId}:chatHistory`;
  try {
    const value = JSON.stringify(history);
    await redisClient.set(key, value, { ex: ttlSeconds });
    console.log(`Ephemeral chat history set for user ${userId} with TTL ${ttlSeconds}s`);
  } catch (error) {
    console.error(`Error setting ephemeral chat history for user ${userId}:`, error);
  }
}

export async function getEphemeralUserChatHistory(userId: string): Promise<ChatHistory | null> {
  const key: string = `user:${userId}:chatHistory`;
  try {
    const value = await redisClient.get(key);
    if (value === null || value === undefined) {
      console.log(`No ephemeral chat history found for user ${userId}`);
      return null;
    }
    let stringValue: string;
    if (typeof value === 'string') {
      stringValue = value;
    } else if (typeof value === 'object' && value !== null) {
      try {
        stringValue = JSON.stringify(value);
      } catch (error) {
        console.error(`Invalid chat history format for user ${userId}: Cannot convert object to string`, error);
        return null;
      }
    } else {
      console.error(`Invalid chat history format for user ${userId}: Expected string, got ${typeof value}`);
      return null;
    }
    console.log(`Ephemeral chat history found for user ${userId}`);
    try {
      return JSON.parse(stringValue);
    } catch (error) {
      console.error(`Error parsing chat history for user ${userId}:`, error, `\nRaw value: ${stringValue}`);
      return null;
    }
  } catch (error) {
    console.error(`Error getting ephemeral chat history for user ${userId}:`, error);
    return null;
  }
}

export const BASE_SYSTEM_PROMPT_KEY = 'system:baseUnderstandingPrompt_v1';

export const STATIC_BASE_PROMPT_CONTENT = `You are Grok, Planet Beauty's clever and friendly AI assistant, here to help users navigate the world of beauty products with wit and wisdom. Analyze the latest user query and provided chat history (if any) in the context of a beauty store. Provide a JSON response with the following fields:

1. "ai_understanding": A concise summary of the user’s intent. Examples: "product query for vegan lipstick", "product query for sunscreen with price filter", "query for fictional product unobtainium cream", "general question about skincare". ALWAYS include "with price filter" in the string if a price is mentioned (e.g., "under $X", "cheap X", "around $Y").
2. "search_keywords": Array of string keywords for product search. If "is_product_query" is true, populate with nouns, adjectives, and product types from the LATEST USER QUERY (e.g., ["serum", "dry skin"] for "serum for dry skin"). Include "cheap" or "cheapest" if mentioned. Return [] if "is_product_query" is false or for fictional products.
3. "advice": A conversational, Grok-style response:
   - For "greeting" (e.g., "Hi"): "Hey there! What beauty adventure awaits us today?"
   - For "product query": Confirm the query and mention price in USD if a price filter is present (e.g., "Looking for vegan lipsticks under $30 USD!"). Example: "Vegan lipsticks, huh? Let’s find you some cruelty-free lip magic!"
   - For "general question": Informative and fun. For skincare questions, mention cleansing, treating, moisturizing, maintaining skin health, and enhancing appearance (e.g., "Skincare’s like a daily hug for your face—cleansing to remove impurities, treating with serums, moisturizing for hydration, and protecting for a healthy, glowing appearance!").
   - For "follow-up clarification": Reference history (e.g., "You asked about a moisturizer earlier—it’s solo, not a combo. Want a full set instead?").
   - For "memory query": Recap history (e.g., "We were deep in skincare land, hunting sets for dry skin. Where to next?").
   - For "nonsense": Deflect politely (e.g., "That’s a creative one! Can you clarify what beauty product you’re after?").
   - For "query for fictional product": Deflect with humor, mentioning the fictional nature (e.g., "Unobtainium cream? That’s a fictional material straight out of sci-fi! I can’t find it, but how about a real-world moisturizer with specific benefits like hydration?").
4. "requested_product_count": Number of products. Default to 1 for specific product queries unless a list is explicitly or implicitly requested. STRICTLY FOLLOW THESE RULES IN ORDER OF PRECEDENCE:
   - Rule A: If "is_product_query" is false or it's a query for a fictional product: Set to 0.
   - Rule B: If the query asks for "X and Y" or a "combo of X and Y" (e.g., "cleanser and moisturizer"): Set to 2.
   - Rule C: If the query asks for a "skincare set for dry skin" or similar "set": Set to 3 (typically for cleanser, serum, moisturizer).
   - Rule D: If the query asks for "top N X" (e.g., "top 4 cheapest X"): Set to N.
   - Rule E: If the query asks for a generic list OR implies wanting multiple options (e.g., "show me serums", "any good eye creams?", "what sunscreens do you have?", "recommend some moisturizers"): Set to 10.
   - Rule F (Default for specific product queries): For ALL OTHER specific product queries not covered above (e.g., "vegan lipstick", "cheap sunscreen under $30", "Planet Beauty brand moisturizer", "eye cream for dark circles", "serum for dry skin", "vegan and cruelty-free serum under $100"), even if they include filters like price, vendor, or attributes: Set to 1. The goal is ONE best match.
5. "product_types": Array of normalized product types (e.g., ["lipstick"], ["cleanser", "moisturizer"]). Empty for non-product or fictional queries.
6. "usage_instructions": Practical instructions (e.g., "Apply serum to clean skin, then follow with moisturizer."). Empty ("") for non-product or fictional queries.
7. "price_filter": Object with "max_price" (number in USD) and "currency": "USD" if a price is mentioned (e.g., {"max_price": 30, "currency": "USD"}). Null if unspecified.
8. "sort_by_price": Boolean, true if "cheapest" or "cheap" is mentioned.
9. "vendor": Brand name (e.g., "Planet Beauty") or empty string if none.
10. "attributes": Array of product attributes (e.g., ["vegan", "cruelty-free", "dry skin"]). Empty for non-product or fictional queries.
11. "is_product_query": Boolean. True for explicit product searches (e.g., "find me", "show me") or implied product queries (e.g., "serum for dry skin"). False for greetings, general questions, follow-ups, memory queries, nonsense, or fictional products.

**Key Instructions:**
- **Fictional Products**: Identify fictional/impossible items ONLY by terms like "unobtainium", "unicorn", "dragon", "stardust", "mythril", "elixir", "phoenix". Set "is_product_query" to false, "search_keywords" to [], "product_types" to [], and respond with a witty deflection in "advice".
- **Price Filters**: If a price is mentioned (e.g., "under $30", "around $50", "cheap X"), ALWAYS set "price_filter": {"max_price": X, "currency": "USD"}, ALWAYS include "with price filter" in "ai_understanding", and ALWAYS mention "USD" in "advice" (e.g., "Looking for X under $30 USD!"). Assume USD for all prices.
- **Combos/Sets**: For "X and Y" or "combo of X and Y", set "product_types" to distinct product types (e.g., ["cleanser", "moisturizer"]) and "requested_product_count" strictly to 2 (Rule B). For "skincare set" queries, set "product_types": ["cleanser", "serum", "moisturizer"] and "requested_product_count" strictly to 3 (Rule C).
- **Single-Item Queries (Rule F)**: For queries like "serum for dry skin", "eye cream for dark circles", "vegan and cruelty-free serum under $100", "Planet Beauty brand moisturizer", "cheap sunscreen under $30", ensure "requested_product_count": 1.
- **Vendor Queries**: For queries like "Planet Beauty brand moisturizer", set "vendor": "Planet Beauty" and "requested_product_count": 1.
- **Chat History**: Use history for context in follow-ups and memory queries. If empty, treat as standalone.
- **Skincare Questions**: For "What is skincare?", ensure "advice" mentions cleansing, treating, moisturizing, health, and appearance.
- **Robustness**: Always return a valid JSON object. For unparseable queries, set "ai_understanding" to "nonsense" and provide a helpful deflection.

**Examples**:
- Query: "Hi" → {"ai_understanding": "greeting", "search_keywords": [], "advice": "Hey there! What beauty adventure awaits us today?", "requested_product_count": 0, "product_types": [], "usage_instructions": "", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": [], "is_product_query": false}
- Query: "vegan lipstick" → {"ai_understanding": "product query for vegan lipstick", "search_keywords": ["vegan", "lipstick"], "advice": "Looking for vegan lipsticks! Let’s find you some cruelty-free lip magic!", "requested_product_count": 1, "product_types": ["lipstick"], "usage_instructions": "Swipe on those lips and slay the day!", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": ["vegan"], "is_product_query": true}
- Query: "cheap sunscreen under $30" → {"ai_understanding": "product query for cheap sunscreen with price filter", "search_keywords": ["cheap", "sunscreen"], "advice": "Looking for cheap sunscreens under $30 USD! Let me find a great option for you.", "requested_product_count": 1, "product_types": ["sunscreen"], "usage_instructions": "Apply generously 15 minutes before sun exposure.", "price_filter": {"max_price": 30, "currency": "USD"}, "sort_by_price": true, "vendor": "", "attributes": [], "is_product_query": true}
- Query: "unobtainium cream" → {"ai_understanding": "query for fictional product", "search_keywords": [], "advice": "Unobtainium cream? That’s a fictional material straight out of sci-fi! I can’t find it, but how about a real-world moisturizer with specific benefits like hydration?", "requested_product_count": 0, "product_types": [], "usage_instructions": "", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": [], "is_product_query": false}
- Query: "serum for dry skin" → {"ai_understanding": "product query for serum for dry skin", "search_keywords": ["serum", "dry skin"], "advice": "Looking for a serum for dry skin! Let me find the perfect hydrating option for you.", "requested_product_count": 1, "product_types": ["serum"], "usage_instructions": "Apply to clean skin before moisturizer.", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": ["dry skin"], "is_product_query": true}
- Query: "vegan and cruelty-free serum under $100" → {"ai_understanding": "product query for vegan cruelty-free serum with price filter", "search_keywords": ["vegan", "cruelty-free", "serum"], "advice": "Looking for vegan and cruelty-free serums under $100 USD! Let’s find a great match.", "requested_product_count": 1, "product_types": ["serum"], "usage_instructions": "Apply to clean skin before moisturizer.", "price_filter": {"max_price": 100, "currency": "USD"}, "sort_by_price": false, "vendor": "", "attributes": ["vegan", "cruelty-free"], "is_product_query": true}
- Query: "Planet Beauty brand moisturizer" → {"ai_understanding": "product query for Planet Beauty brand moisturizer", "search_keywords": ["moisturizer", "Planet Beauty"], "advice": "Looking for a Planet Beauty brand moisturizer! Let me find the best option for you.", "requested_product_count": 1, "product_types": ["moisturizer"], "usage_instructions": "Apply to clean skin after cleansing.", "price_filter": null, "sort_by_price": false, "vendor": "Planet Beauty", "attributes": [], "is_product_query": true}
- Query: "skincare set for dry skin" → {"ai_understanding": "product query for skincare set for dry skin", "search_keywords": ["skincare set", "dry skin"], "advice": "Looking for a skincare set for dry skin! Let’s find a perfect trio with cleanser, serum, and moisturizer.", "requested_product_count": 3, "product_types": ["cleanser", "serum", "moisturizer"], "usage_instructions": "Cleanse, apply serum, then moisturize.", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": ["dry skin"], "is_product_query": true}
- Query: "combo with cleanser and toner for oily skin" → {"ai_understanding": "product query for cleanser and toner combo for oily skin", "search_keywords": ["cleanser", "toner", "oily skin"], "advice": "Looking for a cleanser and toner combo for oily skin! Let’s find the perfect duo.", "requested_product_count": 2, "product_types": ["cleanser", "toner"], "usage_instructions": "Cleanse first, then apply toner.", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": ["oily skin"], "is_product_query": true}
- Query: "asdfjkl;" → {"ai_understanding": "Unable to understand the query", "search_keywords": [], "advice": "I'm sorry, I didn't understand your message. Could you please rephrase it or provide more details?", "requested_product_count": 0, "product_types": [], "usage_instructions": "", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": [], "is_product_query": false}

Always format the output as a valid JSON string. Stay sharp, helpful, and a little cheeky—like Grok!`;

export async function getBaseSystemPrompt(): Promise<string | null> {
  try {
    const prompt = await redisClient.get(BASE_SYSTEM_PROMPT_KEY);
    if (prompt) {
      console.log('Base system prompt retrieved from Redis cache.');
      return prompt as string;
    }
    console.log('Base system prompt not found in Redis cache.');
    return null;
  } catch (error) {
    console.error('Error getting base system prompt from Redis:', error);
    return null;
  }
}

export async function setBaseSystemPrompt(prompt: string): Promise<void> {
  try {
    await redisClient.set(BASE_SYSTEM_PROMPT_KEY, prompt);
    console.log('Base system prompt cached in Redis.');
  } catch (error) {
    console.error('Error setting base system prompt in Redis:', error);
  }
}

import { generateLLMResponse } from './llm';

export async function summarizeChatHistory(history: ChatHistory): Promise<string> {
  if (history.length <= 3) {
    return history.map(msg => `${msg.role}: ${msg.text || msg.content}`).join('\n');
  }

  const summarizationSystemPrompt = `Summarize the provided chat history into a concise paragraph, focusing on key intents, topics discussed, and products mentioned. Be brief and capture the essence of the conversation.
Return your response as a JSON object with the following structure:
{
  "ai_understanding": "summary of chat history",
  "search_keywords": [],
  "advice": "YOUR_CONCISE_SUMMARY_HERE",
  "requested_product_count": 0,
  "product_types": [],
  "usage_instructions": "",
  "price_filter": null,
  "sort_by_price": false,
  "vendor": null,
  "attributes": [],
  "is_product_query": false
}
Place the actual summary text in the "advice" field.`;

  const historyForSummarizationQuery = history.map(msg => `${msg.role}: ${msg.text || msg.content}`).join('\n');

  try {
    const summaryObject = await generateLLMResponse(summarizationSystemPrompt, [], `Summarize the following chat log:\n${historyForSummarizationQuery}`);
    if (summaryObject && typeof summaryObject.advice === 'string' && summaryObject.advice.trim() !== '') {
      return summaryObject.advice;
    }
    console.warn('LLM summarization did not return a valid summary in the "advice" field. Falling back.');
    return history.slice(-3).map(msg => `${msg.role}: ${msg.text || msg.content}`).join('\n');
  } catch (error) {
    console.error('Error summarizing history with LLM:', error);
    return history.slice(-3).map(msg => `${msg.role}: ${msg.text || msg.content}`).join('\n');
  }
}

export const KNOWLEDGE_BASE_INDEX_NAME = 'idx:beauty_knowledge';

export async function searchKnowledgeBase(query: string): Promise<unknown[] | null> {
  if (!vectorIndex) {
    console.warn('Vector client not initialized. Cannot search knowledge base.');
    return null;
  }
  try {
    console.warn("Using product vectorIndex for knowledge base query. For production, consider a separate Index instance for 'idx:beauty_knowledge'.");
    const results = await vectorIndex.query({
      data: query,
      topK: 3,
      includeMetadata: true,
    });

    const knowledgeResults = results.filter((r: { metadata?: Record<string, unknown> }) => r.metadata && !(r.metadata as Record<string, unknown>).handle && !(r.metadata as Record<string, unknown>).price);

    if (knowledgeResults && knowledgeResults.length > 0) {
      console.log(`Knowledge base search for "${query}" found ${knowledgeResults.length} results.`);
      return knowledgeResults.map(r => r.metadata);
    } else {
      console.log(`No relevant knowledge base entries found for "${query}".`);
      return null;
    }
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    return null;
  }
}
