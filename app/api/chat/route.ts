// app/api/chat/route.ts
import { Index, QueryResult } from '@upstash/vector';
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import pino from 'pino';

import { generateLLMResponse } from '../../../lib/llm';
import {
    cacheResponse,
    cacheSessionHistory,
    getCachedResponse,
    getSessionHistory,
    updateKnowledgebase,
} from '../../../lib/redis';

import {
    ChatApiResponse,
    ChatHistory,
    LLMStructuredResponse,
    ProductCardResponse,
    ProductVectorMetadata
} from '../../../lib/types';

// --- Environment Variable Checks ---
// Use console.error for critical missing variables, warn for non-critical
if (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN) {
  console.error('FATAL: Missing UPSTASH_VECTOR_REST_URL or UPSTASH_VECTOR_REST_TOKEN environment variables. Vector search will be unavailable.');
}
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn('WARNING: Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables. Caching and session history will be unavailable.');
}
if (!process.env.GEMINI_API_KEY) {
  console.warn('WARNING: Missing GEMINI_API_KEY environment variable. LLM features will be limited or unavailable.');
}

// --- Upstash Vector Client ---
const vectorIndex = (process.env.UPSTASH_VECTOR_REST_URL && process.env.UPSTASH_VECTOR_REST_TOKEN) ?
  new Index<ProductVectorMetadata>({
    url: process.env.UPSTASH_VECTOR_REST_URL,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN,
  }) : null;

// --- Logger ---
// Set default level to 'info', debug logs will only show if PINO_LOG_LEVEL=debug
const logger = pino({ level: process.env.PINO_LOG_LEVEL || 'info' });

// --- Constants ---
const MAX_DESCRIPTION_LENGTH = 200;
const DEFAULT_CACHE_TTL = 600; // Reduced default TTL slightly
const FINAL_PRODUCT_LIMIT = 10; // New constant for the maximum number of products to return
const VECTOR_FETCH_COUNT = 20; // Fetch slightly more than the final limit to allow for metadata filtering


// --- Helper Functions ---
/**
 * Extracts the numeric ID from a Shopify GID string or returns the input if already numeric/string.
 * @param gid The Shopify GID string (e.g., "gid://shopify/ProductVariant/12345") or a number/string ID.
 * @returns The numeric ID as a string, or the original input if not a valid GID string.
 */
function extractNumericIdFromGid(gid: string | number | undefined): string {
  if (typeof gid === 'number') return String(gid);
  if (typeof gid !== 'string' || !gid) return '';
  const parts = gid.split('/');
  return parts.pop() || gid; // Return the last part (the ID) or the original string if split fails
}

/**
 * Generates a unique cache key based on user ID, query, and chat history.
 * Normalizes query and history content for consistent key generation.
 * @param userId The unique identifier for the user.
 * @param query The user's current query.
 * @param chatHistory The current chat history including the user's query.
 * @returns A SHA1 hash prefixed for Redis caching.
 */
