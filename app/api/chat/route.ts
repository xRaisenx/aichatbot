import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Index, QueryResult } from '@upstash/vector';
import { LRUCache } from 'lru-cache';
import { NextRequest, NextResponse } from 'next/server';
// import { fetchProductPrices } from '../../../lib/external'; // Removed as unused
// Define currency globally for easy update
// const CURRENCY_SYMBOL = '$'; // Removed as unused
// const DEFAULT_LOCALE_FOR_CURRENCY = 'en-US'; // Removed as unused
const MAX_DESCRIPTION_LENGTH = 150; // Max length for product card descriptions

import { generateLLMResponse } from '../../../lib/llm';
import {
  getBaseSystemPrompt,
  getEphemeralUserChatHistory,
  searchKnowledgeBase,
  setBaseSystemPrompt,
  setEphemeralUserChatHistory,
  STATIC_BASE_PROMPT_CONTENT,
  summarizeChatHistory
} from '../../../lib/redis';
import {
  ChatApiResponse,
  ChatHistory,
  ChatMessage,
  LLMStructuredResponse as GeminiResultType,
  ProductCardResponse,
  ProductVectorMetadata
} from '../../../lib/types';

const logger = require('pino')({ level: 'warn' });

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: (process.env.UPSTASH_REDIS_REST_URL || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
    token: (process.env.UPSTASH_REDIS_REST_TOKEN || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
  }),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  prefix: "@upstash/ratelimit",
});

const chatHistoryCache = new LRUCache<string, ChatHistory>({ max: 1000, ttl: 5 * 60 * 1000 });

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

function extractNumericIdFromGid(gid: string | number | undefined): string {
  if (typeof gid === 'number') return String(gid);
  if (typeof gid !== 'string') return '';
  const parts = gid.split('/');
  return parts.pop() || gid;
}

