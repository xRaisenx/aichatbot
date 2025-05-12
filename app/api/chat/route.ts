// app/api/chat/route.ts
import { QueryResult, Index as VectorIndex } from '@upstash/vector';
import { NextResponse } from 'next/server';
import pino from 'pino';
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

const vectorIndex = new VectorIndex<ProductVectorMetadata>({
  url: process.env.UPSTASH_VECTOR_REST_URL || '',
  token: process.env.UPSTASH_VECTOR_TOKEN || '',
});

const logger = pino({ level: 'info' });

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
      const updatedHistoryForCache: ChatHistory = (await getSessionHistory(userId)) || [...clientChatHistory];

      const lastMessage = updatedHistoryForCache[updatedHistoryForCache.length - 1];
      if (!lastMessage || lastMessage.role !== 'user' || lastMessage.content !== trimmedQuery) {
        updatedHistoryForCache.push({ role: 'user', content: trimmedQuery });
      }
      const cachedApiResponse = cachedResponseData.response as ChatApiResponse;
      updatedHistoryForCache.push({ role: 'assistant', content: cachedApiResponse.advice });

      await cacheSessionHistory(userId, updatedHistoryForCache);
      return NextResponse.json({ ...cachedApiResponse, history: updatedHistoryForCache });
    }

    const fullChatHistory: ChatHistory = (await getSessionHistory(userId)) || [...clientChatHistory];
    const lastHistoryMessage = fullChatHistory[fullChatHistory.length - 1];
    if (!lastHistoryMessage || lastHistoryMessage.role !== 'user' || lastHistoryMessage.content !== trimmedQuery) {
      fullChatHistory.push({ role: 'user', content: trimmedQuery });
    }

    logger.info({ userId, query: trimmedQuery, chatHistoryLength: fullChatHistory.length }, 'Processing chat query.');

    const historyForLLM = fullChatHistory.slice(-10);

    const llmResult: LLMStructuredResponse = await generateLLMResponse(STATIC_BASE_PROMPT_CONTENT, historyForLLM, trimmedQuery);

    let finalProductCards: ProductCardResponse[] = [];
    let enhancedAdvice = llmResult.advice;
    let searchNote = '';

    // Skip product search for non-product queries, fictional queries, or clarification queries
    if (llmResult.is_product_query && !llmResult.is_fictional_product_query && !llmResult.is_clarification_needed) {
      logger.info({ search_keywords: llmResult.search_keywords, product_types: llmResult.product_types }, 'LLM determined it is a product query. Performing product search...');

      let searchKeywordsString = '';
      if (Array.isArray(llmResult.search_keywords) && llmResult.search_keywords.length > 0) {
        searchKeywordsString = llmResult.search_keywords.join(' ');
      } else {
        const constructedKeywords: string[] = [];
        if (Array.isArray(llmResult.product_types)) constructedKeywords.push(...llmResult.product_types);
        if (Array.isArray(llmResult.attributes)) constructedKeywords.push(...llmResult.attributes);
        searchKeywordsString = constructedKeywords.join(' ');
        logger.warn({ constructedKeywords, originalLlmKeywords: llmResult.search_keywords }, 'Constructed search keywords from product_types and attributes.');
      }

      if (vectorIndex && searchKeywordsString.trim() !== '') {
        logger.info({ searchKeywordsString, requested_product_count: llmResult.requested_product_count }, 'Performing vector query with keywords.');

        let productQueryResults: QueryResult<ProductVectorMetadata>[] = [];

        if (llmResult.is_combo_set_query && Array.isArray(llmResult.product_types) && llmResult.product_types.length > 0) {
          // Handle set/combo queries by searching for individual product types
          logger.info({ product_types: llmResult.product_types }, 'Handling combo/set query by searching for individual product types.');
          const resultsPromises = llmResult.product_types.map(type =>
            vectorIndex!.query({
              data: type, // Search for each product type
              topK: Math.ceil((llmResult.requested_product_count || 3) / llmResult.product_types.length), // Distribute requested count among types
              includeMetadata: true,
            }) as Promise<QueryResult<ProductVectorMetadata>[]>
          );
          const resultsArrays = await Promise.all(resultsPromises);
          productQueryResults = resultsArrays.flat(); // Combine results from all searches

          // Remove duplicates based on product ID
          const productIds = new Set<string>();
          productQueryResults = productQueryResults.filter(match => {
              if (match.metadata?.id && !productIds.has(match.metadata.id)) {
                  productIds.add(match.metadata.id);
                  return true;
              }
              return false;
          });


           if (llmResult.requested_product_count && productQueryResults.length > llmResult.requested_product_count) {
              productQueryResults = productQueryResults.slice(0, llmResult.requested_product_count); // Trim to requested count
           }


        } else {
          // Handle regular product queries
          const topK = llmResult.requested_product_count || 1; // Respect requested_product_count
           productQueryResults = await vectorIndex.query({
            data: searchKeywordsString,
            topK: topK,
            includeMetadata: true,
          }) as QueryResult<ProductVectorMetadata>[];
        }


        let filteredResults = productQueryResults.filter(match => match.metadata);

        if (llmResult.price_filter && llmResult.price_filter.max_price) {
          const maxPriceUSD = llmResult.price_filter.max_price;
          filteredResults = filteredResults.filter(match => {
            const priceInUSD = Number(match.metadata!.price);
            return !isNaN(priceInUSD) && priceInUSD <= maxPriceUSD;
          });
        }

        if (llmResult.attributes && llmResult.attributes.length > 0) {
          filteredResults = filteredResults.filter(match => {
            const searchableText = `${match.metadata!.title.toLowerCase()} ${match.metadata!.textForBM25?.toLowerCase() || ''} ${match.metadata!.tags?.join(' ').toLowerCase() || ''}`;
            return llmResult.attributes!.every(attr => searchableText.includes(attr.toLowerCase()));
          });
        }

        if (llmResult.sort_by_price) {
          filteredResults.sort((a, b) => Number(a.metadata!.price) - Number(b.metadata!.price));
        }

        if (filteredResults.length > 0) {
          finalProductCards = filteredResults.map(match => {
            const p = match.metadata!;
            const priceNumber = Number(p.price);
             // Use a more informative description for complementary products in a set/combo
             const reasonForMatch = llmResult.is_combo_set_query && p.productType ? `Part of a "${llmResult.ai_understanding}" set - ${p.productType}.` : 'Relevant product based on your query.';

            let finalDescription = reasonForMatch;
            if (p.textForBM25 && !llmResult.is_combo_set_query) { // Include product description for non-combo queries
                 finalDescription = p.textForBM25.substring(0, MAX_DESCRIPTION_LENGTH) + (p.textForBM25.length > MAX_DESCRIPTION_LENGTH ? '...' : '');
             } else if (llmResult.is_combo_set_query && p.productType) {
                // Keep the set/combo specific description
             } else {
                 finalDescription = 'Relevant product based on your query.'; // Fallback description
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
          logger.info({ count: finalProductCards.length, requested: llmResult.requested_product_count }, 'Products found and mapped after filtering.');
        } else {
          searchNote = `\n(No products found matching "${searchKeywordsString}". Try broadening your search!)`;
        }
      } else {
        searchNote = `\n(Product search unavailable as no effective keywords could be determined.)`;
      }
      enhancedAdvice += searchNote;
    } else {
      logger.info({ is_product_query: llmResult.is_product_query, is_fictional: llmResult.is_fictional_product_query, is_clarification_needed: llmResult.is_clarification_needed }, 'Skipping product search for non-product, fictional, or clarification query.');
    }


    fullChatHistory.push({ role: 'assistant', content: enhancedAdvice });

    const responseBody: ChatApiResponse = {
      advice: enhancedAdvice,
      product_card: llmResult.is_combo_set_query || llmResult.requested_product_count > 1 ? null : (finalProductCards.length > 0 ? finalProductCards[0] : null),
      complementary_products: llmResult.is_combo_set_query || llmResult.requested_product_count > 1 ? finalProductCards.slice(0, llmResult.requested_product_count || 10) : null,
      is_product_query: llmResult.is_product_query,
      ai_understanding: llmResult.ai_understanding,
      is_fictional_product_query: llmResult.is_fictional_product_query,
      is_clarification_needed: llmResult.is_clarification_needed,
      history: fullChatHistory,
    };

    await cacheResponse(userId, trimmedQuery, responseBody);
    await cacheSessionHistory(userId, fullChatHistory);

    if (!llmResult.is_product_query && enhancedAdvice) {
      await updateKnowledgebase(
        trimmedQuery,
        enhancedAdvice,
        llmResult.product_types,
        llmResult.attributes
      );
    }

    logger.info({ userId, query: trimmedQuery, product_card: !!responseBody.product_card, complementary_products_count: responseBody.complementary_products?.length || 0 }, 'Chat response generated.');
    return NextResponse.json(responseBody);
  } catch (error) {
    logger.error({ error }, 'Error processing chat request.');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
}