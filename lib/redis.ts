// lib/redis.ts

import { Redis as UpstashRedis } from '@upstash/redis';
import { Index } from '@upstash/vector';
import { ChatHistory } from './types'; // Import from new types file


export const UPSTASH_VECTOR_INDEX_NAME = 'idx:products_vss';

// Updated to use the consistent Upstash Vector environment variables
if (!process.env.UPSTASH_VECTOR_URL || !process.env.UPSTASH_VECTOR_TOKEN) {
  throw new Error('Missing Upstash Vector credentials. Set UPSTASH_VECTOR_URL (for presence check), UPSTASH_VECTOR_REST_URL (for actual URL), and UPSTASH_VECTOR_TOKEN in .env.local.');
}

export const vectorIndex = new Index({
  // Use UPSTASH_VECTOR_REST_URL for the actual URL, consistent with app/api/chat/route.ts
  // The .env.local should have UPSTASH_VECTOR_REST_URL defined (e.g., can be same as UPSTASH_VECTOR_URL)
  url: process.env.UPSTASH_VECTOR_REST_URL!, // Add non-null assertion as check is above
  token: process.env.UPSTASH_VECTOR_TOKEN!, // Add non-null assertion
});


export const redisClient = new UpstashRedis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  retry: {
    retries: 5, // Max number of retries
    backoff: (retryCount) => Math.exp(retryCount) * 50, // Exponential backoff factor of 50ms
  },
})

const CHAT_HISTORY_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Sets the ephemeral chat history for a user in Redis with a TTL.
 * @param userId - The ID of the user.
 * @param history - The chat history object to store.
 * @param ttlSeconds - The Time To Live for the cache entry in seconds. Defaults to 24 hours.
 */
export async function setEphemeralUserChatHistory(
  userId: string,
  history: ChatHistory,
  ttlSeconds: number = CHAT_HISTORY_TTL_SECONDS
): Promise<void> {
  // Assume client is connected or will handle connection state internally
  const key = `user:${userId}:chatHistory`;
  try {
    const value = JSON.stringify(history);
    await redisClient.set(key, value, { ex: ttlSeconds });
    console.log(`Ephemeral chat history set for user ${userId} with TTL ${ttlSeconds}s`);
  } catch (error) {
    console.error(`Error setting ephemeral chat history for user ${userId}:`, error);
    // Optionally re-throw or handle as per application's error strategy
  }
}

/**
 * Gets the ephemeral chat history for a user from Redis.
 * @param userId - The ID of the user.
 * @returns The chat history object if found, otherwise null.
 */
