import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis"; // For Ratelimit
import { Index, QueryResult } from '@upstash/vector'; // For product vector search
import { LRUCache } from 'lru-cache';
import { NextRequest, NextResponse } from 'next/server';
import pino from 'pino';

// New and existing lib imports
import { fetchProductPrices } from '../../../lib/external'; // New
import { generateLLMResponse } from '../../../lib/llm'; // LLMChatHistory is no longer exported from llm.ts
import {
    getBaseSystemPrompt, // For retrieving cached prompt
    getEphemeralUserChatHistory, // New
    searchKnowledgeBase, // For caching the prompt
    setBaseSystemPrompt,
    setEphemeralUserChatHistory, // New
    STATIC_BASE_PROMPT_CONTENT,
    summarizeChatHistory
} from '../../../lib/redis';
import {
    ChatApiResponse,
    ChatHistory, // Renamed from LLMChatHistory, now from types.ts
    ChatMessage,
    LLMStructuredResponse as GeminiResultType,
    ProductCardResponse,
    ProductVectorMetadata
} from '../../../lib/types'; // Centralized types

const logger = pino();

// --- Rate Limiter Initialization ---
const ratelimit = new Ratelimit({
  redis: new Redis({ // This Redis instance is specifically for Ratelimit
    url: (process.env.UPSTASH_REDIS_REST_URL || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
    token: (process.env.UPSTASH_REDIS_REST_TOKEN || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
  }),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  prefix: "@upstash/ratelimit",
});

// --- Initialize External Clients & Caches ---
// KNOWLEDGE_BASE_INDEX_NAME is defined in redis.ts, used by searchKnowledgeBase

const chatHistoryCache = new LRUCache<string, ChatHistory>({ // Use unified ChatHistory
  max: 1000,
  ttl: 5 * 60 * 1000,
});

let vectorIndex: Index<ProductVectorMetadata> | null = null;
if (process.env.UPSTASH_VECTOR_URL && process.env.UPSTASH_VECTOR_TOKEN) {
    try {
        vectorIndex = new Index<ProductVectorMetadata>({
            url: (process.env.UPSTASH_VECTOR_REST_URL || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
            token: (process.env.UPSTASH_VECTOR_TOKEN || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
        });
        logger.info('Upstash Vector client for products initialized.');
    } catch (error) {
        logger.error({ err: error }, 'Failed to initialize Product Vector Index.');
    }
} else {
    logger.error('Missing Upstash Vector credentials for Product Index.');
}

// --- Type Definitions (Simplified for brevity, ensure they match your actual needs) ---
// Type definitions are now imported from lib/types.ts, so local definitions are removed.

// --- Helper Functions (isPotentiallyGibberish, parsePrice, etc. - kept from original for brevity, ensure they are present) ---
function extractNumericIdFromGid(gid: string | number | undefined): string {
    if (typeof gid === 'number') return String(gid);
    if (typeof gid !== 'string') return '';
    const parts = gid.split('/');
    return parts.pop() || gid;
}

const isPotentiallyGibberish = (q: string): boolean => {
    const qLower = q.toLowerCase();
    if (qLower.length === 0) return true;
    if (qLower.length <= 4) {
        const commonShortWords = ['hi', 'hey', 'ok', 'yes', 'no', 'bye', 'faq', 'gel', 'oil', 'kit', 'men', 'man'];
        if (!commonShortWords.includes(qLower) && !/[aeiou]/i.test(qLower)) {
            logger.info({query: q, rule: 1}, "Gibberish detected: short, no vowels, not common.");
            return true;
        }
    }
    if (qLower.length >= 4 && qLower.length <= 8) {
        const coreQuery = qLower.replace(/[;,.!?]$/, '');
        const noVowels = !/[aeiouy]/i.test(coreQuery);
        const notNumeric = !/^\d+$/.test(coreQuery);
        const notAcronymLike = !/^[A-Z0-9]+$/.test(q);
        logger.info({ query: q, qLower, coreQuery, rule: 2, length: qLower.length, noVowels, notNumeric, notAcronymLike, conditionsMet: noVowels && notNumeric && notAcronymLike }, "Gibberish Rule 2 evaluation details");
        if (noVowels && notNumeric && notAcronymLike) {
            logger.info({query: q, coreQuery, rule: 2}, "Gibberish detected by Rule 2.");
            return true;
        }
    }
    if (qLower.length > 0) {
        const alphaNumericChars = (qLower.match(/[a-z0-9]/gi) || []).length;
        const totalChars = qLower.length;
        if (totalChars > 0 && alphaNumericChars / totalChars < 0.3 && totalChars > 3) {
            logger.info({query: q, rule: 3.1, ratio: (alphaNumericChars / totalChars).toFixed(2)}, "Gibberish detected: low alphanumeric ratio.");
            return true;
        }
    }
    if (/(.)\1{2,}/.test(qLower)) {
        logger.info({query: q, rule: '4.1_consecutive_identical'}, "Gibberish detected: 3+ consecutive identical characters.");
        return true;
    }
    if (qLower.length > 5 && qLower.length < 15) {
        const firstThree = qLower.substring(0,3);
        if (qLower.substring(3).startsWith(firstThree) && qLower.substring(3+firstThree.length).startsWith(firstThree)) {
             logger.info({query: q, rule: '4.2_3char_triple_repetition', pattern: firstThree}, "Gibberish detected.");
             return true;
        }
        const firstTwo = qLower.substring(0,2);
         if (qLower.substring(2).startsWith(firstTwo) && qLower.substring(4).startsWith(firstTwo) && qLower.substring(6).startsWith(firstTwo)) {
             logger.info({query: q, rule: '4.3_2char_quad_repetition', pattern: firstTwo}, "Gibberish detected.");
             return true;
         }
        if (qLower.length === 6) {
            const pattern = qLower.substring(0,3);
            if (qLower.substring(3) === pattern) {
                const vowelsInPattern = (pattern.match(/[aeiouy]/gi) || []).length;
                if (vowelsInPattern === 0) {
                     logger.info({query: q, rule: '4.4_3char_pattern_pair_no_vowels', pattern}, "Gibberish detected.");
                     return true;
                }
            }
        }
        if (qLower.length === 8) {
            const pattern = qLower.substring(0,4);
            if (qLower.substring(4) === pattern) {
                const vowelsInPattern = (pattern.match(/[aeiouy]/gi) || []).length;
                if (vowelsInPattern <= 1) {
                     logger.info({query: q, rule: '4.5_4char_pattern_pair_low_vowels', pattern, vowelsInPattern}, "Gibberish detected.");
                     return true;
                }
            }
        }
    }
    if (qLower.length > 2 && (qLower.match(/[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\';\/~`]/g) || []).length / qLower.length > 0.6 && (qLower.match(/[a-z]/gi) || []).length < 3) {
         logger.info({query: q, rule: 5}, "Gibberish detected: mostly symbols, very few letters.");
         return true;
    }
    return false;
};
// --- Main POST Handler ---
export async function POST(req: NextRequest) {
    logger.info('Chat API: /api/chat endpoint hit (New LLM Integrated Version).');
    let searchNote = ''; // For notes about search status

    try {
        const identifier = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? "anonymous";
        const { success, limit, remaining } = await ratelimit.limit(identifier);
        logger.info(`Rate limit check: success=${success}, limit=${limit}, remaining=${remaining}`);
        if (!success) {
            return new NextResponse("Too Many Requests", { status: 429, headers: { 'X-RateLimit-Limit': String(limit), 'X-RateLimit-Remaining': String(remaining) }});
        }

        const body = await req.json();
        const { query: userQuery, history: clientHistory = [] } = body as { query: string; history: ChatHistory }; // Use unified ChatHistory

        if (!userQuery || typeof userQuery !== 'string' || userQuery.trim().length === 0) {
            return NextResponse.json({ error: 'Invalid query provided' }, { status: 400 });
        }
        const trimmedQuery = userQuery.trim();
        logger.info({ query: trimmedQuery }, 'Processing query.');

        if (isPotentiallyGibberish(trimmedQuery)) {
            logger.info({ query: trimmedQuery }, 'Query flagged as potential gibberish. Bypassing LLM.');
            const gibberishAdvice = "I'm sorry, I didn't understand your message. Could you please rephrase it or provide more details?";
            const currentHistory : ChatHistory = [...clientHistory, { role: 'user', text: trimmedQuery }, { role: 'bot', text: gibberishAdvice }]; // Use unified ChatHistory
            await setEphemeralUserChatHistory(identifier, currentHistory); // Use identifier for user ID
            chatHistoryCache.set(identifier, currentHistory);
            return NextResponse.json({ ai_understanding: "Unable to understand the query.", advice: gibberishAdvice, history: currentHistory });
        }

        const userId = req.headers.get('x-user-id') || "anonymous_user"; // Ensure a user ID
        let currentChatHistory: ChatHistory = chatHistoryCache.get(userId) || await getEphemeralUserChatHistory(userId) || clientHistory || []; // Use unified ChatHistory
        if (!Array.isArray(currentChatHistory)) currentChatHistory = [];


        // Summarize history if long
        const historyForLLM: ChatHistory = currentChatHistory.length > 6 // Example threshold for summarization
            ? [{ role: 'system', content: `Previous conversation summary: ${await summarizeChatHistory(currentChatHistory.slice(0, -3))}` } as ChatMessage, ...currentChatHistory.slice(-3)] // Ensure system message conforms to ChatMessage
            : currentChatHistory;
        
        // Get the base system prompt (Grok-style)
        let systemPrompt = await getBaseSystemPrompt();
        if (!systemPrompt) {
            logger.info('Base system prompt not found in Redis cache, using static content and caching it.');
            systemPrompt = STATIC_BASE_PROMPT_CONTENT; // This is the new Grok-style prompt
            await setBaseSystemPrompt(systemPrompt); // Cache it
        }

        // Call the new LLM response generation function
        const llmJsonResponse = await generateLLMResponse(systemPrompt, historyForLLM, trimmedQuery);
        let llmResult: GeminiResultType;
        try {
            llmResult = JSON.parse(llmJsonResponse) as GeminiResultType;
        } catch (e) {
            logger.error({ err: e, rawResponse: llmJsonResponse }, "Failed to parse LLM JSON response.");
            // Fallback response if LLM output is not parsable
            const errorAdvice = "I'm having a little trouble forming a complete thought right now. Could you try asking in a different way?";
            currentChatHistory.push({ role: 'user', text: trimmedQuery }, { role: 'bot', text: errorAdvice });
            await setEphemeralUserChatHistory(userId, currentChatHistory);
            chatHistoryCache.set(userId, currentChatHistory);
            return NextResponse.json({ ai_understanding: "LLM response parsing error", advice: errorAdvice, history: currentChatHistory });
        }

        logger.info({ llmResult }, 'LLM Result obtained.');

        let finalProductCards: ProductCardResponse[] = [];
        let enhancedAdvice = llmResult.advice;

        if (llmResult.is_product_query) {
            logger.info('LLM determined it is a product query. Performing product search...');
            if (vectorIndex && llmResult.search_keywords && llmResult.search_keywords.trim() !== '') {
                const productQueryResults = await vectorIndex.query({
                    data: llmResult.search_keywords,
                    topK: Math.max(1, llmResult.requested_product_count || 1) * 2, // Fetch more to filter
                    includeMetadata: true,
                    // TODO: Add filtering based on llmResult.attributes, llmResult.vendor, llmResult.price_filter
                    // This requires adapting the performVectorQuery logic from the original file or similar.
                    // For now, it's a simple keyword search.
                }) as QueryResult<ProductVectorMetadata>[];

                if (productQueryResults && productQueryResults.length > 0) {
                    finalProductCards = productQueryResults
                        .filter(match => match.metadata) // Ensure metadata exists
                        .slice(0, llmResult.requested_product_count || 1) // Take requested number
                        .map(match => {
                            const p = match.metadata!;
                            return {
                                title: p.title,
                                description: p.textForBM25 || p.title, // Fallback description
                                price: Number(p.price), // Ensure price is a number
                                image: p.imageUrl,
                                landing_page: p.productUrl,
                                variantId: extractNumericIdFromGid(p.variantId || p.id || match.id),
                            };
                        });
                    logger.info({ count: finalProductCards.length }, "Products found via vector search.");
                } else {
                    searchNote = "\n(I couldn't find specific products for that, but here's some advice.)";
                }
            } else {
                 searchNote = "\n(Product search is unavailable or no keywords provided by AI.)";
            }
            // Optionally enhance with external price data
            if (finalProductCards.length > 0 && llmResult.product_types && llmResult.product_types.length > 0) {
                const prices = await fetchProductPrices(llmResult.product_types[0], llmResult.attributes || []);
                if (prices && prices.length > 0) {
                    enhancedAdvice += `\n\nI also found some external price info: ${JSON.stringify(prices.slice(0,2))}`;
                }
            }
             enhancedAdvice += searchNote;

        } else { // Not a product query, try knowledge base
            logger.info('Not a product query. Checking knowledge base.');
            const knowledgeResults = await searchKnowledgeBase(trimmedQuery);
            if (knowledgeResults && knowledgeResults.length > 0) {
                const knowledgeText = (knowledgeResults as Array<{ text_content?: string }>).map((r) => r.text_content || JSON.stringify(r)).join('\n');
                enhancedAdvice += `\n\nHere's some related info I found: ${knowledgeText.substring(0, 500)}${knowledgeText.length > 500 ? '...' : ''}`;
            }
        }
        
        // Update history
        currentChatHistory.push({ role: 'user', text: trimmedQuery });
        currentChatHistory.push({ role: 'bot', text: enhancedAdvice, content: JSON.stringify(llmResult) }); // Store full LLM result in content for bot message

        const maxHistoryLength = parseInt(process.env.MAX_CHAT_HISTORY || '10', 10);
        if (currentChatHistory.length > maxHistoryLength) {
            currentChatHistory = currentChatHistory.slice(-maxHistoryLength);
        }
        await setEphemeralUserChatHistory(userId, currentChatHistory);
        chatHistoryCache.set(userId, currentChatHistory);

        const responsePayload: ChatApiResponse = {
            ai_understanding: llmResult.ai_understanding,
            advice: enhancedAdvice,
            product_card: finalProductCards.length === 1 ? finalProductCards[0] : undefined,
            complementary_products: finalProductCards.length > 1 ? finalProductCards : undefined,
            history: currentChatHistory,
        };

        logger.info({ responsePayload }, 'Sending final response.');
        return NextResponse.json(responsePayload);

    } catch (error) {
        logger.error({ err: error }, 'Chat API Main Error.');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Chat API processing error: ${errorMessage}` }, { status: 500 });
    }
}