function generateCacheKey(userId: string, query: string, chatHistory: ChatHistory): string {
  // Normalize query and history content: lowercase, single spaces, trim
  const normalizeContent = (content: string | undefined) =>
    (content ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

  const normalizedQuery = normalizeContent(query);
  const historyString = JSON.stringify(chatHistory.map(msg => ({
    role: msg.role,
    content: normalizeContent(msg.content ?? msg.text)
  })));

  const combinedKeyData = `${userId}:::${normalizedQuery}:::${historyString}`;
  const hash = createHash('sha1').update(combinedKeyData).digest('hex');
  const RESPONSE_CACHE_PREFIX = 'chat:response:'; // Define prefix locally or import if used elsewhere
  return `${RESPONSE_CACHE_PREFIX}${hash}`;
}

/**
 * Formats the conversational advice from the LLM.
 * This version focuses on the text advice and mentions product recommendations separately.
 * @param advice The raw advice text from the LLM.
 * @param products The list of recommended products.
 * @returns Formatted advice string.
 */
// Removed unused options parameter
function formatChatboxResponse(advice: string, products: ProductCardResponse[]): string {
  let response = advice.replace(/\n/g, '\n\n').trim();

  // Add a concluding sentence if products are being recommended and the advice didn't already clearly state it
  const productIntroRegex = /\b(recommend|suggest|find|show|here are|check out)\b/i;
  if (products.length > 0 && !productIntroRegex.test(response)) {
       response += `\n\nHere are some products that might help:`;
  }
  // Removed the else if for "couldn't find specific products" as filtering is now simpler

  return response.trim();
}

// Removed llmExtractedSpecificCriteria helper function as it's no longer used for filtering
// Removed safeJoinArray helper function as it's no longer used


// --- API Handler ---
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId = 'unknown'; // Default userId for logging before parsing body

  try {
    const isVectorSearchAvailable = !!vectorIndex;
    const isRedisAvailable = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
    const isLlmAvailable = !!process.env.GEMINI_API_KEY;

    if (!isVectorSearchAvailable) logger.error('Vector index not initialized.');
    if (!isRedisAvailable) logger.warn('Redis not initialized.');
    if (!isLlmAvailable) logger.warn('GEMINI_API_KEY missing.');

    // Removed clientChatHistory from destructuring as it's unused
    const body = (await request.json()) as { query?: string; userId?: string; chatHistory?: ChatHistory };
    const { query: rawQuery, userId: requestUserId } = body; // Removed clientChatHistory

    userId = requestUserId || 'anonymous'; // Use provided userId or default

    if (!rawQuery || typeof rawQuery !== 'string') {
      logger.error({ userId }, 'Invalid or missing query in request body.');
      return NextResponse.json({ error: 'Invalid or missing query' }, { status: 400 });
    }
    const trimmedQuery = rawQuery.trim();
    if (trimmedQuery.length === 0) {
      logger.error({ userId }, 'Empty query received.');
      return NextResponse.json({ error: 'Query is empty' }, { status: 400 });
    }

    // Fetch session history from Redis if available
    const sessionHistory: ChatHistory = isRedisAvailable ? (await getSessionHistory(userId)) || [] : [];
    // Combine session history with the current user query for the LLM context
    const fullChatHistory: ChatHistory = [
        ...sessionHistory.map(msg => ({ role: msg.role, content: msg.content ?? msg.text ?? '' })),
        { role: 'user', content: trimmedQuery }
    ];

    // --- Cache Check ---
    let cachedRes = null;
    if (isRedisAvailable) {
      const cacheKey = generateCacheKey(userId, trimmedQuery, fullChatHistory);
      logger.info({ userId, query: trimmedQuery, cacheKey }, 'Checking cache for response.');
      cachedRes = await getCachedResponse(userId, trimmedQuery, fullChatHistory);
      if (cachedRes) {
        logger.info({ userId, query: trimmedQuery, cacheKey }, 'Cache hit.');
        // Update history in cached response to include the latest turn for session caching
        cachedRes.response.history = fullChatHistory;
        await cacheSessionHistory(userId, fullChatHistory); // Cache updated history
        const endTime = Date.now();
        logger.info({ userId, query: trimmedQuery, duration: endTime - startTime, cacheHit: true }, 'Response sent (cache hit).');
        return NextResponse.json(cachedRes.response as ChatApiResponse);
      }
      logger.info({ userId, query: trimmedQuery, cacheKey }, 'Cache miss.');
    }

    // --- LLM Processing ---
    let llmResult: LLMStructuredResponse;
    if (isLlmAvailable) {
        llmResult = await generateLLMResponse('', fullChatHistory, trimmedQuery);
        // Fallback if LLM returns empty advice
        if (!llmResult || !llmResult.advice || llmResult.advice.trim().length === 0) {
             logger.warn({ userId, query: trimmedQuery }, 'LLM returned empty or invalid advice. Using fallback.');
             // Construct a complete LLMStructuredResponse with fallback values
             llmResult = {
                is_product_query: false, search_keywords: [], product_types: [], attributes: [], vendor: null, price_filter: null, requested_product_count: 0, ai_understanding: 'LLM fallback', advice: "I'm not sure what you're looking for—could you clarify?", sort_by_price: false, usage_instructions: '', is_combo_set_query: false, is_fictional_product_query: false, is_clarification_needed: true, is_ingredient_query: false, skin_concern: [], hair_concern: [], is_price_range_query: false, response_confidence: 0.1, suggested_follow_ups: ['Can you rephrase your question?', 'Tell me more about what you need.'], is_out_of_stock_query: false, query_language: 'en', is_comparison_query: false, cache_ttl_override: 300, is_location_specific: false, user_intent_priority: 'low', alternative_product_types: [], is_feedback_request: false, contextual_clarification: '', is_subscription_query: false, is_personalized_query: false, product_application_time: [], is_promotion_query: false, user_sentiment: 'neutral', is_gift_query: [], product_packaging: [], is_educational_query: false, related_categories: [], is_urgency_indicated: false, query_complexity: 0,
             };
        }
    } else {
        // Fallback LLM result if LLM is not available
        logger.warn({ userId, query: trimmedQuery }, 'LLM not available. Using static fallback.');
         // Construct a complete LLMStructuredResponse with static fallback values
         llmResult = {
            is_product_query: false, search_keywords: [], product_types: [], attributes: [], vendor: null, price_filter: null, requested_product_count: 0, ai_understanding: 'static fallback', advice: "I'm currently unable to provide detailed beauty advice or product recommendations. Please check back later!", sort_by_price: false, usage_instructions: '', is_combo_set_query: false, is_fictional_product_query: false, is_clarification_needed: false, is_ingredient_query: false, skin_concern: [], hair_concern: [], is_price_range_query: false, response_confidence: 0, suggested_follow_ups: [], is_out_of_stock_query: false, query_language: 'en', is_comparison_query: false, cache_ttl_override: 60, is_location_specific: false, user_intent_priority: 'unavailable', alternative_product_types: [], is_feedback_request: false, contextual_clarification: '', is_subscription_query: false, is_personalized_query: false, product_application_time: [], is_promotion_query: false, user_sentiment: 'negative', is_gift_query: [], product_packaging: [], is_educational_query: false, related_categories: [], is_urgency_indicated: false, query_complexity: 0,
         };
    }


    logger.info({
      userId,
      query: trimmedQuery,
      llmResultSummary: {
        is_product_query: llmResult.is_product_query,
        search_keywords: llmResult.search_keywords,
        product_types: llmResult.product_types,
        attributes: llmResult.attributes,
        vendor: llmResult.vendor,
        price_filter: llmResult.price_filter,
        requested_product_count: llmResult.requested_product_count, // Log LLM's requested count
        skin_concern: llmResult.skin_concern,
        hair_concern: llmResult.hair_concern,
        ai_understanding: llmResult.ai_understanding,
        is_clarification_needed: llmResult.is_clarification_needed,
        is_fictional_product_query: llmResult.is_fictional_product_query,
        is_ingredient_query: llmResult.is_ingredient_query,
        product_application_time: llmResult.product_application_time,
        product_packaging: llmResult.product_packaging,
        response_confidence: llmResult.response_confidence,
      }
    }, 'LLM processing complete.');

    // --- Product Search and Filtering ---
    let finalProducts: ProductCardResponse[] = [];

    // Only perform vector search if it's available, LLM indicates a product query,
    // and it's not fictional or needs clarification, and there are keywords to search with.
    if (isVectorSearchAvailable && llmResult.is_product_query && !llmResult.is_fictional_product_query && !llmResult.is_clarification_needed && llmResult.search_keywords?.length > 0) {

      let searchKeywordsString = llmResult.search_keywords.join(' ');
       // Fallback to product types/attributes if no other keywords extracted by LLM
      if (!searchKeywordsString.trim() && ((llmResult.product_types?.length ?? 0) > 0 || (llmResult.attributes?.length ?? 0) > 0)) {
         searchKeywordsString = [...(llmResult.product_types ?? []), ...(llmResult.attributes ?? [])].join(' ');
      }

      if (searchKeywordsString.trim()) {
        logger.info({ userId, query: trimmedQuery, searchKeywords: searchKeywordsString }, 'Initiating vector search.');
        // Fetch VECTOR_FETCH_COUNT results, which is slightly more than the final limit
        const topK = VECTOR_FETCH_COUNT;
        let priceFilterString: string | undefined = undefined;
        if (llmResult.price_filter?.max_price != null && llmResult.price_filter.max_price > 0) {
          const maxPriceCents = Math.round(llmResult.price_filter.max_price * 100);
          priceFilterString = `price <= ${maxPriceCents}`;
          logger.info({ userId, query: trimmedQuery, priceFilter: priceFilterString }, 'Applying price filter.');
        }

        const results = await vectorIndex!.query({
          data: searchKeywordsString,
          topK,
          includeMetadata: true,
          filter: priceFilterString,
        }) as QueryResult<ProductVectorMetadata>[];

        // Filter out results missing essential metadata
        const filteredResults = results.filter(match =>
          match.metadata &&
          match.metadata.price != null && // Must have price
          match.metadata.title && // Must have title
          match.metadata.productUrl && // Must have URL
          match.metadata.variantId // Must have variant ID for add-to-cart
        );

        logger.info({ userId, query: trimmedQuery, rawResults: results.length, filteredResults: filteredResults.length }, 'Vector search completed.');

        if (filteredResults.length > 0) {
          logger.info({ userId, query: trimmedQuery, potentialMatches: filteredResults.length }, `Found potential product matches.`);

          const uniqueProducts = new Map<string, ProductCardResponse>();

          // Select the top products based purely on vector score (already sorted)
          // and cap at FINAL_PRODUCT_LIMIT, ensuring uniqueness by title
          for (const match of filteredResults) {
            if (uniqueProducts.size >= FINAL_PRODUCT_LIMIT) {
                logger.debug({ userId, query: trimmedQuery }, `Reached final product limit (${FINAL_PRODUCT_LIMIT}). Stopping selection.`);
                break; // Stop once we have enough unique products
            }

            const metadata = match.metadata!;
            const title = metadata.title!;
            const productKey = title.toLowerCase(); // Use lowercased title as key for uniqueness

            // Avoid adding duplicates
            if (uniqueProducts.has(productKey)) {
              logger.debug({ userId, query: trimmedQuery, product: title }, `Skipping duplicate product.`);
              continue;
            }

            // Create the ProductCardResponse object
            const productCard: ProductCardResponse = {
                title: title,
                description: metadata.textForBM25
                  ? metadata.textForBM25.substring(0, MAX_DESCRIPTION_LENGTH) +
                    (metadata.textForBM25.length > MAX_DESCRIPTION_LENGTH ? '...' : '')
                  : 'Relevant beauty product.', // Default description
                price: metadata.price ? Number(metadata.price) / 100 : 0, // Convert cents to dollars
                image: metadata.imageUrl || '/default-product.jpg', // Default image
                landing_page: metadata.productUrl,
                variantId: extractNumericIdFromGid(metadata.variantId || match.id), // Ensure variantId is string
                matches: `Vector score: ${match.score?.toFixed(4) || 'N/A'}`, // Indicate match reason is vector score
                // Safely handle availableForSale and quantityAvailable, defaulting if not boolean/number or missing
                availableForSale: typeof metadata.availableForSale === 'boolean' ? metadata.availableForSale : true, // Default to true if not boolean
                quantityAvailable: typeof metadata.quantityAvailable === 'number'
                  ? metadata.quantityAvailable
                  : (typeof metadata.availableForSale === 'boolean'
                      ? (metadata.availableForSale ? 100 : 0) // Estimate quantity if availableForSale is known
                      : 100), // Default to 100 if completely unknown or not a number
            };

            uniqueProducts.set(productKey, productCard);
            logger.debug({ userId, query: trimmedQuery, product: title, score: match.score }, `Added product to final list.`);
          }

          finalProducts = Array.from(uniqueProducts.values());

          // No additional sorting (like by price) is applied here, as the requirement is top by score.

          logger.info({ userId, query: trimmedQuery, finalProductCount: finalProducts.length }, `Final product list compiled.`);

        } else {
          logger.info({ userId, query: trimmedQuery }, `No product matches found after filtering vector results.`);
        }
      } else {
        logger.info({ userId, query: trimmedQuery }, 'No valid search keywords extracted for vector search.');
      }
    } else {
      const skipReason = !isVectorSearchAvailable ? 'Vector index unavailable' :
        !llmResult.is_product_query ? 'LLM did not identify as product query' :
        (llmResult.search_keywords?.length ?? 0) === 0 ? 'No search keywords extracted' : // Use ?? 0 for safety
        llmResult.is_fictional_product_query ? 'Query is fictional' :
        llmResult.is_clarification_needed ? 'Clarification needed' : 'Unknown reason';
      logger.info({ userId, query: trimmedQuery, skipReason }, `Skipping vector search.`);
    }

    // --- Construct Final Response ---
    // Format advice - now the advice just introduces the products, the product data is separate
    const formattedAdvice = formatChatboxResponse(
      llmResult.advice,
      finalProducts // Pass finalProducts to formatter if needed for conditional phrasing
      // Removed options argument
    );

    // Add the assistant's response (formatted advice) to the history
    fullChatHistory.push({ role: 'assistant', content: formattedAdvice });

    // Build the final API response body, ensuring all fields from ChatApiResponse are included
    const responseBody: ChatApiResponse = {
      advice: formattedAdvice,
      // Assign the first product to product_card if it's a product query and we have products
      product_card: (finalProducts.length > 0 && llmResult.is_product_query) ? finalProducts[0] : null,
      // Assign the rest to complementary_products
      complementary_products: finalProducts.length > 1 ? finalProducts.slice(1) : [],
      history: fullChatHistory, // Include the updated history
      // Include all LLM structured data in the response body, providing defaults
      is_product_query: llmResult.is_product_query ?? false,
      ai_understanding: llmResult.ai_understanding ?? 'unknown',
      is_fictional_product_query: llmResult.is_fictional_product_query ?? false,
      is_clarification_needed: llmResult.is_clarification_needed ?? false,
      search_keywords: llmResult.search_keywords ?? [],
      product_types: llmResult.product_types ?? [],
      attributes: llmResult.attributes ?? [],
      vendor: llmResult.vendor ?? null,
      price_filter: llmResult.price_filter ?? null,
      // Report the *actual* number of products returned, capped at FINAL_PRODUCT_LIMIT
      requested_product_count: finalProducts.length,
      sort_by_price: false, // Sorting by price is removed per requirement
      usage_instructions: llmResult.usage_instructions ?? '',
      is_combo_set_query: llmResult.is_combo_set_query ?? false,
      is_ingredient_query: llmResult.is_ingredient_query ?? false,
      skin_concern: llmResult.skin_concern ?? [],
      hair_concern: llmResult.hair_concern ?? [], // Ensure hair_concern is included
      is_price_range_query: llmResult.is_price_range_query ?? false,
      response_confidence: llmResult.response_confidence ?? 0.5,
      suggested_follow_ups: llmResult.suggested_follow_ups ?? [],
      is_out_of_stock_query: llmResult.is_out_of_stock_query ?? false,
      query_language: llmResult.query_language ?? 'en',
      is_comparison_query: llmResult.is_comparison_query ?? false,
      cache_ttl_override: llmResult.cache_ttl_override ?? DEFAULT_CACHE_TTL,
      is_location_specific: llmResult.is_location_specific ?? false,
      user_intent_priority: llmResult.user_intent_priority ?? 'general_info',
      alternative_product_types: llmResult.alternative_product_types ?? [],
      is_feedback_request: llmResult.is_feedback_request ?? false,
      contextual_clarification: llmResult.contextual_clarification ?? '',
      is_subscription_query: llmResult.is_subscription_query ?? false,
      is_personalized_query: llmResult.is_personalized_query ?? false,
      product_application_time: llmResult.product_application_time ?? [],
      is_promotion_query: llmResult.is_promotion_query ?? false,
      user_sentiment: llmResult.user_sentiment ?? 'neutral',
      is_gift_query: llmResult.is_gift_query ?? [],
      product_packaging: llmResult.product_packaging ?? [],
      is_educational_query: llmResult.is_educational_query ?? false,
      related_categories: llmResult.related_categories ?? [],
      is_urgency_indicated: llmResult.is_urgency_indicated ?? false,
      query_complexity: llmResult.query_complexity ?? 4,
    };

    // --- Caching and Knowledge Base Update ---
    if (isRedisAvailable) {
      await cacheResponse(userId, trimmedQuery, responseBody, fullChatHistory, responseBody.cache_ttl_override);
      await cacheSessionHistory(userId, fullChatHistory);
    }
    // Update knowledge base only for successful, non-clarification, non-fictional queries with advice
    // and if the response confidence is reasonably high.
    if (isRedisAvailable && llmResult.advice.trim().length > 0 && !llmResult.is_clarification_needed && !llmResult.is_fictional_product_query && llmResult.response_confidence > 0.4) { // Added confidence check
      await updateKnowledgebase(
        trimmedQuery,
        llmResult.advice,
        llmResult.product_types ?? [],
        llmResult.attributes ?? []
        // Note: KB entry structure is simpler, doesn't store all LLM fields like concerns
      );
    }

    const endTime = Date.now();
    logger.info({ userId, query: trimmedQuery, duration: endTime - startTime, cacheHit: false }, 'Response sent (LLM processed).');
    return NextResponse.json(responseBody);

  } catch (error: unknown) {
    const endTime = Date.now();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Attempt to log the query from the request body if available, handle potential parsing errors
    let requestQueryForLog = 'N/A';
    try {
        // Clone the request to safely read the body again for logging
        const reqClone = request.clone();
        const reqBody = await reqClone.json();
        requestQueryForLog = reqBody?.query || 'N/A';
    } catch {
        // Ignore JSON parsing error for logging purposes
    }
    logger.error({ userId, query: requestQueryForLog, error: errorMessage, stack: error instanceof Error ? error.stack : undefined, duration: endTime - startTime }, 'Internal server error during request processing.');

    // Return a user-friendly error response with a complete ChatApiResponse structure
    const errorResponse: ChatApiResponse = {
        advice: "I'm sorry, but I encountered an error trying to process your request. Please try again.",
        product_card: null,
        complementary_products: null,
        history: [], // Keep history minimal on error to avoid cascading issues
        is_product_query: false,
        ai_understanding: 'error',
        is_fictional_product_query: false,
        is_clarification_needed: false,
        search_keywords: [],
        product_types: [],
        attributes: [],
        vendor: null,
        price_filter: null,
        requested_product_count: 0,
        sort_by_price: false,
        usage_instructions: '',
        is_combo_set_query: false,
        is_ingredient_query: false,
        skin_concern: [],
        hair_concern: [], // Ensure hair_concern is included even in error response
        is_price_range_query: false,
        response_confidence: 0,
        suggested_follow_ups: ['What beauty products are you looking for?'], // Provide basic follow-ups
        is_out_of_stock_query: false,
        query_language: 'en',
        is_comparison_query: false,
        cache_ttl_override: 60, // Short cache for errors
        is_location_specific: false,
        user_intent_priority: 'error',
        alternative_product_types: [],
        is_feedback_request: false,
        contextual_clarification: 'Internal error.',
        is_subscription_query: false,
        is_personalized_query: false,
        product_application_time: [],
        is_promotion_query: false,
        user_sentiment: 'negative',
        is_gift_query: [],
        product_packaging: [],
        is_educational_query: false,
        related_categories: [],
        is_urgency_indicated: false,
        query_complexity: 0,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
