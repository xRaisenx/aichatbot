// lib/llm.ts
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import pino from 'pino';
import { getKnowledgebaseEntry } from './redis';
import { ChatHistory, LLMStructuredResponse } from './types';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment variables.');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ],
});

const logger = pino({ level: 'warn' });

// Helper functions
const fictionalTerms = ['unobtainium', 'unicorn', 'dragon', 'stardust', 'mythril', 'elixir', 'phoenix'];

const isPotentiallyFictional = (query: string): boolean => {
  const queryLower = query.toLowerCase();
  return fictionalTerms.some(term => queryLower.includes(term)) || queryLower.includes('planet beauty brand');
};

const extractPriceFilter = (query: string): { max_price: number; currency: string } | null => {
  const priceMatch = query.toLowerCase().match(/(under|below|less than|around|about)\s*\$?(\d+(\.\d+)?)/);
  if (priceMatch) {
    return { max_price: parseFloat(priceMatch[2]), currency: 'USD' };
  }
  return null;
};

const isFollowUpClarification = (query: string, chatHistory: ChatHistory): boolean => {
  const queryLower = query.toLowerCase();
  return (queryLower.match(/\b(part of a kit|is that|does it|are they)\b/) !== null) &&
         chatHistory.slice(-4).some(msg =>
           msg.role === 'user' &&
           msg.content?.toLowerCase().match(/\b(recommend|products?|find|show|best-selling|serum|eye cream|mascara|skincare|lipstick|sunscreen|moisturizer|cleanser|toner)\b/)
         );
};

const impliesProductList = (query: string): boolean => {
  const lowerQuery = query.toLowerCase();
  return lowerQuery.includes('show me') ||
         lowerQuery.includes('any good') ||
         lowerQuery.includes('what are') ||
         lowerQuery.includes('recommend some') ||
         lowerQuery.includes('list of');
};

function formatChatHistoryForGemini(
  chatHistory: ChatHistory,
  systemPrompt: string,
  userQuery: string
): { role: string; parts: { text: string }[] }[] {
  const geminiHistory: { role: string; parts: { text: string }[] }[] = [];
  let nextSystemMessages: string[] = [];

  for (const message of chatHistory) {
    if (message.role === 'system' && message.content) {
      nextSystemMessages.push(message.content);
    } else if (message.content || message.text) {
      let currentMessageContent = nextSystemMessages.length > 0 ? nextSystemMessages.join('\n') + '\n' : '';
      currentMessageContent += message.content || message.text || '';
      const currentRole = message.role === 'model' || message.role === 'assistant' ? 'model' : 'user';
      geminiHistory.push({
        role: currentRole,
        parts: [{ text: currentMessageContent }],
      });
      nextSystemMessages = [];
    }
  }

  let finalUserMessageContent = nextSystemMessages.length > 0 ? nextSystemMessages.join('\n') + '\n' : '';
  finalUserMessageContent += `${systemPrompt}\n\nUser Query: "${userQuery}"\n\nPlease provide your response as a single JSON object with fields: is_product_query, search_keywords, product_types, attributes, vendor, price_filter, requested_product_count, ai_understanding, advice, sort_by_price, usage_instructions, is_combo_set_query, is_fictional_product_query, is_clarification_needed. Ensure the JSON is valid and properly formatted.`;
  geminiHistory.push({
    role: 'user',
    parts: [{ text: finalUserMessageContent }],
  });

  const strictlyAlternatingHistory: { role: string; parts: { text: string }[] }[] = [];
  if (geminiHistory.length > 1) {
    const historyToClean = geminiHistory.slice(0, -1);
    let lastPushedRole: string | null = null;
    let startIndex = 0;
    if (historyToClean.length > 0 && historyToClean[0].role === 'model') {
      logger.warn('History starts with "model", attempting to find first "user" message.');
      startIndex = historyToClean.findIndex(m => m.role === 'user');
      if (startIndex === -1) {
        logger.warn('No "user" message found. Clearing history.');
        startIndex = historyToClean.length;
      }
    }
    for (let i = startIndex; i < historyToClean.length; i++) {
      const msg = historyToClean[i];
      if (msg.role !== lastPushedRole) {
        strictlyAlternatingHistory.push(msg);
        lastPushedRole = msg.role;
      } else {
        logger.warn(`Skipping message due to non-alternating role: ${JSON.stringify(msg)}`);
      }
    }
  }
  strictlyAlternatingHistory.push(geminiHistory[geminiHistory.length - 1]);
  return strictlyAlternatingHistory;
}

