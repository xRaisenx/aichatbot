// lib/llm.ts

import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import pino from 'pino';
import { getKnowledgebaseEntry } from './redis';
import { ChatHistory, LLMStructuredResponse } from './types';

const logger = pino({ level: 'warn' });

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY must be set for Gemini provider');
}

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const model = genAI ? genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ],
}) : null;

const fictionalTerms = ['unobtainium', 'unicorn', 'dragon', 'stardust', 'mythril', 'elixir', 'phoenix'];

const isPotentiallyFictional = (query: string): boolean => {
  const queryLower = query.toLowerCase();
  return fictionalTerms.some(term => queryLower.includes(term)) || queryLower.includes('planet beauty brand');
};

const extractPriceFilter = (query: string): { max_price: number; currency: string } | null => {
  const rangeMatch = query.toLowerCase().match(/between\s*\$?(\d+(\.\d+)?)\s*and\s*\$?(\d+(\.\d+)?)/);
  if (rangeMatch) {
      return { max_price: parseFloat(rangeMatch[3]), currency: 'USD' };
  }
  const maxMatch = query.toLowerCase().match(/(under|below|less than|around|about)\s*\$?(\d+(\.\d+)?)/);
  if (maxMatch) {
    return { max_price: parseFloat(maxMatch[2]), currency: 'USD' };
  }
   const exactMatch = query.toLowerCase().match(/for\s*\$?(\d+(\.\d+)?)/);
   if (exactMatch) {
       return { max_price: parseFloat(exactMatch[1]), currency: 'USD' };
   }
  return null;
};

const isFollowUpClarification = (query: string, chatHistory: ChatHistory): boolean => {
  const queryLower = query.toLowerCase();
  const recentProductQuery = chatHistory.slice(-4).some(msg =>
      (msg.role === 'user' || msg.role === 'assistant') &&
      (msg.content ?? msg.text ?? '').toLowerCase().match(
        /\b(recommend|products?|find|show|best-selling|serum|eye cream|mascara|skincare|lipstick|sunscreen|cleanser|toner|shampoo|conditioner|lotion|mask|palette|brush|tool)\b/
      )
    );

  return (
    Boolean(queryLower.match(/\b(part of|is that|does it|are they|which one|how about|tell me more)\b/)) &&
    recentProductQuery
  );
};

const impliesProductList = (query: string): boolean => {
  const lowerQuery = query.toLowerCase();
  return /show me|any good|what are|recommend some|list of|multiple|several|a few|different options/.test(lowerQuery);
};

interface QueryMetadata {
  intent: string;
  fields: Partial<LLMStructuredResponse>;
  complexity: number;
}

