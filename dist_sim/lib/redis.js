// lib/redis.ts
import { Redis as UpstashRedis } from '@upstash/redis';
import { Index } from '@upstash/vector';
export const UPSTASH_VECTOR_INDEX_NAME = 'idx:products_vss';
// Updated to use the consistent Upstash Vector environment variables
if (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN) {
    throw new Error('Missing Upstash Vector credentials. Set UPSTASH_VECTOR_REST_URL (for presence check), UPSTASH_VECTOR_REST_URL (for actual URL), and UPSTASH_VECTOR_REST_TOKEN in .env.local.');
}
export const vectorIndex = new Index({
    // Use UPSTASH_VECTOR_REST_URL for the actual URL, consistent with app/api/chat/route.ts
    // The .env.local should have UPSTASH_VECTOR_REST_URL defined (e.g., can be same as UPSTASH_VECTOR_REST_URL)
    url: process.env.UPSTASH_VECTOR_REST_URL, // Add non-null assertion as check is above
    token: process.env.UPSTASH_VECTOR_REST_TOKEN, // Add non-null assertion
});
export const redisClient = new UpstashRedis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    retry: {
        retries: 5, // Max number of retries
        backoff: (retryCount) => Math.exp(retryCount) * 50, // Exponential backoff factor of 50ms
    },
});
const CHAT_HISTORY_TTL_SECONDS = 24 * 60 * 60; // 24 hours
/**
 * Sets the ephemeral chat history for a user in Redis with a TTL.
 * @param userId - The ID of the user.
 * @param history - The chat history object to store.
 * @param ttlSeconds - The Time To Live for the cache entry in seconds. Defaults to 24 hours.
 */
export async function setEphemeralUserChatHistory(userId, history, ttlSeconds = CHAT_HISTORY_TTL_SECONDS) {
    // Assume client is connected or will handle connection state internally
    const key = `user:${userId}:chatHistory`;
    try {
        const value = JSON.stringify(history);
        await redisClient.set(key, value, { ex: ttlSeconds });
        console.log(`Ephemeral chat history set for user ${userId} with TTL ${ttlSeconds}s`);
    }
    catch (error) {
        console.error(`Error setting ephemeral chat history for user ${userId}:`, error);
        // Optionally re-throw or handle as per application's error strategy
    }
}
/**
 * Gets the ephemeral chat history for a user from Redis.
 * @param userId - The ID of the user.
 * @returns The chat history object if found, otherwise null.
 */