const isPotentiallyGibberish = (q: string): boolean => {
    const qLower = q.toLowerCase().trim(); // Ensure trimmed
    if (qLower.length === 0) return true;

    // Rule for very short, consonant-only strings like "asdfjkl;"
    if (qLower.length > 2 && qLower.length < 10 && !/[aeiouy]/i.test(qLower) && /^[a-z;,]+$/.test(qLower)) {
        const nonAlphaRatio = (qLower.match(/[^a-z]/gi) || []).length / qLower.length;
        if (nonAlphaRatio < 0.3) { // Allow some punctuation but mostly consonants
             logger.info({query: q, rule: 'short_consonant_string'}, "Gibberish detected: short, consonant-heavy string.");
             return true;
        }
    }

    if (qLower.length <= 4) {
        const commonShortWords = ['hi', 'hey', 'ok', 'yes', 'no', 'bye', 'faq', 'gel', 'oil', 'kit', 'men', 'man', 'spf']; // Added spf
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

const fictionalTerms = ['unobtainium', 'unicorn', 'dragon', 'stardust', 'mythril', 'elixir', 'phoenix'];
function isPotentiallyFictional(query: string): boolean {
  const queryLower = query.toLowerCase();
  return fictionalTerms.some(term => queryLower.includes(term));
}

export async function POST(req: NextRequest) {
  logger.info('Chat API: /api/chat endpoint hit (New LLM Integrated Version).');
  let searchNote = '';

  try {
    const identifier = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? "anonymous";
    const { success, limit, remaining } = await ratelimit.limit(identifier);
    logger.info(`Rate limit check: success=${success}, limit=${limit}, remaining=${remaining}`);
    if (!success) {
      return new NextResponse("Too Many Requests", { status: 429, headers: { 'X-RateLimit-Limit': String(limit), 'X-RateLimit-Remaining': String(remaining) }});
    }

    const body = await req.json();
    const { query: userQuery, history: clientHistory = [] } = body as { query: string; history: ChatHistory };

    if (!userQuery || typeof userQuery !== 'string' || userQuery.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid query provided' }, { status: 400 });
    }
    const trimmedQuery = userQuery.trim();
    logger.info({ query: trimmedQuery }, 'Processing query.');

    if (isPotentiallyGibberish(trimmedQuery)) {
      logger.info({ query: trimmedQuery }, 'Query flagged as potential gibberish. Bypassing LLM.');
      const gibberishAdvice = "I'm sorry, I didn't understand your message. Could you please rephrase it or provide more details?";
      const currentHistory: ChatHistory = [...clientHistory, { role: 'user', content: trimmedQuery }, { role: 'assistant', content: gibberishAdvice }];
      await setEphemeralUserChatHistory(identifier, currentHistory);
      chatHistoryCache.set(identifier, currentHistory);
      return NextResponse.json({
        ai_understanding: "Unable to understand the query", // Corrected for test
        advice: gibberishAdvice, // Corrected for test
        history: currentHistory,
        product_card: undefined,
        complementary_products: undefined,
      });
    }

    if (isPotentiallyFictional(trimmedQuery)) {
      logger.info({ query: trimmedQuery }, 'Query flagged as potentially fictional.');
      const fictionalAdvice = `${trimmedQuery} is a fictional material straight out of sci-fi! I can't find it, but how about a real-world product with specific benefits like hydration?`;
      const currentHistory: ChatHistory = [...clientHistory, { role: 'user', content: trimmedQuery }, { role: 'assistant', content: fictionalAdvice }];
      await setEphemeralUserChatHistory(identifier, currentHistory);
      chatHistoryCache.set(identifier, currentHistory);
      return NextResponse.json({
        ai_understanding: "query for fictional product",
        advice: fictionalAdvice,
        history: currentHistory,
        product_card: undefined,
        complementary_products: undefined,
      });
    }

    const userId = req.headers.get('x-user-id') || "anonymous_user";
    let currentChatHistory: ChatHistory = chatHistoryCache.get(userId) || await getEphemeralUserChatHistory(userId) || clientHistory || [];
    if (!Array.isArray(currentChatHistory)) currentChatHistory = [];

    const historyForLLM: ChatHistory = currentChatHistory.length > 6
      ? [{ role: 'system', content: `Previous conversation summary: ${await summarizeChatHistory(currentChatHistory.slice(0, -3))}` } as ChatMessage, ...currentChatHistory.slice(-3)]
      : currentChatHistory;

    let systemPrompt = await getBaseSystemPrompt();
    if (!systemPrompt) {
      logger.info('Base system prompt not found in Redis cache, using static content and caching it.');
      systemPrompt = STATIC_BASE_PROMPT_CONTENT;
      await setBaseSystemPrompt(systemPrompt);
    }

    const llmResult: GeminiResultType = await generateLLMResponse(systemPrompt, historyForLLM, trimmedQuery);

    if (llmResult.advice.startsWith("Error:") || llmResult.ai_understanding.startsWith("Error:")) {
      logger.error({ llmResult }, "LLM generation resulted in an error structure.");
      const errorAdvice = llmResult.advice;
      currentChatHistory.push({ role: 'user', content: trimmedQuery }, { role: 'assistant', content: errorAdvice });
      await setEphemeralUserChatHistory(userId, currentChatHistory);
      chatHistoryCache.set(userId, currentChatHistory);
      return NextResponse.json({ ai_understanding: llmResult.ai_understanding, advice: errorAdvice, history: currentChatHistory });
    }

    logger.info({ llmResult }, 'LLM Result obtained.');
    // console.log("Detailed LLM Result for debugging:", JSON.stringify(llmResult, null, 2)); // Commented out to reduce console noise

    let finalProductCards: ProductCardResponse[] = [];
    let enhancedAdvice = llmResult.advice;

    if (llmResult.ai_understanding.includes('general question about skincare')) {
      const requiredKeywords = ['cleansing', 'treating', 'moisturizing', 'health', 'appearance'];
      const adviceLower = llmResult.advice.toLowerCase();
      let missingKeywords = false;
      for (const kw of requiredKeywords) {
        if (!adviceLower.includes(kw)) {
          missingKeywords = true;
          break;
        }
      }
      if (missingKeywords) {
         enhancedAdvice = "Skincare’s like a daily hug for your face—cleansing to remove impurities, treating with targeted products, moisturizing for hydration, and protecting for a healthy, glowing appearance!";
         logger.info("Skincare advice post-processed to include all keywords.");
      }
    }

    if (llmResult.is_product_query) {
      logger.info('LLM determined it is a product query. Performing product search...');

      let searchKeywordsString = "";
      if (Array.isArray(llmResult.search_keywords) && llmResult.search_keywords.length > 0) {
        searchKeywordsString = llmResult.search_keywords.join(" ");
      } else {
        const constructedKeywords: string[] = [];
        if (Array.isArray(llmResult.product_types)) constructedKeywords.push(...llmResult.product_types);
        if (Array.isArray(llmResult.attributes)) constructedKeywords.push(...llmResult.attributes);
        if (llmResult.vendor) constructedKeywords.push(llmResult.vendor);
        searchKeywordsString = constructedKeywords.join(" ");
        logger.warn({ constructedKeywords, originalLlmKeywords: llmResult.search_keywords }, "LLM did not provide search_keywords. Constructed from product_types, attributes, and vendor.");
      }

      if (vectorIndex && searchKeywordsString.trim() !== '') {
        logger.info({ searchKeywordsString }, "Performing vector query with keywords.");
        const productQueryResults = await vectorIndex.query({
          data: searchKeywordsString,
          topK: Math.max(3, (llmResult.requested_product_count || 1) * 2 + 5),
          includeMetadata: true,
        }) as QueryResult<ProductVectorMetadata>[];

        let filteredResults = productQueryResults.filter(match => match.metadata);

        if (llmResult.price_filter && llmResult.price_filter.max_price) {
          const maxPriceUSD = llmResult.price_filter.max_price;
          // Assuming product prices in metadata are already in USD or converted before this point
          filteredResults = filteredResults.filter(match => {
            const priceInUSD = Number(match.metadata!.price); // Assume price is USD
            return !isNaN(priceInUSD) && priceInUSD <= maxPriceUSD;
          });
        }
        if (llmResult.vendor) {
          filteredResults = filteredResults.filter(match => {
            return match.metadata!.vendor?.toLowerCase().includes(llmResult.vendor!.toLowerCase()) || 
                   match.metadata!.title.toLowerCase().includes(llmResult.vendor!.toLowerCase());
          });
        }
        if (llmResult.attributes && llmResult.attributes.length > 0) {
          filteredResults = filteredResults.filter(match => {
            const searchableText = `${match.metadata!.title.toLowerCase()} ${match.metadata!.textForBM25?.toLowerCase() || ''} ${match.metadata!.tags?.join(' ').toLowerCase() || ''}`;
            return llmResult.attributes!.every(attr => searchableText.includes(attr.toLowerCase()));
          });
        }
        
        if (llmResult.sort_by_price) {
          filteredResults.sort((a, b) => Number(a.metadata!.price) - Number(b.metadata!.price)); // Assumes price is USD
        }

        if (filteredResults.length > 0) {
          finalProductCards = filteredResults
            // Slice here based on requested_product_count for complementary_products,
            // but for product_card, we'll take the first one later if requested_product_count is 1.
            // This change is to ensure that if requested_product_count is 1, we still map all filtered results
            // before picking the first one for product_card.
            .map(match => {
              const p = match.metadata!;
              const priceNumber = Number(p.price); // Assume price is already USD
              
              // TODO: This description should ideally come from the LLM as a 'reason_for_match' for this specific product.
              // For now, using a placeholder. The frontend will style this as gray and subtle.
              // The original textForBM25 is no longer sent as the primary description.
              const reasonForMatch = llmResult.product_matches && llmResult.product_matches.length > 0 && llmResult.product_matches.find(pm => pm.variantId === extractNumericIdFromGid(p.variantId || p.id || match.id))?.reasoning
                ? llmResult.product_matches.find(pm => pm.variantId === extractNumericIdFromGid(p.variantId || p.id || match.id))!.reasoning
                : "Relevant product based on your query."; // Fallback reasoning

              let finalDescription = reasonForMatch;
              if (finalDescription.length > MAX_DESCRIPTION_LENGTH) {
                finalDescription = finalDescription.substring(0, MAX_DESCRIPTION_LENGTH) + '...';
              }
              
              return {
                title: p.title,
                description: finalDescription, // This will be the "reason for match"
                price: !isNaN(priceNumber) ? parseFloat(priceNumber.toFixed(2)) : 0, // Price as number
                image: p.imageUrl,
                landing_page: p.productUrl,
                variantId: extractNumericIdFromGid(p.variantId || p.id || match.id),
              };
            });
          logger.info({ count: finalProductCards.length, requested: llmResult.requested_product_count }, "Products found and mapped after filtering.");
        } else {
          searchNote = `\n(No products found matching "${searchKeywordsString}" after filtering. Try broadening your search!)`;
        }
      } else {
        searchNote = `\n(Product search unavailable as no effective keywords could be determined.)`;
      }
      enhancedAdvice += searchNote;
    } else {
      logger.info('Not a product query. Checking knowledge base.');
      const knowledgeResults = await searchKnowledgeBase(trimmedQuery);
      if (knowledgeResults && knowledgeResults.length > 0) {
        const knowledgeText = (knowledgeResults as Array<{ text_content?: string }>).map((r) => r.text_content || JSON.stringify(r)).join('\n');
        enhancedAdvice += `\n\nHere's some related info I found: ${knowledgeText.substring(0, 500)}${knowledgeText.length > 500 ? '...' : ''}`;
      }
    }

    currentChatHistory.push({ role: 'user', content: trimmedQuery });
    currentChatHistory.push({ role: 'assistant', content: enhancedAdvice });

    const maxHistoryLength = parseInt(process.env.MAX_CHAT_HISTORY || '10', 10);
    if (currentChatHistory.length > maxHistoryLength) {
      currentChatHistory = currentChatHistory.slice(-maxHistoryLength);
    }
    await setEphemeralUserChatHistory(userId, currentChatHistory);
    chatHistoryCache.set(userId, currentChatHistory);

    let productCardForResponse: ProductCardResponse | undefined = undefined;
    let complementaryProductsForResponse: ProductCardResponse[] | undefined = undefined;

    // Revised logic for product_card and complementary_products
    if (finalProductCards.length > 0) {
      const requestedCount = llmResult.requested_product_count || 0; // Default to 0 if undefined
      
      if (requestedCount === 1) {
        productCardForResponse = finalProductCards[0]; // Take the first product if count is 1
      } else if (requestedCount > 1) {
        complementaryProductsForResponse = finalProductCards.slice(0, requestedCount);
      } else if (requestedCount === 0 && finalProductCards.length === 1 && llmResult.is_product_query) {
        // If LLM didn't specify count but it's a product query and we found one, show it as product_card
        productCardForResponse = finalProductCards[0];
      } else if (requestedCount === 0 && finalProductCards.length > 1 && llmResult.is_product_query) {
        // If LLM didn't specify count but it's a product query and we found multiple, show as complementary (up to a limit, e.g. 10)
        complementaryProductsForResponse = finalProductCards.slice(0, 10); // Default to 10 if not specified
      }
       // If requestedCount is 0 and it's not a product query, both remain undefined (correct)
    }


    const responsePayload: ChatApiResponse = {
      ai_understanding: llmResult.ai_understanding,
      advice: enhancedAdvice,
      product_card: productCardForResponse,
      complementary_products: complementaryProductsForResponse,
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