async function preprocessQuery(query: string, chatHistory: ChatHistory): Promise<QueryMetadata> {
  const normalizedQuery = query.trim().toLowerCase();

  const productTypeRegex = /\b(lipstick|moisturizer|serum|sunscreen|mascara|cleanser|toner|shampoo|conditioner|lotion|mask|treatment|oil|balm|cream|gel|powder|spray|set|kit|palette|brush|tool|fragrance|perfume|cologne|scrub|exfoliator|eyeliner|eyeshadow|blush|bronzer|highlighter|primer|foundation|concealer|lip gloss|lip liner|hair mask|hair oil|dry shampoo|leave-in conditioner|hair serum|body wash|hand cream|foot cream|nail polish|bath bomb)\b/i;
  const productTypeMatches = normalizedQuery.match(productTypeRegex);

  const attributeRegex = /\b(vegan|cruelty-free|paraben-free|sulfate-free|fragrance-free|oil-free|non-comedogenic|matte|glossy|satin|sheer|waterproof|long-lasting|hydrating|brightening|anti-aging|volumizing|smoothing|strengthening|color-safe|travel-size|eco-friendly|refillable)\b/i;
  const attributeMatches = normalizedQuery.match(attributeRegex);

  const skinConcernRegex = /\b(dry skin|oily skin|sensitive skin|redness|acne|combination skin|dark circles|fine lines|wrinkles|dullness|uneven tone|texture)\b/i;
  const skinConcernMatches = normalizedQuery.match(skinConcernRegex);

  const hairConcernRegex = /\b(damaged hair|dry hair|oily hair|color-treated hair|frizzy hair|thinning hair|hair loss|dandruff|curly hair|straight hair|fine hair|thick hair)\b/i;
  const hairConcernMatches = normalizedQuery.match(hairConcernRegex);


  const complexity = normalizedQuery.split(' ').length > 5 || /and|for|under|between|with/i.test(normalizedQuery) ? 5 : 3;

  const isFictional = isPotentiallyFictional(normalizedQuery);
  const isClarification = isFollowUpClarification(normalizedQuery, chatHistory);
  const impliesList = impliesProductList(normalizedQuery);
  const priceFilter = extractPriceFilter(normalizedQuery);

  // --- Calculate requested_product_count first ---
  let requestedCount = 0;
  const topXMatch = normalizedQuery.match(/(top|best|show)\s*(\d+)/i); // Include "show X" in count extraction
  if (topXMatch && topXMatch[2]) {
      const parsedCount = parseInt(topXMatch[2]);
      if (!isNaN(parsedCount) && parsedCount > 0) {
          requestedCount = parsedCount;
      }
  } else if (impliesList) {
      requestedCount = 5; // Default for list queries without a specific number
  } else if (productTypeMatches || attributeMatches || skinConcernMatches || hairConcernMatches || priceFilter) {
      requestedCount = 3; // Default for specific product queries without a count
  }

  // Ensure requested count is at least 1 if it seems like a product query
   if (requestedCount === 0 && (productTypeMatches || attributeMatches || skinConcernMatches || hairConcernMatches || priceFilter || impliesList)) {
       requestedCount = 1;
   }


  // --- Determine is_product_query based on extracted info ---
  // It's a product query if it implies a list, mentions product types/attributes/concerns,
  // has a price filter, or we successfully extracted a requested count > 0.
  const isProductQuery = impliesList || productTypeMatches !== null || attributeMatches !== null ||
                         skinConcernMatches !== null || hairConcernMatches !== null ||
                         priceFilter !== null || requestedCount > 0;


  let intent = isProductQuery ? 'product_search' : 'general_info';
  if (isFictional) intent = 'nonsense';
  if (isClarification) intent = 'clarification';
  if (priceFilter) intent = 'price_query';


  const fields: Partial<LLMStructuredResponse> = {
    is_product_query: isProductQuery && !isFictional && !isClarification, // Final flag considers fictional/clarification
    search_keywords: [], // Will populate below
    product_types: productTypeMatches ? Array.from(new Set(productTypeMatches.map(p => p.toLowerCase()))) : [],
    attributes: attributeMatches ? Array.from(new Set(attributeMatches.map(a => a.toLowerCase()))) : [],
    vendor: null, // Will try to get this from LLM sub-call
    price_filter: priceFilter,
    requested_product_count: requestedCount, // Use the calculated count
    ai_understanding: intent,
    sort_by_price: /cheap|cheapest|low to high/i.test(normalizedQuery),
    usage_instructions: '',
    is_combo_set_query: /set|kit|combo/i.test(normalizedQuery),
    is_fictional_product_query: isFictional,
    is_clarification_needed: isClarification,
    is_ingredient_query: /\b(retinol|hyaluronic acid|ceramides|vitamin c|niacinamide|salicylic acid|glycolic acid|peptide|aha|bha)\b/i.test(normalizedQuery),
    skin_concern: skinConcernMatches ? Array.from(new Set(skinConcernMatches.map(c => c.toLowerCase()))) : [],
    hair_concern: hairConcernMatches ? Array.from(new Set(hairConcernMatches.map(c => c.toLowerCase()))) : [],
    is_price_range_query: /between\s*\$?(\d+(\.\d+)?)\s*and\s*\$?(\d+(\.\d+)?)/i.test(normalizedQuery),
    response_confidence: isFictional ? 0.3 : isClarification ? 0.7 : (isProductQuery ? 0.9 : 0.5),
    suggested_follow_ups: [],
    is_out_of_stock_query: /in stock|available/i.test(normalizedQuery),
    query_language: 'en',
    is_comparison_query: /vs|compare|or/i.test(normalizedQuery),
    cache_ttl_override: isProductQuery ? 3600 : 300,
    is_location_specific: /tropical|nyc|humid|dry climate|location/i.test(normalizedQuery),
    user_intent_priority: intent,
    alternative_product_types: [],
    is_feedback_request: /review|feedback|how did i do/i.test(normalizedQuery),
    contextual_clarification: isClarification ? 'Please specify the product or brand.' : '',
    is_subscription_query: /subscription|monthly/i.test(normalizedQuery),
    is_personalized_query: /my skin|for me|my hair/i.test(normalizedQuery),
    product_application_time: normalizedQuery.match(/\b(morning|night|daily|am|pm)\b/i)?.map(t => t.toLowerCase()) || [],
    is_promotion_query: /sale|discount|promo|deal|clearance/i.test(normalizedQuery),
    user_sentiment: /love|hate|best|worst|great|bad|help|urgent|quickly|now/i.test(normalizedQuery) ? (/\b(hate|worst|bad)\b/i.test(normalizedQuery) ? 'negative' : /\b(love|best|great|urgent|quickly|now|help)\b/i.test(normalizedQuery) ? 'positive' : 'neutral') : 'neutral',
    is_gift_query: /gift|present|for him|for her|for them/i.test(normalizedQuery) ? ['gift'] : [],
    product_packaging: normalizedQuery.match(/\b(travel-size|eco-friendly|refillable|pump|tube|jar|bottle)\b/i)?.map(p => p.toLowerCase()) || [],
    is_educational_query: /how to|what is|explain|guide|tutorial/i.test(normalizedQuery),
    related_categories: [],
    is_urgency_indicated: /urgent|quickly|now/i.test(normalizedQuery),
  };

  // Add extracted terms to search keywords, ensuring they are arrays
  fields.search_keywords = [
      ...(fields.product_types || []),
      ...(fields.attributes || []),
      ...(fields.skin_concern || []),
      ...(fields.hair_concern || []),
      ...(fields.product_application_time || []),
      ...(fields.product_packaging || []),
  ];

  // Use AI to recognize brand names dynamically and add to keywords/vendor
  const aiRecognizedBrand = await getBrandRecognitionPrompt(normalizedQuery);
  if (aiRecognizedBrand) {
    const brandName = aiRecognizedBrand.toLowerCase();
    fields.search_keywords.push(brandName);
    fields.vendor = brandName;
  }

  // Add other potential keywords from the query (simple split, filter out common words)
  const stopWords = new Set(['a', 'an', 'the', 'for', 'with', 'and', 'or', 'in', 'on', 'is', 'that', 'me', 'some', 'good', 'any', 'what', 'are', 'of', 'list', 'under', 'below', 'less', 'than', 'around', 'about', 'between', 'vs', 'compare', 'how', 'to', 'what', 'is', 'explain', 'my', 'skin', 'for', 'me', 'now', 'urgent', 'quickly', 'present', 'tell', 'more', 'different', 'options', 'show']); // Added 'show' to stop words
  const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 2 && !stopWords.has(word) && !productTypeRegex.test(word) && !attributeRegex.test(word) && !skinConcernRegex.test(word) && !hairConcernRegex.test(word));
  fields.search_keywords = [...new Set([...fields.search_keywords, ...queryWords])];

  fields.query_complexity = normalizedQuery.split(' ').length;

  return { intent, fields, complexity };
}