export async function generateLLMResponse(
  systemPrompt: string,
  chatHistory: ChatHistory,
  userQuery: string
): Promise<LLMStructuredResponse> {
  logger.info({ query: userQuery }, 'Generating LLM response with Gemini.');

  const kbEntry = await getKnowledgebaseEntry(userQuery);
  if (kbEntry && kbEntry.confidence > 0.7) {
    logger.info({ query: userQuery }, 'Using knowledgebase entry instead of LLM.');
    return {
      is_product_query: !!kbEntry.productTypes?.length,
      search_keywords: kbEntry.keywords,
      product_types: kbEntry.productTypes || [],
      attributes: kbEntry.attributes || [],
      vendor: null,
      price_filter: extractPriceFilter(userQuery),
      requested_product_count: kbEntry.productTypes?.length ? (kbEntry.productTypes.length > 1 ? kbEntry.productTypes.length : 1) : 1,
      ai_understanding: `from knowledgebase: ${kbEntry.query}`,
      advice: kbEntry.answer,
      sort_by_price: kbEntry.keywords.includes('cheap') || kbEntry.keywords.includes('cheapest'),
      usage_instructions: kbEntry.productTypes?.includes('serum') ? 'Apply to clean skin before moisturizer.' :
                          kbEntry.productTypes?.includes('eye cream') ? 'Apply a pea-sized amount under eyes nightly.' : '',
      is_combo_set_query: kbEntry.keywords.includes('set') || kbEntry.keywords.includes('combo'),
      is_fictional_product_query: isPotentiallyFictional(userQuery),
      is_clarification_needed: false,
    };
  }

  const isFictional = false;
  const isClarification = false;

  try {
    const fullFormattedHistory = formatChatHistoryForGemini(chatHistory, systemPrompt, userQuery);
    const historyForStartChat = fullFormattedHistory.slice(0, -1);
    const currentUserMessageParts = fullFormattedHistory[fullFormattedHistory.length - 1]?.parts;

    if (!currentUserMessageParts) {
      throw new Error('Could not construct current user message for Gemini.');
    }

    const chat = model.startChat({ history: historyForStartChat });
    const result = await chat.sendMessage(currentUserMessageParts);
    const responseText = result.response.text().trim();

    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const jsonMatch = responseText.match(jsonRegex);
    const jsonString = jsonMatch && jsonMatch[1] ? jsonMatch[1] : responseText;

    let parsedResponse: Partial<LLMStructuredResponse>;
    try {
      parsedResponse = JSON.parse(jsonString);
    } catch (parseError) {
      logger.warn({ error: parseError, jsonString }, 'Initial JSON.parse failed. Attempting to fix JSON string.');
      try {
        const fixedJsonString = jsonString
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/\\n/g, '\\\\n')
          .replace(/(?<!\\)"/g, '\\"')
          .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');
        parsedResponse = JSON.parse(fixedJsonString);
      } catch (retryParseError) {
        logger.error({ error: retryParseError, jsonString }, 'Failed to parse LLM JSON response.');

        let fallbackUnderstanding = 'Unable to understand the query.';
        let fallbackAdvice = 'I’m sorry, I didn’t understand your message. Could you please rephrase it or provide more details?';
        let isProductQuery = false;
        let searchKeywords: string[] = [];
        let productTypes: string[] = [];
        let attributes: string[] = [];
        let requestedProductCount = 1;
        let priceFilter: { max_price: number; currency: string } | null = null;
        let sortByPrice = false;
        const vendor = null;
        let usageInstructions = '';
        let isComboSetQuery = false;
        let isFictional = false;
        let isClarification = false;

        const queryLower = userQuery.toLowerCase();
        isFictional = isPotentiallyFictional(queryLower);
        isClarification = isFollowUpClarification(queryLower, chatHistory);
        priceFilter = extractPriceFilter(queryLower);

        if (queryLower === 'hi') {
          fallbackUnderstanding = 'greeting';
          fallbackAdvice = 'Hey there! What beauty adventure awaits us today? How can I assist you?';
          isProductQuery = false;
        } else if (queryLower === 'thanks') {
          fallbackUnderstanding = 'greeting';
          fallbackAdvice = "You're welcome! Is there anything I can help you find today?";
          isProductQuery = false;
        } else if (queryLower === "what's your name?") {
          fallbackUnderstanding = 'general question about chatbot identity';
          fallbackAdvice = "I'm Grok, Planet Beauty's AI assistant, here to help you find your perfect beauty products!";
          isProductQuery = false;
        } else if (queryLower.startsWith('what is') || queryLower.startsWith('tell me about')) {
          fallbackUnderstanding = 'general question';
          fallbackAdvice = 'Skincare involves cleansing, treating, moisturizing, and protecting to keep your skin healthy and glowing!';
          if (queryLower.includes('skincare')) {
            fallbackUnderstanding = 'general question about skincare';
          }
          isProductQuery = false;
        } else if (queryLower.startsWith('what were we talking about')) {
          fallbackUnderstanding = 'memory query';
          const lastProductQuery = chatHistory.slice(-2).find(msg => msg.role === 'user' && msg.content?.match(/\b(skincare|serum|moisturizer)\b/))?.content || 'our conversation';
          fallbackAdvice = `We were discussing ${lastProductQuery}. Want to dive deeper or explore something new?`;
          isProductQuery = false;
        } else if (isClarification) {
          fallbackUnderstanding = 'follow-up clarification';
          fallbackAdvice = 'I’m checking if that product is part of a kit. Can you clarify which product you’re referring to?';
          isProductQuery = false;
        } else if (isFictional) {
          fallbackUnderstanding = `query for fictional product ${userQuery.toLowerCase()}`;
          fallbackAdvice = `${userQuery} sounds like something from a sci-fi novel! How about we explore some amazing real-world alternatives?`;
          isProductQuery = false;
        } else if (priceFilter) {
          isProductQuery = true;
          productTypes = queryLower.match(/serum|eye cream|mascara|lipstick|sunscreen|moisturizer|cleanser|toner/gi) || [];
          attributes = queryLower.match(/vegan|cruelty-free|dry skin|oily skin|dark circles/gi) || [];
          searchKeywords = [...productTypes, ...attributes];
          fallbackUnderstanding = `product query for ${productTypes.join(' and ') || 'products'} with price filter`;
          fallbackAdvice = `Looking for ${productTypes.join(' and ') || 'products'} under $${priceFilter.max_price} USD! Let’s find some options.`;
          sortByPrice = queryLower.includes('cheap') || queryLower.includes('cheapest');
          requestedProductCount = 1;
          usageInstructions = productTypes.includes('sunscreen') ? 'Apply generously 15 minutes before sun exposure.' : 'Apply to clean skin.';
        } else if (queryLower.match(/\b(recommend|find|show|serum|eye cream|mascara|skincare|lipstick|sunscreen|moisturizer|cleanser|toner|set|combo)\b/)) {
          isProductQuery = true;
          searchKeywords = queryLower.split(/\s+/).filter(word =>
            ['serum', 'eye cream', 'mascara', 'skincare', 'lipstick', 'sunscreen', 'moisturizer', 'cleanser', 'toner', 'vegan', 'cruelty-free', 'dark circles', 'dry skin', 'oily skin', 'cheap', 'set', 'combo'].includes(word)
          );
          productTypes = queryLower.match(/serum|eye cream|mascara|lipstick|sunscreen|moisturizer|cleanser|toner|set/gi) || [];
          attributes = queryLower.match(/vegan|cruelty-free|dry skin|oily skin|dark circles/gi) || [];
          requestedProductCount = queryLower.includes('set') ? 3 : (queryLower.includes('combo') || queryLower.includes('and') ? 2 : 1);
          isComboSetQuery = queryLower.includes('set') || queryLower.includes('combo');
          fallbackUnderstanding = `product query for ${productTypes.join(' and ') || 'products'}`;
          fallbackAdvice = `Looking for ${productTypes.join(' and ') || 'products'}! Let’s find some great options.`;
          usageInstructions = productTypes.includes('serum') ? 'Apply to clean skin before moisturizer.' :
                              productTypes.includes('eye cream') ? 'Apply a pea-sized amount under eyes nightly.' :
                              productTypes.includes('sunscreen') ? 'Apply generously 15 minutes before sun exposure.' : 'Apply to clean skin.';
        } else if (queryLower.includes('asdfjkl')) {
          fallbackUnderstanding = 'Unable to understand';
          fallbackAdvice = 'That’s a creative one! Can you rephrase or provide more details about the beauty product you’re after?';
        }

        return {
          is_product_query: isProductQuery,
          search_keywords: searchKeywords,
          product_types: productTypes,
          attributes: attributes,
          vendor,
          price_filter: priceFilter,
          requested_product_count: requestedProductCount,
          ai_understanding: fallbackUnderstanding,
          advice: fallbackAdvice,
          sort_by_price: sortByPrice,
          usage_instructions: usageInstructions,
          is_combo_set_query: isComboSetQuery,
          is_fictional_product_query: isFictional,
          is_clarification_needed: isClarification,
        };
      }
    }

    const structuredResponse: LLMStructuredResponse = {
      is_product_query: typeof parsedResponse.is_product_query === 'boolean' ? parsedResponse.is_product_query : false,
      search_keywords: Array.isArray(parsedResponse.search_keywords) ? parsedResponse.search_keywords : [],
      product_types: Array.isArray(parsedResponse.product_types) ? parsedResponse.product_types : [],
      attributes: Array.isArray(parsedResponse.attributes) ? parsedResponse.attributes : [],
      vendor: typeof parsedResponse.vendor === 'string' ? parsedResponse.vendor : null,
      price_filter: parsedResponse.price_filter && typeof parsedResponse.price_filter.max_price === 'number' ? parsedResponse.price_filter : null,
      requested_product_count: typeof parsedResponse.requested_product_count === 'number' ? parsedResponse.requested_product_count : 1,
      ai_understanding: typeof parsedResponse.ai_understanding === 'string' ? parsedResponse.ai_understanding : 'AI understanding not provided.',
      advice: typeof parsedResponse.advice === 'string' ? parsedResponse.advice : 'No advice provided.',
      sort_by_price: typeof parsedResponse.sort_by_price === 'boolean' ? parsedResponse.sort_by_price : false,
      usage_instructions: typeof parsedResponse.usage_instructions === 'string' ? parsedResponse.usage_instructions : '',
      is_combo_set_query: typeof parsedResponse.is_combo_set_query === 'boolean' ? parsedResponse.is_combo_set_query : false,
      is_fictional_product_query: typeof parsedResponse.is_fictional_product_query === 'boolean' ? parsedResponse.is_fictional_product_query : isPotentiallyFictional(userQuery),
      is_clarification_needed: typeof parsedResponse.is_clarification_needed === 'boolean' ? parsedResponse.is_clarification_needed : isFollowUpClarification(userQuery, chatHistory),
    };

    // Adjust for non-product queries to ensure correct classification
    const queryLower = userQuery.toLowerCase();
    if (!structuredResponse.is_product_query && !structuredResponse.is_fictional_product_query && !structuredResponse.is_clarification_needed) {
      const isRecommendationQuery = queryLower.match(/\b(recommend|find|show|any good|best-selling|what specific products)\b/) ||
                                   queryLower.match(/\b(serum|eye cream|mascara|skincare|lipstick|sunscreen|moisturizer|cleanser|toner)\b/);
      const isFollowUp = isFollowUpClarification(queryLower, chatHistory);

      if (isRecommendationQuery || isFollowUp) {
        structuredResponse.is_product_query = true;
        structuredResponse.ai_understanding = isFollowUp ? `follow-up product query for ${structuredResponse.ai_understanding}` : `product query for ${queryLower}`;
        if (!structuredResponse.search_keywords.length) {
          structuredResponse.search_keywords = queryLower.split(/\s+/).filter(word =>
            ['serum', 'eye cream', 'mascara', 'skincare', 'lipstick', 'sunscreen', 'moisturizer', 'cleanser', 'toner', 'vegan', 'cruelty-free', 'dark circles', 'dry skin', 'oily skin', 'cheap', 'set', 'combo'].includes(word)
          );
        }
        if (!structuredResponse.product_types.length) {
          structuredResponse.product_types = queryLower.match(/serum|eye cream|mascara|lipstick|sunscreen|moisturizer|cleanser|toner|set/gi) || [];
        }
        if (!structuredResponse.attributes?.length) {
          structuredResponse.attributes = queryLower.match(/vegan|cruelty-free|dry skin|oily skin|dark circles/gi) || [];
        }
        structuredResponse.requested_product_count = impliesProductList(queryLower) ? 10 : (queryLower.includes('set') ? 3 : (queryLower.includes('combo') || queryLower.includes('and') ? 2 : 1));
        structuredResponse.price_filter = structuredResponse.price_filter || extractPriceFilter(queryLower);
        structuredResponse.sort_by_price = queryLower.includes('cheap') || queryLower.includes('cheapest');
        structuredResponse.usage_instructions = structuredResponse.product_types.includes('serum') ? 'Apply to clean skin before moisturizer.' :
                                               structuredResponse.product_types.includes('eye cream') ? 'Apply a pea-sized amount under eyes nightly.' :
                                               structuredResponse.product_types.includes('sunscreen') ? 'Apply generously 15 minutes before sun exposure.' : 'Apply to clean skin.';
        logger.info({ adjustedResponse: structuredResponse }, 'Adjusted response for is_product_query consistency.');
      } else if (queryLower.startsWith('what is') || queryLower.startsWith('tell me about')) {
        structuredResponse.is_product_query = false;
        structuredResponse.ai_understanding = queryLower.includes('skincare') ? 'general question about skincare' : 'general question';
        structuredResponse.search_keywords = [];
        structuredResponse.product_types = [];
        structuredResponse.attributes = [];
        structuredResponse.requested_product_count = 0;
      }
    }

    // Ensure correct handling of fictional and clarification queries
    if (isFictional) {
      structuredResponse.is_product_query = false;
      structuredResponse.is_fictional_product_query = true;
      structuredResponse.search_keywords = [];
      structuredResponse.product_types = [];
      structuredResponse.attributes = [];
      structuredResponse.requested_product_count = 0;
      if (!structuredResponse.advice.includes('real-world')) {
        structuredResponse.advice = `${structuredResponse.advice} Let’s explore some real-world alternatives!`;
      }
    }

    if (isClarification) {
      structuredResponse.is_product_query = false;
      structuredResponse.is_clarification_needed = true;
      structuredResponse.search_keywords = [];
      structuredResponse.product_types = [];
      structuredResponse.attributes = [];
      structuredResponse.requested_product_count = 0;
    }

    if (structuredResponse.vendor === 'Planet Beauty' && !queryLower.includes('planet beauty brand')) {
      structuredResponse.vendor = null;
    }

    logger.info({ structuredResponse }, 'Structured LLM Response.');
    return structuredResponse;
  } catch (error) {
    logger.error({ error }, 'Error generating LLM response.');
    return {
      is_product_query: false,
      search_keywords: [],
      product_types: [],
      attributes: [],
      vendor: null,
      price_filter: null,
      requested_product_count: 0,
      ai_understanding: 'Error: AI service unavailable or encountered an issue.',
      advice: 'Sorry, I’m currently unable to process your request. Please try again later.',
      sort_by_price: false,
      usage_instructions: '',
      is_combo_set_query: false,
      is_fictional_product_query: false,
      is_clarification_needed: false,
    };
  }
}