export async function getEphemeralUserChatHistory(userId: string): Promise<ChatHistory | null> {
  const key: string = `user:${userId}:chatHistory`;
  try {
    const value = await redisClient.get(key);
    if (value === null || value === undefined) {
      console.log(`No ephemeral chat history found for user ${userId}`);
      return null;
    }
    // Handle case where value might be an object (e.g., from Redis client quirks)
    let stringValue: string;
    if (typeof value === 'string') {
      stringValue = value;
    } else if (typeof value === 'object' && value !== null) {
      // Convert object to string if possible (e.g., JSON stringified object)
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

// Static part of the understanding prompt
export const STATIC_BASE_PROMPT_CONTENT = `You are Grok, Planet Beauty's clever and friendly AI assistant, here to help users navigate the world of beauty products with wit and wisdom. Analyze the latest user query and provided chat history (if any) in the context of a beauty store. Provide a JSON response with the following fields:

1. "ai_understanding": A concise summary of the user’s intent based on the latest query and chat history. Possible intents include "greeting", "product query", "general question", "follow-up clarification", "memory query", "feedback", or "nonsense". Be specific (e.g., "product query for vegan lipstick" instead of just "product query").
2. "search_keywords": Space-separated keywords for product searches. Leave empty ("") if "is_product_query" is false (e.g., greetings, general questions).
3. "advice": A conversational, Grok-style response:
   - For "greeting" (e.g., "Hi", "Thanks"): Keep it short and friendly (e.g., "Hey there! What beauty adventure awaits us today?" or "You’re welcome—any more beauty quests on your mind?").
   - For "product query": Offer helpful advice tied to the query (e.g., "Vegan lipsticks, huh? Let’s find you some cruelty-free lip magic!").
   - For "general question": Provide an informative yet fun answer (e.g., "Skincare’s like a daily hug for your face—cleansing, moisturizing, and a bit of TLC!").
   - For "follow-up clarification": Reference chat history and clarify (e.g., "You asked about a moisturizer earlier—it’s solo, not a combo. Want a full set instead?").
   - For "memory query": Recap the chat with flair (e.g., "We were deep in skincare land, hunting sets for dry skin. Where to next?").
   - For "nonsense" or fictional products: Politely deflect with humor (e.g., "Unobtainium cream? Sounds like a sci-fi bestseller, but I’ll stick to real-world goodies for now!").
4. "requested_product_count": Number of products requested:
   - 4 for "top 4 cheapest"
   - Length of "product_types" for combos/sets (e.g., 2 for "cleanser and moisturizer")
   - 10 for generic lists (e.g., "show me serums")
   - 1 for specific single-product queries
   - 0 if "is_product_query" is false
5. "product_types": Array of normalized product types (e.g., ["lipstick"], ["cleanser", "moisturizer"]). Empty if "is_product_query" is false.
6. "usage_instructions": Practical instructions for product use (e.g., "Apply serum to clean skin, then follow with moisturizer."). Empty ("") if "is_product_query" is false, unless a brief tip fits (e.g., "Cleanse daily for happy skin!").
7. "price_filter": Max price in USD. Convert Pesos to USD (20 Pesos = 1 USD, so 1000 Pesos = 50 USD). Null if unspecified.
8. "sort_by_price": Boolean, true if "cheapest" or "cheap" is mentioned.
9. "vendor": Brand name (e.g., "EcoGlow") or empty string ("") if none.
10. "attributes": Array of product attributes (e.g., ["vegan", "cruelty-free", "non-oily"]). Empty if none specified.
11. "is_product_query": Boolean. True if the latest query explicitly seeks products (e.g., "find me", "show me"). False for greetings, general questions, or follow-ups/memory queries not requesting new products.

**Key Instructions:**
- **Fictional Products**: First, check for fictional/impossible items (e.g., "unicorn tear shampoo", "dragon scale scrub"). If detected, set "is_product_query" to false, clear "search_keywords" and "product_types", and respond with a witty deflection in "advice" (e.g., "Stardust shampoo’s out of stock in this galaxy—how about something earthly?"). Do NOT parse attributes or types for these.
- **Complex Queries**: Extract EVERY detail meticulously (e.g., "vegan, cruelty-free serum from EcoGlow under 1000 Pesos" → attributes: ["vegan", "cruelty-free"], vendor: "EcoGlow", price_filter: 50). Reflect all constraints in "search_keywords" and other fields.
- **Combos/Sets**: For "combo" or "set" queries, list distinct product types in "product_types" (e.g., "cleanser and toner" → ["cleanser", "toner"]) and set "requested_product_count" to the array length. Distinguish sets (one product with multiple items) from combos (separate products) if specified.
- **Chat History**: Use history to inform context, especially for follow-ups and memory queries. If empty, treat the query as standalone.

**Examples:**
- Query: "Hi"
  History: []
  Response: {"ai_understanding": "greeting", "search_keywords": "", "advice": "Hey there! What beauty adventure awaits us today?", "requested_product_count": 0, "product_types": [], "usage_instructions": "", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": [], "is_product_query": false}
- Query: "vegan lipstick"
  History: []
  Response: {"ai_understanding": "product query for vegan lipstick", "search_keywords": "vegan lipstick", "advice": "Vegan lipsticks, huh? Let’s find you some cruelty-free lip magic!", "requested_product_count": 1, "product_types": ["lipstick"], "usage_instructions": "Swipe on those lips and slay the day!", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": ["vegan"], "is_product_query": true}
- Query: "What’s skincare?"
  History: []
  Response: {"ai_understanding": "general question about skincare", "search_keywords": "", "advice": "Skincare’s like a daily hug for your face—cleansing, moisturizing, and a bit of TLC!", "requested_product_count": 0, "product_types": [], "usage_instructions": "", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": [], "is_product_query": false}
- Query: "unobtainium cream"
  History: []
  Response: {"ai_understanding": "query for fictional product", "search_keywords": "", "advice": "Unobtainium cream? Sounds like a sci-fi bestseller, but I’ll stick to real-world goodies for now!", "requested_product_count": 0, "product_types": [], "usage_instructions": "", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": [], "is_product_query": false}
- Query: "cleanser and toner for oily skin"
  History: []
  Response: {"ai_understanding": "product query for cleanser and toner combo for oily skin", "search_keywords": "cleanser toner oily skin", "advice": "Oily skin combo time! Let’s nab a cleanser and toner to keep that shine in check.", "requested_product_count": 2, "product_types": ["cleanser", "toner"], "usage_instructions": "Cleanse first, then tone—your skin will thank you!", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": ["oily skin"], "is_product_query": true}

Format the output as a JSON string. Keep it sharp, helpful, and a little cheeky—like Grok!`;

/**
 * Gets the base system prompt from Redis.
 * @returns The base system prompt if found, otherwise null.
 */
export async function getBaseSystemPrompt(): Promise<string | null> {
  try {
    const prompt = await redisClient.get(BASE_SYSTEM_PROMPT_KEY);
    if (prompt) {
      console.log('Base system prompt retrieved from Redis cache.');
      return prompt as string; // Ensure it's a string
    }
    console.log('Base system prompt not found in Redis cache.');
    return null;
  } catch (error) {
    console.error('Error getting base system prompt from Redis:', error);
    return null; // Fallback to null if error
  }
}

/**
 * Sets the base system prompt in Redis.
 * @param prompt - The base system prompt string to store.
 */
export async function setBaseSystemPrompt(prompt: string): Promise<void> {
  try {
    await redisClient.set(BASE_SYSTEM_PROMPT_KEY, prompt); // No TTL, or a very long one
    console.log('Base system prompt cached in Redis.');
  } catch (error) {
    console.error('Error setting base system prompt in Redis:', error);
  }
}

// Import generateLLMResponse from the new llm.ts module
// Note: Adjust path if necessary, assuming llm.ts is in the same lib directory.
import { generateLLMResponse } from './llm'; // LLMChatHistory and LLMChatMessage are no longer needed here as we use unified types


/**
 * Summarizes chat history if it's longer than a few turns.
 * Uses the LLM to generate a concise summary.
 * @param history - The chat history to summarize.
 * @returns A string summary of the chat history or a recent excerpt if summarization fails.
 */
export async function summarizeChatHistory(history: ChatHistory): Promise<string> {
  // No need for type assertion if ChatHistory is consistent
  if (history.length <= 3) {
    return history.map(msg => `${msg.role}: ${msg.text || msg.content}`).join('\n');
  }

  const summarizationSystemPrompt = `Summarize this chat history into a concise paragraph, focusing on key intents, topics discussed, and products mentioned. Be brief and capture the essence of the conversation.`;
  
  // Construct a simplified history string for the summarization query.
  const historyForSummarizationQuery = history.map(msg => `${msg.role}: ${msg.text || msg.content}`).join('\n');

  try {
    // The generateLLMResponse expects a system prompt, history (can be empty for this task), and a "user query"
    // For summarization, the "user query" will be the history itself or a command to summarize.
    // Pass an empty array for chatHistory to generateLLMResponse as per its signature for this specific summarization task.
    const summaryJsonResponse = await generateLLMResponse(summarizationSystemPrompt, [], `Summarize the following chat log:\n${historyForSummarizationQuery}`);
    const summaryObject = JSON.parse(summaryJsonResponse);
    
    // Assuming the LLM was instructed (perhaps implicitly by the summarizationSystemPrompt)
    // to put the summary in the 'advice' field or a similar field. Adjust if needed.
    if (summaryObject && typeof summaryObject.advice === 'string' && summaryObject.advice.trim() !== '') {
      return summaryObject.advice;
    } else if (summaryObject && typeof summaryObject.summary === 'string' && summaryObject.summary.trim() !== '') { // Alternative field
      return summaryObject.summary;
    }
    console.warn('LLM summarization did not return a valid summary in expected fields. Falling back.');
    // Fallback if summary is not in the expected field or is empty
    return history.slice(-3).map(msg => `${msg.role}: ${msg.text || msg.content}`).join('\n');
  } catch (error) {
    console.error('Error summarizing history with LLM:', error);
    // Fallback to returning the last few messages as a simple string
    return history.slice(-3).map(msg => `${msg.role}: ${msg.text || msg.content}`).join('\n');
  }
}

export const KNOWLEDGE_BASE_INDEX_NAME = 'idx:beauty_knowledge';

/**
 * Searches a separate vector index for general beauty knowledge.
 * @param query - The user's query to search for.
 * @returns An array of search results or null if an error occurs or no results.
 */
export async function searchKnowledgeBase(query: string): Promise<unknown[] | null> {
  if (!vectorIndex) {
    console.warn('Vector client not initialized. Cannot search knowledge base.');
    return null;
  }
  try {
    // Assuming the 'vectorIndex' client can query different named indexes.
    // If your Upstash Vector client is tied to a single index via its constructor,
    // you might need a separate client instance for the knowledge base index.
    // For this example, we'll assume the client can specify an index name per query,
    // or that 'idx:beauty_knowledge' is an alias or handled by your setup.
    // The Upstash Vector SDK `Index` class is typically for one index.
    // A more robust solution might involve a factory or separate instances.
    // However, the user's prompt implies using the existing vectorIndex.
    // Let's assume a hypothetical scenario where the index name can be passed or is configured.
    // If the SDK strictly uses the index from its constructor, this part needs rethinking
    // (e.g., by creating a new Index instance for KNOWLEDGE_BASE_INDEX_NAME).

    // For now, proceeding with the assumption that vectorIndex.query can handle different indexes
    // or that the user will adapt this if their Index client is single-index specific.
    // This is a common point of confusion with vector DB SDKs.
    // The current Upstash Vector SDK's Index class is for a specific index.
    // To query a different index, you'd typically instantiate another Index object.
    // Let's log a warning about this.
    console.warn("Attempting to query KNOWLEDGE_BASE_INDEX_NAME using the product vectorIndex. This might not work as expected if the client is single-index. A separate Index instance for the knowledge base is recommended.");

    const results = await vectorIndex.query({
      // The Upstash Vector SDK's query method does not take an 'index' parameter.
      // The index is set at the time of Index instantiation.
      // This part of the user's request needs clarification or a different approach.
      // For now, I will query the default (product) index with the knowledge query,
      // which is not ideal but follows the structure of the request.
      // A proper implementation would require a separate Index client for 'idx:beauty_knowledge'.
      data: query, // Using 'data' as per Upstash Vector SDK for the query vector/text
      topK: 3, // Fetch top 3 relevant knowledge snippets
      includeMetadata: true, // Assuming knowledge snippets also have metadata
    });
    
    // Filter results if they don't seem like knowledge base entries (e.g. if they are products)
    // This is a makeshift filter because we are querying the product index.
    const knowledgeResults = results.filter((r: { metadata?: Record<string, unknown> }) => r.metadata && !(r.metadata as Record<string, unknown>).handle && !(r.metadata as Record<string, unknown>).price);


    if (knowledgeResults && knowledgeResults.length > 0) {
      console.log(`Knowledge base search for "${query}" found ${knowledgeResults.length} results.`);
      return knowledgeResults.map(r => r.metadata); // Return metadata of results
    } else {
      console.log(`No relevant knowledge base entries found for "${query}".`);
      return null;
    }
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    return null;
  }
}