async function getConversationalAdvice(query: string, metadata: QueryMetadata, chatHistory: ChatHistory): Promise<string> {
  if (!model) {
      logger.error('Gemini model not initialized due to missing API key.');
      return "I'm sorry, I can't provide advice right now. My service is not configured correctly.";
  }

  try {
    const historyPrompt = chatHistory.map(msg => `${msg.role}: ${msg.content ?? msg.text}`).join('\n');
    const metadataPrompt = `\n\nQuery Analysis:\nIntent: ${metadata.intent}\nUnderstanding: ${metadata.fields.ai_understanding}\nProduct Types: ${(metadata.fields.product_types || []).join(', ')}\nAttributes: ${(metadata.fields.attributes || []).join(', ')}\nSkin Concern: ${(metadata.fields.skin_concern || []).join(', ')}\nHair Concern: ${(metadata.fields.hair_concern || []).join(', ')}\nPrice Filter: ${metadata.fields.price_filter ? `Under $${metadata.fields.price_filter.max_price}` : 'None'}\nRequested Count: ${metadata.fields.requested_product_count}`; // Added Requested Count

    const prompt = `You are a friendly and helpful beauty assistant for Planet Beauty. Based on the user's query and the conversation history, provide concise, conversational beauty advice. Avoid technical jargon unless necessary. If products are likely to be recommended, frame the advice to lead into product suggestions. If the query is very specific (e.g., asking for a single product or brand), acknowledge that. If the query is broad, offer to help narrow it down.

Conversation History:
${historyPrompt}

User Query: "${query}"
${metadataPrompt}

Your Advice:`;

    const result = await model.generateContent(prompt);
    const advice = result.response.text()?.trim();

    if (!advice) {
         logger.warn({ query }, 'Gemini returned empty advice text.');
         return 'I’m not sure how to respond to that. Could you try rephrasing?';
    }

    return advice;

  } catch (err) {
    logger.warn({ err, query }, 'Failed to get Gemini advice, using fallback');
    return metadata.fields.ai_understanding === 'greeting'
      ? 'Hey there! What beauty adventure awaits us today?'
      : metadata.fields.is_fictional_product_query
        ? `${query} sounds mythical! Let's find real-world alternatives.`
        : metadata.fields.is_clarification_needed
          ? 'Can you clarify which product you’re referring to?'
          : 'Let’s find what you need!';
  }
}

