import { GoogleGenerativeAI } from '@google/generative-ai';
import { Ratelimit } from "@upstash/ratelimit";
// generateEmbeddings is no longer needed for sparse-only query
// import { generateEmbeddings } from '../../../lib/gemini';
import { Redis } from "@upstash/redis";
import { Index } from '@upstash/vector';
import { LRUCache } from 'lru-cache'; // Try named import
import { NextResponse } from 'next/server';
import pino from 'pino'; // Import pino for structured logging
import { setTimeout } from 'timers/promises'; // Import for async timeout
import { getBaseSystemPrompt, getEphemeralUserChatHistory, setBaseSystemPrompt, setEphemeralUserChatHistory, STATIC_BASE_PROMPT_CONTENT } from '../../../lib/redis'; // Chat history functions using node-redis client
import { fetchAdminShopifyProducts } from '../../../lib/shopify-admin'; // For Shopify GraphQL fallback
const logger = pino(); // Create a pino logger instance
/**
 * @fileoverview API route handler for the chat endpoint (/api/chat).
 * Handles user chat queries, interacts with AI (Gemini), performs vector search
 * for products, manages chat history, and implements rate limiting.
 */
// --- Rate Limiter Initialization ---
/**
 * Rate limiter instance using Upstash Ratelimit.
 * Limits requests based on IP address or user ID using a sliding window algorithm.
 * Configured via environment variables UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 */