export async function getEphemeralUserChatHistory(userId) {
    const key = `user:${userId}:chatHistory`;
    try {
        const value = await redisClient.get(key);
        if (value === null || value === undefined) {
            console.log(`No ephemeral chat history found for user ${userId}`);
            return null;
        }
        // Handle case where value might be an object (e.g., from Redis client quirks)
        let stringValue;
        if (typeof value === 'string') {
            stringValue = value;
        }
        else if (typeof value === 'object' && value !== null) {
            // Convert object to string if possible (e.g., JSON stringified object)
            try {
                stringValue = JSON.stringify(value);
            }
            catch (error) {
                console.error(`Invalid chat history format for user ${userId}: Cannot convert object to string`, error);
                return null;
            }
        }
        else {
            console.error(`Invalid chat history format for user ${userId}: Expected string, got ${typeof value}`);
            return null;
        }
        console.log(`Ephemeral chat history found for user ${userId}`);
        try {
            return JSON.parse(stringValue);
        }
        catch (error) {
            console.error(`Error parsing chat history for user ${userId}:`, error, `\nRaw value: ${stringValue}`);
            return null;
        }
    }
    catch (error) {
        console.error(`Error getting ephemeral chat history for user ${userId}:`, error);
        return null;
    }
}
export const BASE_SYSTEM_PROMPT_KEY = 'system:baseUnderstandingPrompt_v1';
// Static part of the understanding prompt
export const STATIC_BASE_PROMPT_CONTENT = `Analyze the user query and provided chat history for a beauty store. Provide a JSON response with the following fields:
            1. "ai_understanding": A brief summary of the user's intent. Consider the LATEST user query in context of the CHAT HISTORY. Intents can be "greeting", "product query", "general question", "follow-up clarification", "memory query" (e.g., asking about past conversation), "feedback", etc.
            2. "search_keywords": Space-separated keywords for product search. If "is_product_query" is false (e.g., for greetings, general questions, most follow-ups not asking for new products), return an empty string.
            3. "advice": A conversational response.
               - If "is_product_query" is true, provide advice related to the products or query (e.g., "Looking for vegan lipsticks! Here are some great options.").
               - If intent is "greeting" (e.g., "Hello", "Hi", "Thanks"), respond with a friendly, concise greeting (e.g., "Hi! How can I assist you today?", "You're welcome! How else can I help?").
               - If intent is "follow-up clarification" (e.g., "is that a combo?", "why did you suggest that?"), acknowledge the previous turn from CHAT HISTORY and clarify. Example: "You asked about the moisturizer. It's a single product, but great for dry skin. Were you looking for a set with multiple items like a cleanser and serum too?"
               - If intent is "memory query" (e.g., "what did we talk about?"), summarize relevant points from CHAT HISTORY. Example: "We were just discussing skincare sets for dry skin, and I showed you a moisturizer. Would you like to continue with that or explore other options?"
               - For other "general question" intents, provide general conversational advice or answer the question (e.g., "Skincare involves routines and products to maintain healthy skin...").
            4. "requested_product_count": Number of products requested. Set to 4 for "top 4 cheapest", length of product_types for combos/sets, 10 for generic lists, or 1 otherwise. If "is_product_query" is false, set to 0.
            5. "product_types": Array of product types (e.g., ["lipstick"], ["cleanser", "moisturizer"]). Use normalized types. If "is_product_query" is false, return an empty array.
            6. "usage_instructions": Detailed instructions for using products. If "is_product_query" is false, return an empty string or a very brief, relevant non-product tip if appropriate.
            7. "price_filter": Maximum price in USD (e.g., 20 for "under $20") or null if unspecified. If the user query mentions a price in Pesos (e.g., "under 500 Pesos"), convert this to USD using an approximate rate of 20 Pesos = 1 USD (e.g., 500 Pesos -> 25 USD).
            8. "sort_by_price": Boolean, true if query includes "cheapest".
            9. "vendor": Brand name if specified, or empty string if none.
            10. "attributes": An array of product attributes (e.g., ["vegan", "cruelty-free"]).
            11. "is_product_query": Boolean. True if the LATEST user query explicitly asks for product suggestions, recommendations, or to find/show products. False for general questions, advice not directly tied to finding a specific product, or conversational follow-ups/greetings that don't ask for more products. Also false for "follow-up clarification" or "memory query" unless they explicitly ask for NEW products.

            Examples:
            - User Query: "hello"
              Chat History: []
              Expected JSON: { "is_product_query": false, "search_keywords": "", "product_types": [], "advice": "Hi! How can I assist you today?", "requested_product_count": 0, "ai_understanding": "greeting", "usage_instructions": "", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": [] }
            - User Query: "find me a vegan lipstick"
              Chat History: []
              Expected JSON: { "is_product_query": true, "search_keywords": "vegan lipstick", "product_types": ["lipstick"], "advice": "Looking for vegan lipsticks! Here are some great options.", "requested_product_count": 1, "ai_understanding": "product query for vegan lipstick", "usage_instructions": "Apply to lips as desired.", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": ["vegan"] }
            - User Query: "what is skincare?"
              Chat History: []
              Expected JSON: { "is_product_query": false, "search_keywords": "", "product_types": [], "advice": "Skincare involves routines and products to maintain healthy skin...", "requested_product_count": 0, "ai_understanding": "general question about skincare", "usage_instructions": "", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": [] }
            - User Query: "Oh its one product is a combo?"
              Chat History: [{"role":"user","text":"I have dry skin I need a combo or set can you help me?"},{"role":"bot","text":"Looking for a skincare combo or set for dry skin! Here are some great options. [Shows Guinot Nutrizone moisturizer]"}]
              Expected JSON: { "is_product_query": false, "search_keywords": "", "product_types": [], "advice": "My apologies! The Guinot Nutrizone is an intensive moisturizer. If you're looking for a set with multiple items for dry skin, I can help find a cleanser, serum, and moisturizer. Would you like that?", "requested_product_count": 0, "ai_understanding": "follow-up clarification", "usage_instructions": "", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": [] }
            - User Query: "Can you remember our last conversation?"
              Chat History: [{"role":"user","text":"Hello"},{"role":"bot","text":"Hi! How can I assist you today?"},{"role":"user","text":"I need a shampoo for oily hair."},{"role":"bot","text":"Okay, looking for shampoos for oily hair..."}]
              Expected JSON: { "is_product_query": false, "search_keywords": "", "product_types": [], "advice": "Yes, we were just discussing shampoos for oily hair. Would you like me to continue with that search or help with something else?", "requested_product_count": 0, "ai_understanding": "memory query", "usage_instructions": "", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": [] }
            - User Query: "What's your name?"
              Chat History: []
              Expected JSON: { "is_product_query": false, "search_keywords": "", "product_types": [], "advice": "I'm Planet Beauty's AI shopping assistant, here to help you find the perfect products!", "requested_product_count": 0, "ai_understanding": "general question (about chatbot)", "usage_instructions": "", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": [] }
            - User Query: "vegan and cruelty-free serum under 1000 Pesos"
              Chat History: []
              Expected JSON: { "is_product_query": true, "search_keywords": "vegan cruelty-free serum", "product_types": ["serum"], "advice": "Searching for a vegan and cruelty-free serum under 1000 Pesos (approx 50 USD).", "requested_product_count": 1, "ai_understanding": "product query for vegan cruelty-free serum with price filter", "usage_instructions": "Apply serum to clean skin before moisturizer.", "price_filter": 50, "sort_by_price": false, "vendor": "", "attributes": ["vegan", "cruelty-free"] }
            - User Query: "Show me a hydrating toner from 'AquaPure' that's alcohol-free and costs less than $25."
              Chat History: []
              Expected JSON: { "is_product_query": true, "search_keywords": "AquaPure hydrating toner alcohol-free", "product_types": ["toner"], "advice": "Searching for an alcohol-free hydrating toner from AquaPure under $25.", "requested_product_count": 1, "ai_understanding": "product query for hydrating toner from AquaPure, alcohol-free, under $25", "usage_instructions": "Apply toner after cleansing and before serum/moisturizer.", "price_filter": 25, "sort_by_price": false, "vendor": "AquaPure", "attributes": ["hydrating", "alcohol-free"] }
            - User Query: "I'm looking for a vegan and cruelty-free serum from 'EcoGlow', preferably under 1000 Pesos, but not oily."
              Chat History: []
              Expected JSON: { "is_product_query": true, "search_keywords": "EcoGlow vegan cruelty-free serum non-oily", "product_types": ["serum"], "advice": "Searching for a vegan, cruelty-free, and non-oily serum from EcoGlow, under 1000 Pesos (approx 50 USD).", "requested_product_count": 1, "ai_understanding": "product query for vegan, cruelty-free, non-oily serum from EcoGlow with price filter", "usage_instructions": "Apply serum to clean skin before moisturizer. Look for 'non-comedogenic' or 'oil-free' formulations.", "price_filter": 50, "sort_by_price": false, "vendor": "EcoGlow", "attributes": ["vegan", "cruelty-free", "non-oily"] }
            - User Query: "Find unobtainium face cream"
              Chat History: []
              Expected JSON: { "is_product_query": false, "search_keywords": "", "product_types": [], "advice": "Unfortunately, 'unobtainium' seems to be a fictional material, so I can't find a face cream made from it. If you're looking for a face cream with specific benefits, like hydration or anti-aging, I can help with that!", "requested_product_count": 0, "ai_understanding": "query for fictional product", "usage_instructions": "", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": [] }
            - User Query: "I need a shampoo made of stardust and unicorn tears."
              Chat History: []
              Expected JSON: { "is_product_query": false, "search_keywords": "", "product_types": [], "advice": "While a shampoo made of stardust and unicorn tears sounds magical, those ingredients aren't typically found in real-world products! If you're looking for a shampoo with specific benefits like 'volumizing' or 'for colored hair', I can certainly help find something more conventional.", "requested_product_count": 0, "ai_understanding": "query for fictional product with fantastical ingredients", "usage_instructions": "", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": [] }
            - User Query: "I need a cleanser and moisturizer for sensitive skin"
              Chat History: []
              Expected JSON: { "is_product_query": true, "search_keywords": "cleanser moisturizer sensitive skin", "product_types": ["cleanser", "moisturizer"], "advice": "Looking for a cleanser and moisturizer for sensitive skin! I'll find some gentle options.", "requested_product_count": 2, "ai_understanding": "product query for cleanser and moisturizer for sensitive skin", "usage_instructions": "Use cleanser then moisturizer. Always patch test new products.", "price_filter": null, "sort_by_price": false, "vendor": "", "attributes": ["sensitive skin"] }

            IMPORTANT INSTRUCTIONS:
            - **Identify Fictional Products First (CRITICAL):** Before attempting to extract product details, first determine if the query is for a clearly fictional, nonsensical, or impossible product (e.g., "dragon scale exfoliator", "moon dust shampoo", "elixir of eternal youth", "unobtainium cream"). If so, YOU MUST set "is_product_query" to false. "search_keywords" and "product_types" MUST be empty arrays/strings. Provide a polite explanation in "advice" that the product is not real or cannot be found due to its nature. Do not attempt to parse attributes or types for such queries.
            - **Complex Queries - Full and Meticulous Extraction (CRITICAL):** For product queries with multiple attributes (e.g., "vegan", "cruelty-free", "non-oily"), specific vendors (e.g., "from BrandX"), and/or price filters (e.g., "under $50", "less than 1000 Pesos"), it is ABSOLUTELY CRITICAL to extract ALL specified criteria. Populate the "attributes" array with every attribute, set the "vendor" field if a brand is named, and calculate the "price_filter" in USD if a price is mentioned. Ensure "search_keywords" also comprehensively reflects all these details. DO NOT MISS ANY CONSTRAINTS. If a query has many constraints, list them all.
            - **Combo/Set Queries:** For "combo" or "set" queries (e.g., "dry skin set"), if you identify multiple distinct product types that form the set (e.g., cleanser, serum, moisturizer), list all these types in the "product_types" array. The "requested_product_count" should then be the number of these distinct product types.

            Format the output as a JSON string.`;
/**
 * Gets the base system prompt from Redis.
 * @returns The base system prompt if found, otherwise null.
 */
export async function getBaseSystemPrompt() {
    try {
        const prompt = await redisClient.get(BASE_SYSTEM_PROMPT_KEY);
        if (prompt) {
            console.log('Base system prompt retrieved from Redis cache.');
            return prompt; // Ensure it's a string
        }
        console.log('Base system prompt not found in Redis cache.');
        return null;
    }
    catch (error) {
        console.error('Error getting base system prompt from Redis:', error);
        return null; // Fallback to null if error
    }
}
/**
 * Sets the base system prompt in Redis.
 * @param prompt - The base system prompt string to store.
 */
export async function setBaseSystemPrompt(prompt) {
    try {
        await redisClient.set(BASE_SYSTEM_PROMPT_KEY, prompt); // No TTL, or a very long one
        console.log('Base system prompt cached in Redis.');
    }
    catch (error) {
        console.error('Error setting base system prompt in Redis:', error);
    }
}