async function getBrandRecognitionPrompt(query: string): Promise<string | null> {
   if (!model) {
      logger.error('Gemini model not initialized for brand recognition.');
      return null;
   }
  try {
    const prompt = `Analyze the following beauty query and identify any specific brand names mentioned that Planet Beauty might carry.
Query: "${query}"

If no specific brands are mentioned, respond with "none".
If brands are mentioned, list only the brand names, separated by commas if more than one. Focus on well-known beauty brands.
Example: "serum from The Ordinary or CeraVe" -> "The Ordinary, CeraVe"
Example: "best sunscreen" -> "none"
Example: "La Roche-Posay moisturizer" -> "La Roche-Posay"
Example: "Pureology shampoo for damaged hair" -> "Pureology"
Example: "show me 4 Pureology products" -> "Pureology" // Added example

Brand names found:`;

    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();

    if (!response || response.toLowerCase() === 'none') {
        return null;
    }

    const brands = response.split(',').map(b => b.trim()).filter(b => b.length > 0);
    return brands.length > 0 ? brands[0] : null; // Return the first recognized brand

  } catch (err) {
    logger.warn({ err, query }, 'Failed to get brand recognition prompt');
    return null;
  }
}

export async function generateLLMResponse(
  systemPrompt: string,
  chatHistory: ChatHistory,
  userQuery: string
): Promise<LLMStructuredResponse> {
  if (!userQuery.trim()) {
    return {
      is_product_query: false, search_keywords: [], product_types: [], attributes: [], vendor: null, price_filter: null, requested_product_count: 0, ai_understanding: 'empty query', advice: 'Please provide a query to get started!', sort_by_price: false, usage_instructions: '', is_combo_set_query: false, is_fictional_product_query: false, is_clarification_needed: true, is_ingredient_query: false, skin_concern: [], hair_concern: [], is_price_range_query: false, response_confidence: 0.1, suggested_follow_ups: ['What beauty products are you looking for?'], is_out_of_stock_query: false, query_language: 'en', is_comparison_query: false, cache_ttl_override: 300, is_location_specific: false, user_intent_priority: 'low', alternative_product_types: [], is_feedback_request: false, contextual_clarification: 'Empty query received.', is_subscription_query: false, is_personalized_query: false, product_application_time: [], is_promotion_query: false, user_sentiment: 'neutral', is_gift_query: [], product_packaging: [], is_educational_query: false, related_categories: [], is_urgency_indicated: false, query_complexity: 0,
    };
  }

  const metadata = await preprocessQuery(userQuery, chatHistory);

  const kbEntry = await getKnowledgebaseEntry(userQuery);

  if (kbEntry && kbEntry.confidence > 0.7) {
    logger.info({ query: userQuery }, 'Using cached knowledgebase entry');
    // Construct the response explicitly, merging KB data with preprocessed metadata
    const response: LLMStructuredResponse = {
      // Start with preprocessed metadata fields, providing defaults for safety
      is_product_query: metadata.fields.is_product_query ?? false,
      search_keywords: metadata.fields.search_keywords ?? [],
      product_types: metadata.fields.product_types ?? [],
      attributes: metadata.fields.attributes ?? [],
      vendor: metadata.fields.vendor ?? null,
      price_filter: metadata.fields.price_filter ?? null,
      requested_product_count: metadata.fields.requested_product_count ?? 0,
      ai_understanding: metadata.fields.ai_understanding ?? 'knowledgebase hit',
      advice: kbEntry.answer, // Override advice with KB answer
      sort_by_price: metadata.fields.sort_by_price ?? false,
      usage_instructions: metadata.fields.usage_instructions ?? '',
      is_combo_set_query: metadata.fields.is_combo_set_query ?? false,
      is_fictional_product_query: metadata.fields.is_fictional_product_query ?? false,
      is_clarification_needed: metadata.fields.is_clarification_needed ?? false,
      is_ingredient_query: metadata.fields.is_ingredient_query ?? false,
      skin_concern: metadata.fields.skin_concern ?? [],
      hair_concern: metadata.fields.hair_concern ?? [],
      is_price_range_query: metadata.fields.is_price_range_query ?? false,
      response_confidence: kbEntry.confidence, // Use KB confidence
      suggested_follow_ups: metadata.fields.suggested_follow_ups ?? [],
      is_out_of_stock_query: metadata.fields.is_out_of_stock_query ?? false,
      query_language: metadata.fields.query_language ?? 'en',
      is_comparison_query: metadata.fields.is_comparison_query ?? false,
      cache_ttl_override: metadata.fields.cache_ttl_override ?? 3600,
      is_location_specific: metadata.fields.is_location_specific ?? false,
      user_intent_priority: metadata.fields.user_intent_priority ?? 'general_info',
      alternative_product_types: metadata.fields.alternative_product_types ?? [],
      is_feedback_request: metadata.fields.is_feedback_request ?? false,
      contextual_clarification: metadata.fields.contextual_clarification ?? '',
      is_subscription_query: metadata.fields.is_subscription_query ?? false,
      is_personalized_query: metadata.fields.is_personalized_query ?? false,
      product_application_time: metadata.fields.product_application_time ?? [],
      is_promotion_query: metadata.fields.is_promotion_query ?? false,
      user_sentiment: metadata.fields.user_sentiment ?? 'neutral',
      is_gift_query: metadata.fields.is_gift_query ?? [],
      product_packaging: metadata.fields.product_packaging ?? [],
      is_educational_query: metadata.fields.is_educational_query ?? false,
      related_categories: metadata.fields.related_categories ?? [],
      is_urgency_indicated: metadata.fields.is_urgency_indicated ?? false,
      query_complexity: metadata.complexity ?? 0,
    };
    return response;
  }

  const advice = await getConversationalAdvice(userQuery, metadata, chatHistory);

  // Construct the final structured response explicitly
  const response: LLMStructuredResponse = {
    // Start with preprocessed metadata fields, providing defaults for safety
    is_product_query: metadata.fields.is_product_query ?? false,
    search_keywords: metadata.fields.search_keywords ?? [],
    product_types: metadata.fields.product_types ?? [],
    attributes: metadata.fields.attributes ?? [],
    vendor: metadata.fields.vendor ?? null,
    price_filter: metadata.fields.price_filter ?? null,
    requested_product_count: metadata.fields.requested_product_count ?? 0,
    ai_understanding: metadata.fields.ai_understanding ?? 'general question',
    advice: advice, // Add the generated advice
    sort_by_price: metadata.fields.sort_by_price ?? false,
    usage_instructions: metadata.fields.usage_instructions ?? '',
    is_combo_set_query: metadata.fields.is_combo_set_query ?? false,
    is_fictional_product_query: metadata.fields.is_fictional_product_query ?? false,
    is_clarification_needed: metadata.fields.is_clarification_needed ?? false,
    is_ingredient_query: metadata.fields.is_ingredient_query ?? false,
    skin_concern: metadata.fields.skin_concern ?? [],
    hair_concern: metadata.fields.hair_concern ?? [],
    is_price_range_query: metadata.fields.is_price_range_query ?? false,
    response_confidence: metadata.fields.response_confidence ?? 0.5,
    suggested_follow_ups: metadata.fields.suggested_follow_ups ?? [],
    is_out_of_stock_query: metadata.fields.is_out_of_stock_query ?? false,
    query_language: metadata.fields.query_language ?? 'en',
    is_comparison_query: metadata.fields.is_comparison_query ?? false,
    cache_ttl_override: metadata.fields.cache_ttl_override ?? 3600,
    is_location_specific: metadata.fields.is_location_specific ?? false,
    user_intent_priority: metadata.fields.user_intent_priority ?? 'general_info',
    alternative_product_types: metadata.fields.alternative_product_types ?? [],
    is_feedback_request: metadata.fields.is_feedback_request ?? false,
    contextual_clarification: metadata.fields.contextual_clarification ?? '',
    is_subscription_query: metadata.fields.is_subscription_query ?? false,
    is_personalized_query: metadata.fields.is_personalized_query ?? false,
    product_application_time: metadata.fields.product_application_time ?? [],
    is_promotion_query: metadata.fields.is_promotion_query ?? false,
    user_sentiment: metadata.fields.user_sentiment ?? 'neutral',
    is_gift_query: metadata.fields.is_gift_query ?? [],
    product_packaging: metadata.fields.product_packaging ?? [],
    is_educational_query: metadata.fields.is_educational_query ?? false,
    related_categories: metadata.fields.related_categories ?? [],
    is_urgency_indicated: metadata.fields.is_urgency_indicated ?? false,
    query_complexity: metadata.complexity ?? 0,
  };

  return response;
}