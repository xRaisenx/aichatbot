// app/api/chat/route.ts
import { QueryResult, Index as VectorIndex } from '@upstash/vector';
import { NextResponse } from 'next/server';
import { generateLLMResponse } from '../../../lib/llm';
import {
  cacheResponse,
  cacheSessionHistory,
  getCachedResponse,
  getSessionHistory,
  STATIC_BASE_PROMPT_CONTENT,
  updateKnowledgebase
} from '../../../lib/redis';
import {
  ChatApiResponse,
  ChatHistory,
  LLMStructuredResponse,
  ProductCardResponse,
  ProductVectorMetadata
} from '../../../lib/types';

// Removed unused redisClient variable

const vectorIndex = new VectorIndex<ProductVectorMetadata>({
  url: process.env.UPSTASH_VECTOR_REST_URL || '',
  token: process.env.UPSTASH_VECTOR_TOKEN || '',
});

import pino from 'pino'; // Changed from require
const logger = pino({ level: 'warn' });

const MAX_DESCRIPTION_LENGTH = 200;

function extractNumericIdFromGid(gid: string | number | undefined): string {
    if (typeof gid === 'number') return String(gid);
    if (typeof gid !== 'string' || !gid) return ''; 
    const parts = gid.split('/');
    return parts.pop() || gid;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query: rawQuery, userId, chatHistory: clientChatHistory = [] } = body;

    if (!userId) {
      logger.error('Missing userId in request body');
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    if (!rawQuery || typeof rawQuery !== 'string') {
      logger.error('Invalid or missing query in request body');
      return NextResponse.json({ error: 'Invalid or missing query' }, { status: 400 });
    }

    const trimmedQuery = rawQuery.trim();
    if (trimmedQuery.length === 0) {
      logger.error('Query is empty');
      return NextResponse.json({ error: 'Query is empty' }, { status: 400 });
    }

    const cachedResponseData = await getCachedResponse(userId, trimmedQuery);
    if (cachedResponseData) {
      logger.info({ userId, query: trimmedQuery }, 'Returning cached response.');
      let updatedHistoryForCache: ChatHistory = (await getSessionHistory(userId)) || [...clientChatHistory]; // Ensure it's a mutable copy if from client

      // Check if the last user message is the current query. If not, add it.
      const lastMessage = updatedHistoryForCache[updatedHistoryForCache.length - 1];
      if (!lastMessage || lastMessage.role !== 'user' || lastMessage.content !== trimmedQuery) {
        updatedHistoryForCache.push({ role: 'user', content: trimmedQuery });
      }
      // Add the assistant's cached response
      const cachedApiResponse = cachedResponseData.response as ChatApiResponse; // Cast to ChatApiResponse
      updatedHistoryForCache.push({ role: 'assistant', content: cachedApiResponse.advice });
      
      await cacheSessionHistory(userId, updatedHistoryForCache);
      return NextResponse.json({...cachedApiResponse, history: updatedHistoryForCache}); // Use casted object
    }

    let fullChatHistory: ChatHistory = (await getSessionHistory(userId)) || [...clientChatHistory]; // Ensure mutable copy
    // Add current user query to history if it's not already the last user message
    const lastHistoryMessage = fullChatHistory[fullChatHistory.length - 1];
    if (!lastHistoryMessage || lastHistoryMessage.role !== 'user' || lastHistoryMessage.content !== trimmedQuery) {
        fullChatHistory.push({ role: 'user', content: trimmedQuery });
    }

    logger.info({ userId, query: trimmedQuery, chatHistoryLength: fullChatHistory.length }, 'Processing chat query.');

    const historyForLLM = fullChatHistory.slice(-10); 

    const llmResult: LLMStructuredResponse = await generateLLMResponse(STATIC_BASE_PROMPT_CONTENT, historyForLLM, trimmedQuery);

    const adjustedLlmResult = { ...llmResult }; // Use const as it's not reassigned, only properties
    const isFollowUpProductQuery = fullChatHistory.slice(-4).some(msg =>
      msg.role === 'user' &&
      msg.content?.toLowerCase().match(/\b(recommend|products?|find|show|best-selling|serum|eye cream|mascara|skincare|lipstick|sunscreen|moisturizer|cleanser|toner)\b/)
    );

    if (!adjustedLlmResult.is_product_query && isFollowUpProductQuery && trimmedQuery.toLowerCase().match(/\b(retinol|hyaluronic acid|price|brand|contain|ingredients)\b/)) {
      adjustedLlmResult.is_product_query = true;
      adjustedLlmResult.ai_understanding = `follow-up product query for ${adjustedLlmResult.ai_understanding}`;
      if (!adjustedLlmResult.search_keywords?.length) {
        adjustedLlmResult.search_keywords = trimmedQuery.toLowerCase().split(/\s+/).filter(word =>
          ['serum', 'eye cream', 'mascara', 'skincare', 'lipstick', 'sunscreen', 'moisturizer', 'cleanser', 'toner', 'vegan', 'cruelty-free', 'dark circles', 'dry skin', 'oily skin'].includes(word)
        );
        if (adjustedLlmResult.search_keywords.length === 0) {
          adjustedLlmResult.search_keywords = adjustedLlmResult.product_types?.length ? adjustedLlmResult.product_types : ['product'];
        }
        logger.info({ adjustedSearchKeywords: adjustedLlmResult.search_keywords }, 'Restored search_keywords for follow-up product query.');
      }
    }

    if (adjustedLlmResult.is_product_query && (!adjustedLlmResult.search_keywords || adjustedLlmResult.search_keywords.length === 0)) {
      adjustedLlmResult.search_keywords = trimmedQuery.toLowerCase().split(/\s+/).filter(word =>
        ['serum', 'eye cream', 'mascara', 'skincare', 'lipstick', 'sunscreen', 'moisturizer', 'cleanser', 'toner', 'vegan', 'cruelty-free', 'dark circles', 'dry skin', 'oily skin', 'cheap', 'cheapest'].includes(word)
      );
      if (adjustedLlmResult.search_keywords.length === 0) {
        adjustedLlmResult.search_keywords = adjustedLlmResult.product_types?.length ? adjustedLlmResult.product_types : ['product'];
      }
      logger.warn({ searchKeywords: adjustedLlmResult.search_keywords }, 'Generated fallback search_keywords for product query.');
    }

    let finalProductCards: ProductCardResponse[] = [];
    let enhancedAdvice = adjustedLlmResult.advice;
    let searchNote = '';

    if (adjustedLlmResult.is_product_query) {
      logger.info('LLM determined it is a product query. Performing product search...');

      let searchKeywordsString = "";
      if (Array.isArray(adjustedLlmResult.search_keywords) && adjustedLlmResult.search_keywords.length > 0) {
        searchKeywordsString = adjustedLlmResult.search_keywords.join(" ");
      } else {
        const constructedKeywords: string[] = [];
        if (Array.isArray(adjustedLlmResult.product_types)) constructedKeywords.push(...adjustedLlmResult.product_types);
        if (Array.isArray(adjustedLlmResult.attributes)) constructedKeywords.push(...adjustedLlmResult.attributes);
        searchKeywordsString = constructedKeywords.join(" ");
        logger.warn({ constructedKeywords, originalLlmKeywords: adjustedLlmResult.search_keywords }, 'Constructed search keywords from product_types and attributes.');
      }

      if (vectorIndex && searchKeywordsString.trim() !== '') {
        logger.info({ searchKeywordsString }, 'Performing vector query with keywords.');
        const productQueryResults = await vectorIndex.query({
          data: searchKeywordsString,
          topK: Math.max(3, (adjustedLlmResult.requested_product_count || 1) * 2 + 5),
          includeMetadata: true,
        }) as QueryResult<ProductVectorMetadata>[]; 

        let filteredResults = productQueryResults.filter(match => match.metadata);

        if (adjustedLlmResult.price_filter && adjustedLlmResult.price_filter.max_price) {
          const maxPriceUSD = adjustedLlmResult.price_filter.max_price;
          filteredResults = filteredResults.filter(match => {
            const priceInUSD = Number(match.metadata!.price);
            return !isNaN(priceInUSD) && priceInUSD <= maxPriceUSD;
          });
        }

        if (adjustedLlmResult.attributes && adjustedLlmResult.attributes.length > 0) {
          filteredResults = filteredResults.filter(match => {
            const searchableText = `${match.metadata!.title.toLowerCase()} ${match.metadata!.textForBM25?.toLowerCase() || ''} ${match.metadata!.tags?.join(' ').toLowerCase() || ''}`;
            return adjustedLlmResult.attributes!.every(attr => searchableText.includes(attr.toLowerCase()));
          });
        }

        if (adjustedLlmResult.sort_by_price) {
          filteredResults.sort((a, b) => Number(a.metadata!.price) - Number(b.metadata!.price));
        }

        if (filteredResults.length > 0) {
          finalProductCards = filteredResults.map(match => {
            const p = match.metadata!;
            const priceNumber = Number(p.price);
            const reasonForMatch = adjustedLlmResult.product_matches?.find(pm => pm.variantId === extractNumericIdFromGid(p.variantId || p.id || match.id))?.reasoning
              || 'Relevant product based on your query.';
            let finalDescription = reasonForMatch;
            if (finalDescription.length > MAX_DESCRIPTION_LENGTH) {
              finalDescription = finalDescription.substring(0, MAX_DESCRIPTION_LENGTH) + '...';
            }
            return {
              title: p.title,
              description: finalDescription,
              price: !isNaN(priceNumber) ? parseFloat(priceNumber.toFixed(2)) : 0,
              image: p.imageUrl,
              landing_page: p.productUrl,
              variantId: extractNumericIdFromGid(p.variantId || p.id || match.id),
            };
          });
          logger.info({ count: finalProductCards.length, requested: adjustedLlmResult.requested_product_count }, 'Products found and mapped after filtering.');
        } else {
          searchNote = `\n(No products found matching "${searchKeywordsString}". Try broadening your search!)`;
        }
      } else {
        searchNote = `\n(Product search unavailable as no effective keywords could be determined.)`;
      }
      enhancedAdvice += searchNote;
    }
    
    fullChatHistory.push({ role: 'assistant', content: enhancedAdvice });

    const responseBody: ChatApiResponse = { 
      advice: enhancedAdvice,
      product_card: finalProductCards.length > 0 && adjustedLlmResult.requested_product_count === 1 ? finalProductCards[0] : undefined,
      complementary_products: finalProductCards.length > 0 && adjustedLlmResult.requested_product_count !== 1 ? finalProductCards.slice(0, adjustedLlmResult.requested_product_count || 10) : undefined,
      ai_understanding: adjustedLlmResult.ai_understanding,
      history: fullChatHistory, 
    };

    await cacheResponse(userId, trimmedQuery, responseBody);
    await cacheSessionHistory(userId, fullChatHistory); 

    if (adjustedLlmResult.is_product_query && finalProductCards.length === 0 && !searchNote.includes("No products found")) {
      // This logic can be refined.
    } else if (!adjustedLlmResult.is_product_query && enhancedAdvice) {
       await updateKnowledgebase(
        trimmedQuery,
        enhancedAdvice, 
        adjustedLlmResult.product_types,
        adjustedLlmResult.attributes
      );
    }

    logger.info({ userId, query: trimmedQuery }, 'Chat response generated.');
    return NextResponse.json(responseBody);
  } catch (error) {
    logger.error({ error }, 'Error processing chat request.');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
}
