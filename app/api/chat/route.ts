import { Index } from '@upstash/vector';
import { NextResponse } from 'next/server';
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
  ProductCardResponse,
  ProductVectorMetadata,
} from '../../../lib/types';

if (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN) {
  throw new Error('Missing UPSTASH_VECTOR_REST_URL or UPSTASH_VECTOR_REST_TOKEN environment variables');
}

const vectorIndex = new Index<ProductVectorMetadata>({
  url: process.env.UPSTASH_VECTOR_REST_URL,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

const logger = pino({ level: 'info' });
const MAX_DESCRIPTION_LENGTH = 200;

function extractNumericIdFromGid(gid: string | number | undefined): string {
  if (typeof gid === 'number') return String(gid);
  if (typeof gid !== 'string' || !gid) return '';
  const parts = gid.split('/');
  return parts.pop() || gid;
}

// Helper function to format chatbox response
function formatChatboxResponse(advice: string, products: ProductCardResponse[], followUps: string[]): string {
  let response = '';

  // Add advice, preserving existing markdown and handling paragraphs
  // Replace single newlines with double newlines to create paragraphs
  response += advice.replace(/\n/g, '\n\n');

  // Add product cards if available, formatted as a bulleted list without emojis
  if (products.length > 0) {
    response += `\n\n**Recommended Products**:\n`;
    products.forEach(p => {
      response += `- **${p.title}**: ${p.description} ($${p.price})\n`;
    });
  } else if (products.length === 0 && advice.length > 0) {
    // Graceful handling if no products found but advice is available
    response += `\n\n*No specific products found for this query, but here's some general advice!*`;
  }

  // Add a pro tip section
  response += `\n\n💡 **Pro Tip**: Your skin is unique, so feel free to mix and match products from different brands to find *your* perfect routine. Test small amounts first to see what your skin loves!`;

  // Add suggested follow-ups as a bulleted list without emojis
  const finalFollowUps = followUps.length > 0 ? followUps : [
    "Ask for specific product recommendations!",
    "Looking for top brands for combination skin? Ask me for faves!",
    "Need products from Planet Beauty? Just let me know!"
  ];
  response += `\n\n **Want to dive deeper?** Try these next steps:\n${finalFollowUps.map(f => `- ${f}`).join('\n')}`;

  return response;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { query?: string; userId?: string; chatHistory?: ChatHistory };
    const { query: rawQuery, userId, chatHistory: clientChatHistory = [] } = body;

    if (!userId) {
      logger.error('Missing userId in request body');
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    if (!rawQuery || typeof rawQuery !== 'string') {
      logger.error('Invalid or missing query');
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    const trimmedQuery = rawQuery.trim();
    if (trimmedQuery.length === 0) {
      logger.error('Empty query');
      return NextResponse.json({ error: 'Query is empty' }, { status: 400 });
    }

    const cachedRes = await getCachedResponse(userId, trimmedQuery);
    if (cachedRes) {
      logger.info(`Cache hit for user ${userId} with query "${trimmedQuery}"`);
      const updatedHistory: ChatHistory = [...clientChatHistory, { role: 'user', content: trimmedQuery }];
      await cacheSessionHistory(userId, updatedHistory);
      // Return cached response directly, assuming it's already formatted
      return NextResponse.json({ ...cachedRes.response, history: updatedHistory });
    }
    logger.info(`Cache miss for user ${userId} with query "${trimmedQuery}"`);

    const fullChatHistory: ChatHistory = (await getSessionHistory(userId)) || [...clientChatHistory];

    if (!fullChatHistory.find(msg => msg.content === trimmedQuery)) {
      fullChatHistory.push({ role: 'user', content: trimmedQuery });
    }

    const llmResult = await generateLLMResponse('', fullChatHistory, trimmedQuery);

    // Handle empty advice from LLM
    if (!llmResult || !llmResult.advice || llmResult.advice.trim().length === 0) {
        logger.warn(`LLM returned empty or invalid advice for user ${userId} with query "${trimmedQuery}"`);
        llmResult.advice = "I'm not sure what you're looking for—could you clarify?";
        llmResult.suggested_follow_ups = ["Can you rephrase your question?", "Tell me more about what you need."];
    }

    let finalProducts: ProductCardResponse[] = [];
    const formattedAdvice = formatChatboxResponse(llmResult.advice, finalProducts, llmResult.suggested_follow_ups || []);
    const productType = llmResult.product_types?.[0];

    // Fetch products even if it's not strictly a product query
    if (!llmResult.is_fictional_product_query && !llmResult.is_clarification_needed) {
      // Validate and safely access llmResult fields for searchKeywordsString
      let searchKeywordsString = Array.isArray(llmResult.search_keywords) ? llmResult.search_keywords.join(' ') : '';

      if (!searchKeywordsString && Array.isArray(llmResult.product_types) && llmResult.product_types.length) {
        searchKeywordsString = [...llmResult.product_types, ...(Array.isArray(llmResult.attributes) ? llmResult.attributes : [])].join(' ');
      }

      if (searchKeywordsString.trim()) {
        logger.info(`Performing vector search for keywords: "${searchKeywordsString}"`);
        const results = await vectorIndex.query({
          data: searchKeywordsString,
          topK: llmResult.requested_product_count || 1,
          includeMetadata: true,
        }) as { id: string; metadata?: ProductVectorMetadata }[];

        const filteredResults = results.filter(match => match.metadata && match.metadata.price != null && match.metadata.title && match.metadata.productUrl);

        if (filteredResults.length > 0) {
          logger.info(`Found ${filteredResults.length} product matches for keywords: "${searchKeywordsString}"`);
          const uniqueProductTitles = new Set<string>();
          finalProducts = filteredResults.filter(match => {
            if (uniqueProductTitles.has(match.metadata!.title!)) {
              return false; // Skip duplicate product
            }
            uniqueProductTitles.add(match.metadata!.title!);
            return true; // Include unique product
          }).map(match => ({
            title: match.metadata!.title!,
            description: match.metadata!.textForBM25
              ? match.metadata!.textForBM25.substring(0, MAX_DESCRIPTION_LENGTH) +
                (match.metadata!.textForBM25.length > MAX_DESCRIPTION_LENGTH ? '...' : '')
              : 'Relevant beauty product based on your query.',
            price: match.metadata!.price ? Number(match.metadata!.price) / 100 : 0,
            image: match.metadata!.imageUrl || '/default-product.jpg',
            landing_page: match.metadata!.productUrl,
            variantId: extractNumericIdFromGid(match.metadata?.variantId || match.id),
          }));
        } else {
          logger.info(`No product matches found for keywords: "${searchKeywordsString}"`);
        }
      } else {
        logger.info('No valid search keywords generated by LLM for vector search.');
      }
    }

    const responseBody: ChatApiResponse = {
      advice: formattedAdvice,
      product_card: finalProducts.length === 1 ? finalProducts[0] : null,
      complementary_products: finalProducts.length > 1 ? finalProducts.slice(1) : [],
      history: fullChatHistory,
      is_product_query: llmResult.is_product_query,
      ai_understanding: llmResult.ai_understanding,
      is_fictional_product_query: llmResult.is_fictional_product_query,
      is_clarification_needed: llmResult.is_clarification_needed,
      search_keywords: llmResult.search_keywords,
      product_types: llmResult.product_types,
      attributes: llmResult.attributes,
      vendor: llmResult.vendor,
      price_filter: llmResult.price_filter,
      requested_product_count: llmResult.requested_product_count,
      sort_by_price: llmResult.sort_by_price,
      usage_instructions: llmResult.usage_instructions,
      is_combo_set_query: llmResult.is_combo_set_query,
      is_ingredient_query: llmResult.is_ingredient_query,
      skin_concern: llmResult.skin_concern,
      is_price_range_query: llmResult.is_price_range_query,
      response_confidence: llmResult.response_confidence,
      suggested_follow_ups: llmResult.suggested_follow_ups,
      is_out_of_stock_query: llmResult.is_out_of_stock_query,
      query_language: llmResult.query_language,
      is_comparison_query: llmResult.is_comparison_query,
      cache_ttl_override: llmResult.cache_ttl_override || 3600,
      is_location_specific: llmResult.is_location_specific,
      user_intent_priority: llmResult.user_intent_priority,
      alternative_product_types: llmResult.alternative_product_types,
      is_feedback_request: llmResult.is_feedback_request,
      contextual_clarification: llmResult.contextual_clarification,
      is_subscription_query: llmResult.is_subscription_query,
      is_personalized_query: llmResult.is_personalized_query,
      product_application_time: llmResult.product_application_time,
      is_promotion_query: llmResult.is_promotion_query,
      user_sentiment: llmResult.user_sentiment,
      is_gift_query: llmResult.is_gift_query,
      product_packaging: llmResult.product_packaging,
      is_educational_query: llmResult.is_educational_query,
      related_categories: llmResult.related_categories,
      is_urgency_indicated: llmResult.is_urgency_indicated,
      query_complexity: llmResult.query_complexity,
    };

    // Update the last assistant message in history with the formatted advice
    if (fullChatHistory.length > 0 && fullChatHistory[fullChatHistory.length - 1].role === 'assistant') {
      fullChatHistory[fullChatHistory.length - 1].content = formattedAdvice;
    } else {
      fullChatHistory.push({ role: 'bot', content: formattedAdvice });
    }

    await cacheResponse(userId, trimmedQuery, responseBody);
    await cacheSessionHistory(userId, fullChatHistory);

    // Update knowledge base with original advice, not the formatted one
    await updateKnowledgebase(
      trimmedQuery,
      llmResult.advice,
      llmResult.product_types,
      llmResult.attributes
    );

    logger.info(`Successfully processed and formatted response for user ${userId}`);
    return NextResponse.json({ ...responseBody, history: fullChatHistory });
  } catch (error) {
    logger.error(`Internal server error: ${error}`);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