const ratelimit = new Ratelimit({
    redis: new Redis({
        url: (process.env.UPSTASH_REDIS_REST_URL || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
        token: (process.env.UPSTASH_REDIS_REST_TOKEN || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
    }),
    limiter: Ratelimit.slidingWindow(10, "10 s"),
    prefix: "@upstash/ratelimit",
});
// --- Initialize External Clients & Caches ---
/** Name of the Upstash Vector index used for product search. */
const UPSTASH_VECTOR_INDEX_NAME = 'idx:products_vss';
/** In-memory cache for recent chat histories to reduce Redis lookups. */
const chatHistoryCache = new LRUCache({
    max: 1000, // Maximum number of items in cache
    ttl: 5 * 60 * 1000, // Cache items for 5 minutes
});
/** Upstash Vector client instance. Initialized using environment variables. */
let vectorIndex = null; // Explicitly type with ProductVectorMetadata
// const VECTOR_TIMEOUT_MS = 15000; // Timeout configuration removed as it's not directly supported here
// Attempt to initialize Vector client using UPSTASH_VECTOR_URL and UPSTASH_VECTOR_TOKEN
if (process.env.UPSTASH_VECTOR_URL && process.env.UPSTASH_VECTOR_TOKEN) {
    try {
        vectorIndex = new Index({
            url: (process.env.UPSTASH_VECTOR_REST_URL || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
            token: (process.env.UPSTASH_VECTOR_TOKEN || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
            // requestTimeout: VECTOR_TIMEOUT_MS, // Removed: Not a valid property in IndexConfig
        });
        logger.info('Upstash Vector client initialized with UPSTASH_VECTOR_URL.');
    }
    catch (error) {
        logger.error({ err: error }, 'Failed to initialize Vector with UPSTASH_VECTOR_URL.');
    }
}
else {
    logger.error('Missing Upstash Vector credentials (UPSTASH_VECTOR_URL or UPSTASH_VECTOR_TOKEN).');
}
/** Google Generative AI client instance. */
let genAI = null;
/** Specific Gemini model instance (e.g., 'gemini-1.5-flash-latest'). */
let geminiModel = null;
// Initialize Gemini client if API key is provided
if (!process.env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not found in .env.local. Skipping Gemini initialization.');
}
else {
    try {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
        logger.info('Google Gemini client initialized.');
    }
    catch (error) {
        logger.error({ err: error }, 'Failed to initialize Google Gemini client.');
    }
}
let keywordMappings = {
    typeToKeywords: {},
    synonyms: {},
    defaultComboTypes: [],
};
function isProductVectorMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
        return false;
    }
    const m = metadata; // Use Partial for flexibility
    return (
    // typeof m.id === 'string' && // ID is now optional in metadata, will use QueryResult.id
    typeof m.handle === 'string' &&
        typeof m.title === 'string' &&
        typeof m.price === 'string' &&
        (m.imageUrl === null || typeof m.imageUrl === 'string') &&
        typeof m.productUrl === 'string');
}
async function buildDynamicMappings() {
    if (!vectorIndex) {
        logger.warn('Cannot build dynamic mappings: Vector client not initialized.');
        return;
    }
    try {
        const results = await vectorIndex.query({
            data: 'all products',
            topK: 1000,
            includeMetadata: true,
        });
        if (!results || results.length === 0) {
            logger.warn('No products found for dynamic mappings.');
            return;
        }
        const typeToKeywords = {};
        const synonyms = {};
        const productTypes = new Set();
        const allTags = new Set();
        for (const result of results) {
            if (!result.metadata || !isProductVectorMetadata(result.metadata)) {
                continue;
            }
            const { productType, tags, title } = result.metadata; // tags is now string[] | undefined
            // Normalize productType
            const normalizedType = productType
                ? productType.split('>').pop()?.trim().toLowerCase() || ''
                : '';
            if (normalizedType) {
                productTypes.add(normalizedType);
                // Map type to keywords (use title or tags for context)
                const currentTags = Array.isArray(tags) ? tags.map(t => t.toLowerCase()) : [];
                const keywords = [
                    normalizedType,
                    ...currentTags,
                    ...(title ? title.toLowerCase().split(' ').slice(0, 3) : []),
                ].join(' ');
                typeToKeywords[normalizedType] = keywords;
                // Build synonyms from tags and title
                synonyms[normalizedType] = [...new Set([
                        ...(synonyms[normalizedType] || []),
                        ...currentTags,
                        ...(title ? title.toLowerCase().split(' ').filter(word => word.length > 3) : []),
                    ])];
            }
            // Collect tags
            if (Array.isArray(tags)) {
                tags.map(t => t.trim().toLowerCase()).forEach(t => allTags.add(t));
            }
        }
        // Default combo types (most common product types)
        const defaultComboTypes = Array.from(productTypes).slice(0, 3);
        keywordMappings = {
            typeToKeywords,
            synonyms,
            defaultComboTypes,
        };
        logger.info('Dynamic mappings built:', {
            typeCount: Object.keys(typeToKeywords).length,
            synonymCount: Object.keys(synonyms).length,
            defaultComboTypes,
        });
    }
    catch (error) {
        logger.error({ err: error }, 'Failed to build dynamic mappings.');
    }
}
// Initialize mappings at startup
buildDynamicMappings().catch(err => logger.error({ err }, 'Dynamic mappings initialization failed.'));
function parsePrice(priceStr) {
    const cleaned = priceStr.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
}
function filterNegativePhrasing(advice) {
    let positiveAdvice = advice;
    // General "don't have" or "couldn't find"
    positiveAdvice = positiveAdvice.replace(/\bI don['’]t have\b.*?\./gi, 'Here are some great alternatives!');
    positiveAdvice = positiveAdvice.replace(/\bI couldn['’]t find specific products matching your request\b[\.,]?/gi, 'While I couldn\'t find that exact item, perhaps these related products might interest you:');
    positiveAdvice = positiveAdvice.replace(/\bI couldn['’]t find a specific\b.*?\./gi, 'While I couldn\'t find that specific item, here are some other options you might like:');
    positiveAdvice = positiveAdvice.replace(/\bI couldn['’]t find an exact match\b[\.,]?/gi, 'While I couldn\'t find an exact match, here are some related suggestions:');
    positiveAdvice = positiveAdvice.replace(/\bI couldn['’]t find\b.*?\./gi, 'While I couldn\'t find that, here are some other options:');
    // Apologies or admissions of unhelpfulness
    positiveAdvice = positiveAdvice.replace(/\bI apologize, but\b/gi, 'Certainly, let\'s try this:'); // More direct and helpful
    positiveAdvice = positiveAdvice.replace(/\bI apologize that my previous responses? haven['’]t been helpful\b[\.,]?/gi, 'Let\'s find exactly what you need. To clarify,');
    positiveAdvice = positiveAdvice.replace(/\bMy apologies for any confusion\b[\.,]?/gi, 'Let me clarify that for you.');
    // Specific phrases from simulation
    positiveAdvice = positiveAdvice.replace(/\bI apologize that the previous suggestion wasn['’]t suitable\b[\.,]?/gi, 'Okay, let\'s find a better match. To clarify,');
    // Remove redundant "Here are some great alternatives!" if it's already positive or a clarification
    if (!positiveAdvice.toLowerCase().includes("couldn't find") && !positiveAdvice.toLowerCase().includes("don't have")) {
        if (positiveAdvice.startsWith('Here are some great alternatives! ')) {
            // Check if the rest of the sentence is a question or a statement that doesn't need this prefix
            const restOfAdvice = positiveAdvice.substring('Here are some great alternatives! '.length);
            if (restOfAdvice.toLowerCase().startsWith('my responses are based on') || restOfAdvice.toLowerCase().startsWith('let me clarify')) {
                positiveAdvice = restOfAdvice; // Remove the prefix
            }
        }
    }
    return positiveAdvice;
}
function extractNumericIdFromGid(gid) {
    if (typeof gid === 'number') {
        return String(gid); // Convert number to string
    }
    if (typeof gid !== 'string') {
        return ''; // Return empty if not string or number (e.g., undefined)
    }
    const parts = gid.split('/');
    return parts.pop() || gid;
}
// Type guard function
function isBoolean(value) {
    return typeof value === 'boolean';
}
export async function POST(req) {
    logger.info('Chat API: /api/chat endpoint hit.');
    let searchNote = '';
    try {
        const identifier = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? "anonymous";
        const { success, limit, remaining } = await ratelimit.limit(identifier);
        logger.info(`Rate limit check: success=${success}, limit=${limit}, remaining=${remaining}`);
        if (!success) {
            return new NextResponse("Too Many Requests", {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': String(limit),
                    'X-RateLimit-Remaining': String(remaining),
                }
            });
        }
        let body;
        try {
            body = await req.json();
        }
        catch (error) {
            logger.error({ err: error }, 'Failed to parse request body.');
            return NextResponse.json({ error: 'Failed to parse request body' }, { status: 400 });
        }
        const { query, history: clientHistory = [] } = body;
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            logger.error('Invalid query provided.');
            return NextResponse.json({ error: 'Invalid query provided' }, { status: 400 });
        }
        const trimmedQuery = query.trim();
        logger.info({ query: trimmedQuery }, 'Processing query.');
        // --- Early Gibberish Check ---
        const isPotentiallyGibberish = (q) => {
            const qLower = q.toLowerCase();
            if (qLower.length === 0)
                return true; // Empty query
            // Rule 1: Short query with no vowels (a,e,i,o,u) and not a common short word
            if (qLower.length <= 4) {
                const commonShortWords = ['hi', 'hey', 'ok', 'yes', 'no', 'bye', 'faq', 'gel', 'oil', 'kit', 'men', 'man'];
                if (!commonShortWords.includes(qLower) && !/[aeiou]/i.test(qLower)) {
                    logger.info({ query: q, rule: 1 }, "Gibberish detected: short, no vowels, not common.");
                    return true;
                }
            }
            // Rule 2: Query of 4 to 8 chars with no vowels (a,e,i,o,u,y) and not purely numeric or common acronym-like
            // Extended length to 8 to catch cases like "asdfjkl;"
            if (qLower.length >= 4 && qLower.length <= 8) {
                // Test on a version of the query with common trailing punctuation removed for this rule
                const coreQuery = qLower.replace(/[;,.!?]$/, '');
                const noVowels = !/[aeiouy]/i.test(coreQuery);
                const notNumeric = !/^\d+$/.test(coreQuery);
                const notAcronymLike = !/^[A-Z0-9]+$/.test(q); // q still used for acronym check (original case)
                logger.info({
                    query: q,
                    qLower,
                    coreQuery,
                    rule: 2,
                    length: qLower.length,
                    noVowels,
                    notNumeric,
                    notAcronymLike,
                    conditionsMet: noVowels && notNumeric && notAcronymLike
                }, "Gibberish Rule 2 evaluation details");
                if (noVowels && notNumeric && notAcronymLike) {
                    logger.info({ query: q, coreQuery, rule: 2 }, "Gibberish detected by Rule 2: 4-8 chars, no vowels (incl y), not numeric/acronym.");
                    return true;
                }
            }
            // Rule 3: High ratio of non-alphanumeric characters
            if (qLower.length > 0) { // Apply to any length
                const alphaNumericChars = (qLower.match(/[a-z0-9]/gi) || []).length;
                const totalChars = qLower.length;
                if (totalChars > 0 && alphaNumericChars / totalChars < 0.3 && totalChars > 3) { // Less than 30% alphanumeric for strings > 3 chars
                    logger.info({ query: q, rule: 3.1, ratio: (alphaNumericChars / totalChars).toFixed(2) }, "Gibberish detected: low alphanumeric ratio.");
                    return true;
                }
            }
            // Rule 4: Repetitive characters (3 or more identical consecutive characters, or short sequences repeated)
            if (/(.)\1{2,}/.test(qLower)) { // e.g., "aaa", "bbbb" (3+ identical consecutive)
                logger.info({ query: q, rule: '4.1_consecutive_identical' }, "Gibberish detected: 3+ consecutive identical characters.");
                return true;
            }
            if (qLower.length > 5 && qLower.length < 15) { // Check for patterns like "asdasdasd", "asdfasdf"
                // Rule 4.2: Check for 3-char sequence repeated 3+ times (e.g., "asdasdasd")
                const firstThree = qLower.substring(0, 3);
                if (qLower.substring(3).startsWith(firstThree) && qLower.substring(3 + firstThree.length).startsWith(firstThree)) {
                    logger.info({ query: q, rule: '4.2_3char_triple_repetition', pattern: firstThree }, "Gibberish detected: 3-char pattern repeated at least 3 times.");
                    return true;
                }
                // Rule 4.3: Check for 2-char sequence repeated 4+ times (e.g., "abababab")
                const firstTwo = qLower.substring(0, 2);
                if (qLower.substring(2).startsWith(firstTwo) && qLower.substring(4).startsWith(firstTwo) && qLower.substring(6).startsWith(firstTwo)) {
                    logger.info({ query: q, rule: '4.3_2char_quad_repetition', pattern: firstTwo }, "Gibberish detected: 2-char pattern repeated at least 4 times.");
                    return true;
                }
                // Rule 4.4: Check for "patternpattern" where pattern is 3 chars long and has no vowels (e.g., "rfrfrf")
                if (qLower.length === 6) {
                    const pattern = qLower.substring(0, 3);
                    if (qLower.substring(3) === pattern) {
                        const vowelsInPattern = (pattern.match(/[aeiouy]/gi) || []).length;
                        if (vowelsInPattern === 0) {
                            logger.info({ query: q, rule: '4.4_3char_pattern_pair_no_vowels', pattern }, "Gibberish detected: 3-char no-vowel pattern repeated twice.");
                            return true;
                        }
                    }
                }
                // Rule 4.5: Check for "patternpattern" where pattern is 4 chars long and has 0 or 1 vowel (e.g., "zxcvzxcv", "asdfasdf")
                if (qLower.length === 8) {
                    const pattern = qLower.substring(0, 4);
                    if (qLower.substring(4) === pattern) {
                        const vowelsInPattern = (pattern.match(/[aeiouy]/gi) || []).length;
                        if (vowelsInPattern <= 1) { // 0 or 1 vowel
                            logger.info({ query: q, rule: '4.5_4char_pattern_pair_low_vowels', pattern, vowelsInPattern }, "Gibberish detected: 4-char low-vowel pattern repeated twice.");
                            return true;
                        }
                    }
                }
            }
            // Rule 5: Mostly symbols and very few letters/numbers
            if (qLower.length > 2 && (qLower.match(/[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\';\/~`]/g) || []).length / qLower.length > 0.6 && (qLower.match(/[a-z]/gi) || []).length < 3) {
                logger.info({ query: q, rule: 5 }, "Gibberish detected: mostly symbols, very few letters.");
                return true;
            }
            return false;
        };
        if (isPotentiallyGibberish(trimmedQuery)) {
            logger.info({ query: trimmedQuery }, 'Query flagged as potential gibberish. Bypassing Gemini.');
            const gibberishResponse = {
                ai_understanding: "Unable to understand the query.",
                advice: "I'm sorry, I didn't understand your message. Could you please rephrase it or provide more details?",
                history: clientHistory, // Start with client history
            };
            // Update history before sending
            gibberishResponse.history.push({ role: 'user', text: trimmedQuery });
            gibberishResponse.history.push({ role: 'bot', text: gibberishResponse.advice });
            const maxHistory = parseInt(process.env.MAX_CHAT_HISTORY || '10', 10);
            if (gibberishResponse.history.length > maxHistory) {
                gibberishResponse.history = gibberishResponse.history.slice(-maxHistory);
            }
            const currentUserId = req.headers.get('x-user-id') || "anonymous";
            await setEphemeralUserChatHistory(currentUserId, gibberishResponse.history);
            chatHistoryCache.set(currentUserId, gibberishResponse.history);
            return NextResponse.json(gibberishResponse);
        }
        const userId = req.headers.get('x-user-id') || "anonymous";
        let history;
        const memoryCachedHistory = chatHistoryCache.get(userId);
        if (memoryCachedHistory) {
            history = memoryCachedHistory;
            logger.info({ userId, cacheSource: 'lru' }, 'Chat history retrieved from in-memory LRU cache.');
        }
        else {
            logger.info({ userId, cacheSource: 'lru' }, 'Chat history NOT found in LRU cache, attempting Redis.');
            const redisHistory = await getEphemeralUserChatHistory(userId);
            if (redisHistory && Array.isArray(redisHistory)) {
                history = redisHistory;
                logger.info({ userId, cacheSource: 'redis' }, 'Chat history retrieved from Redis via getEphemeralUserChatHistory.');
                if (history.length > 0)
                    chatHistoryCache.set(userId, history);
            }
            else {
                history = clientHistory;
                if (redisHistory) {
                    logger.warn({ userId, cacheSource: 'redis' }, 'Invalid history format from getEphemeralUserChatHistory; using client/request history.');
                }
                else {
                    logger.info({ userId }, 'No chat history in Redis via getEphemeralUserChatHistory; using client/request history.');
                }
            }
        }
        if (!Array.isArray(history)) {
            history = [];
        }
        const geminiHistory = history
            .filter(msg => msg.text && msg.text.trim().length > 0)
            .map(msg => ({
            role: (msg.role === 'bot' || msg.role === 'model' ? 'assistant' : 'user'),
            content: msg.text,
        }));
        let geminiResult = {
            ai_understanding: 'Unable to interpret query intent.',
            search_keywords: '',
            advice: 'Sorry, I had trouble understanding your request.',
            requested_product_count: 1,
            product_types: [],
            usage_instructions: "",
            price_filter: null,
            sort_by_price: false,
            vendor: "",
            attributes: [],
            product_tags: "",
            is_product_query: false, // Default to boolean
        };
        const GEMINI_TIMEOUT_MS = 10000;
        const timeoutSignal = Symbol('timeout');
        async function withTimeout(promise, ms) {
            const timeoutPromise = setTimeout(ms, timeoutSignal).then(() => {
                throw new Error(`Operation timed out after ${ms}ms`);
            });
            return Promise.race([promise, timeoutPromise]);
        }
        if (geminiModel) {
            logger.info('Preparing to call Gemini for understanding...');
            let basePromptForGemini = null;
            let promptSource = 'static';
            try {
                basePromptForGemini = await getBaseSystemPrompt();
                if (basePromptForGemini) {
                    promptSource = 'redis';
                }
                else {
                    logger.info('Base system prompt not found in Redis cache, using static content and caching it.');
                    basePromptForGemini = STATIC_BASE_PROMPT_CONTENT;
                    // Intentionally not awaiting setBaseSystemPrompt to avoid blocking the current request
                    setBaseSystemPrompt(STATIC_BASE_PROMPT_CONTENT).catch(err => {
                        logger.error({ err }, "Error caching base system prompt in background.");
                    });
                }
            }
            catch (e) {
                logger.error({ err: e }, "Failed to get/set base system prompt from/to Redis. Using static content.");
                basePromptForGemini = STATIC_BASE_PROMPT_CONTENT; // Fallback
            }
            logger.info({ promptSource }, 'Base system prompt obtained.');
            const finalUnderstandingPrompt = `${basePromptForGemini}\n\nUser Query: "${trimmedQuery}"\nChat History: ${JSON.stringify(geminiHistory.slice(-6))}`;
            try {
                const geminiStartTime = Date.now();
                logger.info(`Attempting Gemini call with ${GEMINI_TIMEOUT_MS}ms timeout...`);
                const geminiPromise = geminiModel.generateContent(finalUnderstandingPrompt);
                const result = await withTimeout(geminiPromise, GEMINI_TIMEOUT_MS);
                const geminiEndTime = Date.now();
                logger.info({ durationMs: geminiEndTime - geminiStartTime }, 'Gemini call completed within timeout.');
                const textResponse = result.response.text().trim();
                let jsonString = textResponse;
                const jsonMatch = jsonString.match(/```(?:json)?\n([\s\S]*?)```/i);
                if (jsonMatch && jsonMatch[1]) {
                    jsonString = jsonMatch[1].trim();
                }
                else {
                    const jsonObjMatch = jsonString.match(/{[\s\S]*}/);
                    if (jsonObjMatch) {
                        jsonString = jsonObjMatch[0];
                    }
                }
                try {
                    const parsed = JSON.parse(jsonString);
                    // Validate all expected fields and their types
                    if (typeof parsed.ai_understanding === 'string' &&
                        typeof parsed.search_keywords === 'string' &&
                        typeof parsed.advice === 'string' &&
                        typeof parsed.requested_product_count === 'number' &&
                        Array.isArray(parsed.product_types) &&
                        (parsed.usage_instructions === undefined || typeof parsed.usage_instructions === 'string') &&
                        (parsed.price_filter === null || typeof parsed.price_filter === 'number' || parsed.price_filter === undefined) &&
                        (typeof parsed.sort_by_price === 'boolean' || parsed.sort_by_price === undefined) &&
                        (typeof parsed.vendor === 'string' || parsed.vendor === undefined) &&
                        (Array.isArray(parsed.attributes) || parsed.attributes === undefined) &&
                        typeof parsed.is_product_query === 'boolean') {
                        geminiResult = {
                            ai_understanding: parsed.ai_understanding,
                            search_keywords: parsed.search_keywords || "",
                            advice: parsed.advice,
                            requested_product_count: parsed.requested_product_count,
                            product_types: parsed.product_types || [],
                            usage_instructions: parsed.usage_instructions || "",
                            price_filter: parsed.price_filter === undefined ? null : parsed.price_filter,
                            sort_by_price: parsed.sort_by_price === undefined ? false : parsed.sort_by_price,
                            vendor: parsed.vendor || "",
                            attributes: parsed.attributes || [],
                            is_product_query: parsed.is_product_query,
                            product_tags: geminiResult.product_tags
                        };
                        if (geminiResult.product_types.length > 0) {
                            geminiResult.requested_product_count = geminiResult.product_types.length;
                        }
                        else if (trimmedQuery.toLowerCase().includes('set') || trimmedQuery.toLowerCase().includes('combo')) {
                            geminiResult.product_types = keywordMappings.defaultComboTypes.length > 0
                                ? keywordMappings.defaultComboTypes
                                : ['cleanser', 'moisturizer', 'treatment'];
                            geminiResult.requested_product_count = geminiResult.product_types.length;
                        }
                        else if (trimmedQuery.toLowerCase().includes('top 4 cheapest')) {
                            geminiResult.requested_product_count = 4;
                        }
                        else if (trimmedQuery.toLowerCase().includes('list')) {
                            geminiResult.requested_product_count = Math.min(geminiResult.requested_product_count || 10, 10);
                        }
                        logger.info({ geminiResult }, 'Successfully parsed Gemini JSON.');
                    }
                    else {
                        logger.warn({ parsed }, 'Invalid Gemini response structure.');
                        geminiResult.is_product_query = !!parsed.is_product_query; // Coerce to boolean
                    }
                }
                catch (parseError) {
                    logger.error({ err: parseError, rawResponse: textResponse }, 'Failed to parse Gemini response.');
                    geminiResult.is_product_query = false;
                }
            }
            catch (llmError) {
                if (llmError instanceof Error && llmError.message?.includes('timed out')) {
                    logger.error(`Gemini call timed out after ${GEMINI_TIMEOUT_MS}ms.`);
                }
                else {
                    logger.error({ err: llmError }, 'Error calling Gemini.');
                }
                geminiResult.is_product_query = false;
            }
        }
        else {
            logger.warn('Gemini client not initialized.');
            geminiResult.is_product_query = false;
        }
        function validateGeminiResponse(query, geminiResultToValidate) {
            const greetings = ["hello", "hi", "hey", "thanks", "thank you", "good morning", "good afternoon", "good evening"];
            const isGreeting = greetings.some(g => query.toLowerCase().includes(g)) && query.split(' ').length <= 3;
            let validatedResult = { ...geminiResultToValidate };
            if (isGreeting) {
                const originalAdvice = validatedResult.advice;
                const wasProductQueryAccordingToGemini = validatedResult.is_product_query ||
                    (validatedResult.search_keywords && validatedResult.search_keywords.trim() !== '') ||
                    (validatedResult.product_types && validatedResult.product_types.length > 0);
                validatedResult = {
                    ...validatedResult,
                    is_product_query: false,
                    search_keywords: "",
                    product_types: [],
                    requested_product_count: 0,
                    ai_understanding: "greeting",
                };
                if (wasProductQueryAccordingToGemini || !originalAdvice || originalAdvice.trim() === "" || originalAdvice.toLowerCase().includes("looking for")) {
                    validatedResult.advice = "Hi! How can I assist you today?";
                }
                else {
                    validatedResult.advice = originalAdvice;
                }
                logger.info(`Validation: Processed greeting query: "${query}". Original Gemini product query: ${wasProductQueryAccordingToGemini}. Final advice: "${validatedResult.advice}"`);
            }
            else if (validatedResult.is_product_query) {
                if ((!validatedResult.search_keywords || validatedResult.search_keywords.trim() === '') &&
                    (!validatedResult.product_types || validatedResult.product_types.length === 0)) {
                    logger.info(`Validation: Product query "${query}" has no keywords or types. Setting is_product_query to false.`);
                    validatedResult = { ...validatedResult, is_product_query: false };
                }
            }
            validatedResult.is_product_query = !!validatedResult.is_product_query;
            // Additional validation based on refined ai_understanding
            const understanding = validatedResult.ai_understanding.toLowerCase();
            if (understanding.includes("follow-up clarification") || understanding.includes("memory query")) {
                // These intents, by default, should not trigger product search unless explicitly asking for new products,
                // which the prompt now guides Gemini to set is_product_query for.
                // This validation ensures it if Gemini slips.
                if (!validatedResult.is_product_query) { // If Gemini didn't already mark it as a product query
                    logger.info(`Validation: Intent is "${understanding}", ensuring is_product_query is false.`);
                    validatedResult.is_product_query = false;
                    validatedResult.search_keywords = "";
                    validatedResult.product_types = [];
                    validatedResult.requested_product_count = 0;
                }
            }
            // Preserve "conversational follow-up" if Gemini identified it and it's not a greeting.
            // The original greeting check already handles simple greetings.
            if (understanding.includes("conversational follow-up") && !isGreeting) {
                validatedResult.ai_understanding = "conversational follow-up"; // Keep it more specific than just "greeting"
                validatedResult.is_product_query = false;
                validatedResult.search_keywords = "";
                validatedResult.product_types = [];
                validatedResult.requested_product_count = 0;
                logger.info(`Validation: Preserving "conversational follow-up" intent.`);
            }
            // Fallback check for fictional items based on advice content, if prompt engineering didn't catch it
            if (validatedResult.is_product_query && validatedResult.advice) {
                const adviceLower = validatedResult.advice.toLowerCase();
                const fictionalKeywords = [
                    "fictional",
                    "doesn't exist",
                    "not real",
                    "sounds magical but",
                    "unable to find a product made from",
                    "seems to be a fictional material" // from prompt example
                ];
                if (fictionalKeywords.some(keyword => adviceLower.includes(keyword))) {
                    logger.info(`Validation: Fictional item detected in advice ("${validatedResult.advice.substring(0, 50)}...") despite is_product_query=true. Forcing to false.`);
                    validatedResult.is_product_query = false;
                    validatedResult.search_keywords = "";
                    validatedResult.product_types = [];
                    validatedResult.requested_product_count = 0;
                    // Keep the advice as Gemini likely explained it's fictional.
                }
            }
            return validatedResult;
        }
        geminiResult = validateGeminiResponse(trimmedQuery, geminiResult);
        logger.info({ validatedGeminiResult: geminiResult }, 'Gemini result after validation.');
        // Ensure is_product_query is strictly boolean after all manipulations
        geminiResult.is_product_query = !!geminiResult.is_product_query;
        let shouldPerformProductSearch = geminiResult.is_product_query; // Use the validated and coerced value
        let finalProductCards = [];
        const SIMILARITY_THRESHOLD = 2;
        const requestedCount = Math.max(1, geminiResult.requested_product_count || 1);
        const topK = Math.max(requestedCount * 2, 10);
        const performVectorQuery = async (searchText, k, filter) => {
            if (!vectorIndex) {
                logger.warn('Vector client not initialized.');
                return null;
            }
            if (!searchText || searchText.trim().length === 0) {
                logger.info('No search text provided.');
                return null;
            }
            const expandKeywords = (text, synonyms) => {
                let expanded = text.toLowerCase().split(' ');
                for (const [key, syns] of Object.entries(synonyms)) {
                    if (text.includes(key)) {
                        expanded = [...expanded, ...syns];
                    }
                }
                return [...new Set(expanded)].join(' ');
            };
            const expandedKeywords = expandKeywords(searchText, keywordMappings.synonyms);
            try {
                const vectorQueryStartTime = Date.now();
                logger.info({ searchText: expandedKeywords.substring(0, 70), topK: k, indexName: UPSTASH_VECTOR_INDEX_NAME }, "Querying vector index (BM25 sparse search).");
                const vectorQueryPromise = vectorIndex.query({ data: expandedKeywords, topK: k, includeMetadata: true });
                const results = await withTimeout(vectorQueryPromise, 5000); // 5-second timeout for vector query
                const vectorQueryEndTime = Date.now();
                if (!results || results.length === 0) {
                    logger.info({ searchText: expandedKeywords, durationMs: vectorQueryEndTime - vectorQueryStartTime }, 'Vector query yielded no results.');
                    return null;
                }
                logger.info({ numResults: results.length, topMatchId: results[0].id, topScore: results[0].score.toFixed(4), durationMs: vectorQueryEndTime - vectorQueryStartTime }, 'Vector query successful.');
                if (filter?.productType || (geminiResult.attributes && geminiResult.attributes.length > 0)) {
                    logger.info({
                        count: results.length,
                        filterCriteria: {
                            productType: filter?.productType,
                            attributes: geminiResult.attributes,
                            vendor: filter?.vendor,
                            price: geminiResult.price_filter
                        },
                        rawResultsMetadata: results.slice(0, 5).map(r => ({ id: r.id, score: r.score, metadata: r.metadata }))
                    }, 'Raw vector results before filtering');
                }
                let filteredResults = results.filter(result => {
                    if (!result.metadata || !isProductVectorMetadata(result.metadata)) {
                        logger.warn({ metadata: result.metadata, score: result.score }, 'Invalid metadata in vector query result.');
                        return false;
                    }
                    const metadata = result.metadata;
                    let typeMatch = true;
                    let vendorMatch = true;
                    let priceMatch = true;
                    let attributeMatch = true;
                    if (filter?.productType) {
                        const productTypeLower = filter.productType.toLowerCase();
                        const metadataProductTypeString = ((metadata.productType ?? '').split('>').pop()?.trim().toLowerCase() || '');
                        typeMatch = Boolean(metadataProductTypeString.includes(productTypeLower) ||
                            (metadata.title && metadata.title.toLowerCase().includes(productTypeLower)));
                    }
                    const metadataTagsArray = Array.isArray(metadata.tags) ? metadata.tags.map(t => t.toLowerCase()) : [];
                    if (geminiResult.attributes && geminiResult.attributes.length > 0) {
                        const attributesLower = geminiResult.attributes.map(attr => attr.toLowerCase());
                        attributeMatch = attributesLower.some(attr => metadataTagsArray.includes(attr) ||
                            (metadata.title && metadata.title.toLowerCase().includes(attr)) ||
                            (metadata.textForBM25 && metadata.textForBM25.toLowerCase().includes(attr)));
                    }
                    if (filter?.vendor && filter.vendor.trim() !== '') {
                        const vendorLower = filter.vendor.toLowerCase();
                        const metadataVendor = (metadata.vendor ?? '').toLowerCase();
                        vendorMatch = metadataVendor === vendorLower;
                    }
                    const USD_TO_PESO_CONVERSION_RATE = 20; // Define conversion rate
                    if (geminiResult.price_filter != null) {
                        const priceInPesos = parsePrice(metadata.price);
                        const filterInPesos = geminiResult.price_filter * USD_TO_PESO_CONVERSION_RATE;
                        priceMatch = priceInPesos <= filterInPesos;
                        logger.info({
                            queryPriceFilterUSD: geminiResult.price_filter,
                            convertedFilterPesos: filterInPesos,
                            productPricePesos: priceInPesos,
                            match: priceMatch
                        }, 'Price filter (USD from Gemini) applied.');
                    }
                    else if (geminiResult.attributes?.includes('under $20')) {
                        const priceInPesos = parsePrice(metadata.price);
                        const filterInPesos = 20 * USD_TO_PESO_CONVERSION_RATE; // 20 USD in Pesos
                        priceMatch = priceInPesos <= filterInPesos;
                        logger.info({
                            queryAttribute: "under $20",
                            convertedFilterPesos: filterInPesos,
                            productPricePesos: priceInPesos,
                            match: priceMatch
                        }, 'Price filter (hardcoded "under $20") applied.');
                    }
                    geminiResult.product_tags = metadataTagsArray.join(', ');
                    return typeMatch && vendorMatch && priceMatch && attributeMatch;
                });
                if (geminiResult.sort_by_price) {
                    filteredResults = filteredResults
                        .filter(result => result.metadata != null)
                        .sort((a, b) => parsePrice(a.metadata.price) - parsePrice(b.metadata.price));
                }
                logger.info({ numFilteredResults: filteredResults.length }, 'Vector query results after filtering.');
                return filteredResults.length > 0 ? filteredResults : null;
            }
            catch (error) {
                logger.error({ err: error, searchText: expandedKeywords }, 'Upstash Vector Query Error.');
                logger.warn({ err: error, searchText: expandedKeywords }, 'Upstash Vector query failed. Attempting Shopify GraphQL fallback.');
                searchNote = '\n(Note: Searching products via alternative method due to a temporary issue with primary search.)';
                // Pass expandedKeywords as baseSearchText, geminiResult is in scope of performShopifyGraphQLQuery
                return await performShopifyGraphQLQuery(expandedKeywords, k);
            }
        };
        async function performShopifyGraphQLQuery(baseSearchText, // This was the original searchText for vector query
        limit) {
            logger.info({
                baseSearchText,
                geminiProductTypes: geminiResult.product_types,
                geminiAttributes: geminiResult.attributes,
                geminiVendor: geminiResult.vendor
            }, 'Performing Shopify GraphQL query as fallback.');
            const queryFilters = ["status:active"];
            const titleSearches = [];
            const tagSearches = [];
            // Use keywords from Gemini if available, otherwise from the base search text
            const keywordsToUse = (geminiResult.search_keywords && geminiResult.search_keywords.trim() !== '') ? geminiResult.search_keywords : baseSearchText;
            if (keywordsToUse) {
                const keywords = keywordsToUse.split(' ').filter(kw => kw.length > 2);
                if (keywords.length > 0) {
                    // Search in title OR tags for these keywords
                    titleSearches.push(keywords.map(kw => `title:*${kw}*`).join(' OR '));
                    // Consider adding to tagSearches as well if appropriate, e.g. keywords.map(kw => `tag:${kw}`).join(' OR ')
                }
            }
            // Product Types from Gemini (search in product_type OR title)
            if (geminiResult.product_types && geminiResult.product_types.length > 0) {
                const typeSpecificSearches = geminiResult.product_types.map(pt => `(product_type:*${pt}* OR title:*${pt}*)`).join(' OR ');
                if (typeSpecificSearches)
                    titleSearches.push(`(${typeSpecificSearches})`);
            }
            // Attributes from Gemini (map to tags, require all attributes to be present as tags)
            if (geminiResult.attributes && geminiResult.attributes.length > 0) {
                const attributeTagQuery = geminiResult.attributes.map(attr => `tag:"${attr.toLowerCase()}"`).join(' AND ');
                if (attributeTagQuery)
                    queryFilters.push(`(${attributeTagQuery})`);
            }
            // Vendor from Gemini
            if (geminiResult.vendor && geminiResult.vendor.trim() !== "") {
                queryFilters.push(`vendor:"${geminiResult.vendor}"`);
            }
            // Combo/Set specific keywords if applicable
            const isComboOrSetQuery = trimmedQuery.toLowerCase().includes('set') || trimmedQuery.toLowerCase().includes('combo') || geminiResult.ai_understanding.toLowerCase().includes('set') || geminiResult.ai_understanding.toLowerCase().includes('combo');
            if (isComboOrSetQuery) {
                const comboKeywords = ["set", "kit", "combo", "bundle"];
                // Add to title searches OR tag searches
                titleSearches.push(comboKeywords.map(kw => `title:*${kw}*`).join(' OR '));
                tagSearches.push(comboKeywords.map(kw => `tag:${kw}`).join(' OR '));
            }
            let combinedTitleOrTypeSearch = "";
            if (titleSearches.length > 0) {
                combinedTitleOrTypeSearch = `(${titleSearches.join(' OR ')})`; // Combine all title/type related searches with OR
                queryFilters.push(combinedTitleOrTypeSearch);
            }
            if (tagSearches.length > 0) {
                // If there are already title searches, we might want to AND the tag searches,
                // or OR them if tags are an alternative way to find the item.
                // For now, let's OR them with title searches if title searches exist, otherwise push as AND.
                if (combinedTitleOrTypeSearch) {
                    queryFilters.pop(); // remove combinedTitleOrTypeSearch
                    queryFilters.push(`(${combinedTitleOrTypeSearch} OR (${tagSearches.join(' OR ')}))`);
                }
                else {
                    queryFilters.push(`(${tagSearches.join(' OR ')})`);
                }
            }
            // Remove "status:active" if it's the only filter, to avoid an empty query part if all others are empty
            let shopifyQueryFilter = queryFilters.filter(f => f && f !== "status:active").join(' AND ');
            if (shopifyQueryFilter) {
                shopifyQueryFilter = `(${shopifyQueryFilter}) AND status:active`;
            }
            else {
                shopifyQueryFilter = "status:active"; // Default if no other criteria
            }
            logger.info({ shopifyQueryFilter }, "Constructed Shopify Query Filter");
            try {
                const { products: shopifyProducts } = await fetchAdminShopifyProducts(null, limit, shopifyQueryFilter);
                if (!shopifyProducts || shopifyProducts.length === 0) {
                    logger.info({ query: shopifyQueryFilter }, 'Shopify GraphQL query yielded no results.');
                    return null;
                }
                const transformedResults = shopifyProducts.map(p => ({
                    id: p.id,
                    score: 0.5,
                    metadata: {
                        id: p.id,
                        handle: p.handle,
                        title: p.title,
                        price: p.priceRange.minVariantPrice.amount,
                        imageUrl: p.images.edges[0]?.node.url || null,
                        productUrl: p.onlineStoreUrl || `https://josedevai.myshopify.com/products/${p.handle}`,
                        variantId: p.variants?.edges[0]?.node.id || extractNumericIdFromGid(p.id),
                        vendor: p.vendor,
                        productType: p.productType,
                        tags: p.tags,
                        usageInstructions: p.descriptionHtml || '',
                        textForBM25: `${p.title} ${p.productType} ${p.vendor} ${p.tags.join(' ')}`,
                    },
                }));
                logger.info({ numResults: transformedResults.length }, 'Shopify GraphQL query successful and results transformed.');
                return transformedResults;
            }
            catch (error) {
                logger.error({ err: error, query: shopifyQueryFilter }, 'Shopify GraphQL fallback query error.');
                searchNote = '\n(Note: Product search is currently experiencing issues.)';
                return null;
            }
        }
        let topMatches = [];
        let searchStageUsed = 'None';
        if (shouldPerformProductSearch === true) {
            logger.info('Product query determined. Proceeding with product search.');
            const usedProductIds = new Set();
            const isComboOrSetQuery = trimmedQuery.toLowerCase().includes('set') || trimmedQuery.toLowerCase().includes('combo') || geminiResult.ai_understanding.toLowerCase().includes('set') || geminiResult.ai_understanding.toLowerCase().includes('combo');
            if (isComboOrSetQuery) {
                logger.info('Combo/Set query detected. Attempting to find explicit sets/kits first.');
                const comboSearchKeywords = `set kit combo bundle ${geminiResult.search_keywords || trimmedQuery}`;
                const explicitSetResults = await performVectorQuery(comboSearchKeywords, Math.min(topK, 3), // Fetch a few potential kits
                { tags: "set kit combo bundle", vendor: geminiResult.vendor });
                if (explicitSetResults && explicitSetResults.length > 0) {
                    // Filter further for titles that strongly indicate a set
                    const actualKits = explicitSetResults.filter(r => r.metadata && r.metadata.title?.toLowerCase().match(/set|kit|bundle|combo/));
                    if (actualKits.length > 0) {
                        logger.info({ count: actualKits.length }, `Found ${actualKits.length} explicit set/kit product(s).`);
                        // Add these kits to topMatches if they are not already present and we haven't met requestedCount.
                        // This allows a "master kit" to be one of the options.
                        actualKits.forEach(kit => {
                            if (!usedProductIds.has(String(kit.id)) && topMatches.length < requestedCount) {
                                topMatches.push(kit);
                                usedProductIds.add(String(kit.id));
                            }
                        });
                        // We will still proceed to the product_types loop to find individual components,
                        // as per Gemini's potential breakdown of a "set".
                        // The `requestedCount` will ultimately limit how many items are shown.
                        if (topMatches.length > 0)
                            searchStageUsed = 'Explicit Set/Kit Search';
                    }
                }
            }
            // Proceed to find individual components if product_types are specified by Gemini,
            // or if it's not a combo query, or if we still need more products to meet requestedCount.
            if (geminiResult.product_types && geminiResult.product_types.length > 0 && topMatches.length < requestedCount) {
                logger.info({ productTypes: geminiResult.product_types, currentTopMatches: topMatches.length, requestedCount }, 'Searching for individual product types (for a set or multi-type query).');
                for (const productType of geminiResult.product_types) {
                    // If we've already found enough products (e.g., from explicit set search or previous types), stop.
                    if (topMatches.length >= requestedCount) {
                        logger.info({ currentTopMatches: topMatches.length, requestedCount }, "Reached requested product count, stopping search for more types.");
                        break;
                    }
                    let searchKeywordsForComponent = productType;
                    const attributesString = geminiResult.attributes?.filter(attr => attr.trim() !== "").join(" "); // Ensure attributes are not empty strings
                    if (attributesString) {
                        searchKeywordsForComponent += " " + attributesString;
                    }
                    // Normalize and ensure unique keywords
                    searchKeywordsForComponent = [...new Set(searchKeywordsForComponent.toLowerCase().split(" "))].join(" ").trim();
                    logger.info({ productType, searchKeywordsForComponent }, `Attempting targeted search for component (vector search by keywords, attributes filtered internally).`);
                    // Search by component-specific keywords. Attribute filtering (e.g., "dry skin")
                    // happens inside performVectorQuery based on geminiResult.attributes.
                    // We are NOT passing productType in the filter here, relying on searchKeywordsForComponent.
                    let results = await performVectorQuery(searchKeywordsForComponent, topK, { vendor: geminiResult.vendor });
                    if (!results || results.length === 0) {
                        logger.info({ productType, searchKeywordsForComponent }, `Targeted component search failed. Trying broader vector search with just product type text (attributes still filtered internally).`);
                        // Fallback: search using only the productType string for vector query.
                        // Attributes from geminiResult.attributes will still be applied by performVectorQuery's internal filtering.
                        // We are NOT passing productType in the filter here.
                        results = await performVectorQuery(productType, topK, { vendor: geminiResult.vendor });
                    }
                    if (results && results.length > 0) {
                        const newResults = results.filter(r => !usedProductIds.has(String(r.id)));
                        // If it's a combo/set query and we are collecting multiple types, take 1 of each type.
                        // Otherwise, for a single product_type query, take up to sort_by_price limit or 1.
                        const itemsToTake = (isComboOrSetQuery && geminiResult.product_types && geminiResult.product_types.length > 1) ? 1 : (geminiResult.sort_by_price ? 4 : 1);
                        const slicedResults = newResults.slice(0, itemsToTake);
                        topMatches.push(...slicedResults);
                        slicedResults.forEach(r => usedProductIds.add(String(r.id)));
                        logger.info({ productType, count: slicedResults.length, itemsToTake }, `Added ${slicedResults.length} item(s) for type.`);
                    }
                    else {
                        logger.info({ productType }, `No matches found for component "${productType}" after fallbacks.`);
                    }
                }
                searchStageUsed = 'Multi-Type Query';
            }
            else {
                // This 'else' block is for when geminiResult.product_types is empty or not applicable,
                // or when topMatches.length >= requestedCount initially.
                // The original logic for AI keywords and direct query search follows.
                if (geminiResult.search_keywords && geminiResult.search_keywords.trim().length > 0) {
                    logger.info({ keywords: geminiResult.search_keywords }, 'Attempting search with AI keywords...');
                    const results = await performVectorQuery(geminiResult.search_keywords, topK, { vendor: geminiResult.vendor });
                    if (results) {
                        topMatches = results;
                        searchStageUsed = 'AI Keywords';
                    }
                }
                if (topMatches.length < requestedCount || !topMatches.some(m => m.score >= SIMILARITY_THRESHOLD)) {
                    const logReason = topMatches.length === 0 ? 'AI Keyword search yielded no/few results' : `Not enough matches (${topMatches.length}/${requestedCount}) or no scores above ${SIMILARITY_THRESHOLD}`;
                    logger.info({ reason: logReason, currentMatches: topMatches.length, requestedCount, threshold: SIMILARITY_THRESHOLD }, 'Attempting direct query following AI keywords or if no product_types.');
                    const directResults = await performVectorQuery(trimmedQuery, topK, { vendor: geminiResult.vendor });
                    if (directResults) {
                        topMatches = directResults;
                        searchStageUsed = 'Direct Query';
                    }
                }
            }
            if (topMatches.length === 0 || !topMatches.some(m => m.score >= SIMILARITY_THRESHOLD)) {
                logger.info({ threshold: SIMILARITY_THRESHOLD, currentMatchCount: topMatches.length, searchStageUsed }, 'No matches above threshold or no matches at all after initial product query search. Attempting fallback search...');
                const fallbackTypes = geminiResult.product_types.length > 0 ? geminiResult.product_types : keywordMappings.defaultComboTypes;
                const fallbackKeywords = fallbackTypes.map(t => keywordMappings.typeToKeywords[t.toLowerCase()] || t).join(' ');
                logger.info({ fallbackKeywords }, "Using fallback keywords for search.");
                const fallbackResults = await performVectorQuery(fallbackKeywords, topK, { vendor: geminiResult.vendor });
                if (fallbackResults) {
                    topMatches = fallbackResults;
                    searchStageUsed = 'Fallback Related Products';
                    searchNote = '\n(Sorry, we couldn\'t find exact matches for your request, but here are some related products you might like.)';
                }
            }
            if (topMatches.length > 0) {
                let validMatches = topMatches.filter(m => m.metadata && isProductVectorMetadata(m.metadata)).slice(0, requestedCount);
                if (geminiResult.sort_by_price) {
                    validMatches = validMatches.filter(m => m.metadata != null).sort((a, b) => parsePrice(a.metadata.price) - parsePrice(b.metadata.price));
                }
                if (validMatches.length > 0 && searchStageUsed !== 'Fallback Related Products') {
                    finalProductCards = validMatches.filter(m => m.score >= SIMILARITY_THRESHOLD).map(match => {
                        const productData = match.metadata;
                        logger.info({ searchStage: searchStageUsed, title: productData.title, score: match.score.toFixed(4), price: productData.price }, `Match Selected`);
                        return {
                            title: productData.title,
                            description: 'Found product related to your query.',
                            price: productData.price,
                            image: productData.imageUrl,
                            landing_page: productData.productUrl,
                            variantId: extractNumericIdFromGid(productData.variantId || productData.id || match.id),
                        };
                    });
                    if (finalProductCards.length > 0) {
                        searchNote = '';
                    }
                }
                if (finalProductCards.length === 0 && validMatches.length > 0) {
                    finalProductCards = validMatches.map(match => {
                        const productData = match.metadata;
                        logger.info({ title: productData.title, score: match.score.toFixed(4), price: productData.price }, "Fallback Match Selected (below threshold or different stage).");
                        return {
                            title: productData.title,
                            description: 'Related product suggestion.',
                            price: productData.price,
                            image: productData.imageUrl,
                            landing_page: productData.productUrl,
                            variantId: extractNumericIdFromGid(productData.variantId || productData.id || match.id),
                        };
                    });
                }
            }
            if (finalProductCards.length === 0) {
                logger.info({ searchStageUsed }, 'No matching products found after all search stages for product_query=true.');
                if (!searchNote) {
                    searchNote = '\n(I couldn\'t find specific products matching your request.)';
                }
            }
        }
        else if (shouldPerformProductSearch === false) {
            logger.info('Not a product query (determined by typeof check or type error fallback). No product search will be performed.');
            searchNote = '';
        }
        // The 'else' block that was here, which logged a CRITICAL TYPE ERROR, has been removed.
        // If isProdQuery is strictly a boolean, that 'else' should be unreachable.
        // Its removal aims to help TypeScript's control flow analysis correctly infer
        // that shouldPerformProductSearch can only be true or false at this point.
        const defaultUsageInstructions = geminiResult.usage_instructions || 'For skincare products: \n1. Cleanse your face with a gentle cleanser and pat dry.\n2. Apply a small amount of the product to affected areas, once or twice daily as directed.\n3. Follow with a non-comedogenic moisturizer.\n4. Use sunscreen during the day.\nFor makeup like lipstick: Apply evenly to lips, reapply as needed.\nAlways patch test new products and consult a specialist if irritation occurs.';
        let finalAdvice = geminiResult.advice;
        if (shouldPerformProductSearch === true) {
            finalAdvice = `${geminiResult.advice || ''}\n\n${defaultUsageInstructions}${searchNote}`;
        }
        else {
            finalAdvice = geminiResult.advice;
        }
        const finalResponse = {
            ai_understanding: geminiResult.ai_understanding,
            product_card: finalProductCards.length === 1 ? finalProductCards[0] : undefined,
            advice: filterNegativePhrasing(finalAdvice.trim()),
            complementary_products: finalProductCards.length > 1 ? finalProductCards : undefined,
            history: history,
        };
        history.push({ role: 'user', text: trimmedQuery });
        history.push({ role: 'bot', text: finalResponse.advice });
        const maxHistory = parseInt(process.env.MAX_CHAT_HISTORY || '10', 10);
        if (history.length > maxHistory) {
            history = history.slice(-maxHistory);
        }
        await setEphemeralUserChatHistory(userId, history);
        chatHistoryCache.set(userId, history);
        logger.info({ userId }, 'Chat history stored via setEphemeralUserChatHistory and in-memory cache.');
        logger.info({ response: finalResponse }, 'Sending final response.');
        return NextResponse.json(finalResponse);
    }
    catch (error) {
        logger.error({ err: error }, 'Chat API Error.');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorResponse = {
            ai_understanding: 'An error occurred.',
            advice: `Sorry, I encountered a problem processing your request. (Ref: ${errorMessage.substring(0, 100)})`,
            history: [],
        };
        logger.info('Sending error response:', JSON.stringify(errorResponse, null, 2));
        return NextResponse.json(errorResponse, { status: 500 });
    }
}
