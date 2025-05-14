// lib/llm.ts
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import fetch from 'node-fetch';
import pino from 'pino';
import { getKnowledgebaseEntry } from './redis';
if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY must be set');
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
// List of fictional product terms to detect fake or impossible queries
const fictionalTerms = ['unobtainium', 'unicorn', 'dragon', 'stardust', 'mythril', 'elixir', 'phoenix'];
// Helper functions
const isPotentiallyFictional = (query) => {
    const queryLower = query.toLowerCase();
    return (fictionalTerms.some(term => queryLower.includes(term)) ||
        queryLower.includes('planet beauty brand'));
};
const extractPriceFilter = (query) => {
    const priceMatch = query.toLowerCase().match(/(under|below|less than|around|about)\s*\$?(\d+(\.\d+)?)/);
    if (priceMatch) {
        return { max_price: parseFloat(priceMatch[2]), currency: 'USD' };
    }
    return null;
};
const isFollowUpClarification = (query, chatHistory) => {
    const queryLower = query.toLowerCase();
    return (Boolean(queryLower.match(/\b(part of a kit|is that|does it|are they)\b/)) &&
        chatHistory.slice(-4).some(msg => msg.role === 'user' &&
            msg.content?.toLowerCase().match(/\b(recommend|products?|find|show|best-selling|serum|eye cream|mascara|skincare|lipstick|sunscreen|cleanser|toner)\b/)));
};
const impliesProductList = (query) => {
    const lowerQuery = query.toLowerCase();
    return /show me|any good|what are|recommend some|list of/.test(lowerQuery);
};
function preprocessQuery(query, chatHistory) {
    const normalizedQuery = query.trim().toLowerCase();
    const isProductQuery = /(lipstick|moisturizer|serum|sunscreen|mascara|cleanser|toner|set|combo)/i.test(normalizedQuery);
    const complexity = normalizedQuery.split(' ').length > 5 || /and|for|under|between/i.test(normalizedQuery) ? 5 : 3;
    const isFictional = isPotentiallyFictional(normalizedQuery);
    const isClarification = isFollowUpClarification(normalizedQuery, chatHistory);
    let intent = isProductQuery ? 'product_search' : 'general_info';
    if (isFictional)
        intent = 'nonsense';
    if (isClarification)
        intent = 'clarification';
    const fields = {
        is_product_query: isProductQuery && !isFictional && !isClarification,
        search_keywords: [],
        product_types: [],
        attributes: [],
        vendor: null,
        price_filter: extractPriceFilter(normalizedQuery),
        requested_product_count: isProductQuery ? (normalizedQuery.includes('set') ? 3 : normalizedQuery.includes('combo') || normalizedQuery.includes('and') ? 2 : 1) : 0,
        ai_understanding: isProductQuery
            ? 'product query'
            : isFictional
                ? 'query for fictional product'
                : isClarification
                    ? 'follow-up clarification'
                    : 'general question',
        sort_by_price: /cheap|cheapest/i.test(normalizedQuery),
        usage_instructions: isProductQuery ? 'Apply to clean skin.' : '',
        is_combo_set_query: /set|combo/i.test(normalizedQuery),
        is_fictional_product_query: isFictional,
        is_clarification_needed: isClarification,
        is_ingredient_query: /retinol|paraben|vegan/i.test(normalizedQuery),
        skin_concern: normalizedQuery.match(/dry skin|oily skin|sensitive skin|redness|acne/i)?.map(m => m) || [],
        is_price_range_query: /between\s*\$?\d+\s*and\s*\$?\d+/i.test(normalizedQuery),
        response_confidence: isProductQuery ? 0.9 : isFictional ? 0.3 : isClarification ? 0.7 : 0.5,
        suggested_follow_ups: isProductQuery ? ['Any specific brands?', 'Want vegan options?'] : [],
        is_out_of_stock_query: /in stock|available/i.test(normalizedQuery),
        query_language: 'en',
        is_comparison_query: /vs|compare/i.test(normalizedQuery),
        cache_ttl_override: isProductQuery ? 3600 : 0,
        is_location_specific: /tropical|nyc/i.test(normalizedQuery),
        user_intent_priority: intent,
        alternative_product_types: isFictional ? ['moisturizer', 'serum'] : [],
        is_feedback_request: /review|feedback/i.test(normalizedQuery),
        contextual_clarification: isClarification ? 'Please specify the product or brand.' : '',
        is_subscription_query: /subscription|monthly/i.test(normalizedQuery),
        is_personalized_query: false,
        product_application_time: isProductQuery ? ['anytime'] : [],
        is_promotion_query: /sale|discount/i.test(normalizedQuery),
        user_sentiment: /now|urgent/i.test(normalizedQuery) ? 'urgent' : 'neutral',
        is_gift_query: /gift/i.test(normalizedQuery) ? ['gift'] : [],
        product_packaging: /travel-size|eco-friendly/i.test(normalizedQuery) ? ['travel-size'] : [],
        is_educational_query: /how to|what is/i.test(normalizedQuery),
        related_categories: isProductQuery ? ['cleanser', 'toner'] : [],
        is_urgency_indicated: /now|urgent/i.test(normalizedQuery),
        query_complexity: complexity,
    };
    if (isProductQuery && !isFictional && !isClarification) {
        fields.search_keywords = normalizedQuery.match(/vegan|cruelty-free|cheap|lipstick|moisturizer|serum|sunscreen|mascara|cleanser|toner/i)?.map(k => k) || [];
        fields.product_types = normalizedQuery.match(/lipstick|moisturizer|serum|sunscreen|mascara|cleanser|toner/i)?.map(p => p) || [];
        fields.attributes = normalizedQuery.match(/vegan|cruelty-free|paraben-free/i)?.map(a => a) || [];
        if (/guinot|clinique/i.test(normalizedQuery)) {
            fields.vendor = normalizedQuery.match(/guinot|clinique/i)[0];
        }
        fields.requested_product_count = impliesProductList(normalizedQuery) ? 10 : fields.requested_product_count || 1;
        fields.usage_instructions = fields.product_types?.includes('serum')
            ? 'Apply to clean skin before moisturizer.'
            : fields.product_types?.includes('sunscreen')
                ? 'Apply generously 15 minutes before sun exposure.'
                : 'Apply to clean skin.';
        fields.product_application_time = fields.product_types?.includes('eye cream') ? ['night'] : ['morning', 'night'];
    }
    // Ensure all fields are defined
    const completeFields = {
        is_product_query: fields.is_product_query ?? false,
        search_keywords: fields.search_keywords ?? [],
        product_types: fields.product_types ?? [],
        attributes: fields.attributes ?? [],
        vendor: fields.vendor ?? null,
        price_filter: fields.price_filter ?? null,
        requested_product_count: fields.requested_product_count ?? 0,
        ai_understanding: fields.ai_understanding ?? 'default',
        advice: fields.advice ?? 'default advice',
        sort_by_price: fields.sort_by_price ?? false,
        usage_instructions: fields.usage_instructions ?? '',
        is_combo_set_query: fields.is_combo_set_query ?? false,
        is_fictional_product_query: fields.is_fictional_product_query ?? false,
        is_clarification_needed: fields.is_clarification_needed ?? false,
        is_ingredient_query: fields.is_ingredient_query ?? false,
        skin_concern: fields.skin_concern ?? [],
        is_price_range_query: fields.is_price_range_query ?? false,
        response_confidence: fields.response_confidence ?? 0.5,
        suggested_follow_ups: fields.suggested_follow_ups ?? [],
        is_out_of_stock_query: fields.is_out_of_stock_query ?? false,
        query_language: fields.query_language ?? 'en',
        is_comparison_query: fields.is_comparison_query ?? false,
        cache_ttl_override: fields.cache_ttl_override ?? 3600,
        is_location_specific: fields.is_location_specific ?? false,
        user_intent_priority: fields.user_intent_priority ?? 'general_info',
        alternative_product_types: fields.alternative_product_types ?? [],
        is_feedback_request: fields.is_feedback_request ?? false,
        contextual_clarification: fields.contextual_clarification ?? '',
        is_subscription_query: fields.is_subscription_query ?? false,
        is_personalized_query: fields.is_personalized_query ?? false,
        product_application_time: fields.product_application_time ?? [],
        is_promotion_query: fields.is_promotion_query ?? false,
        user_sentiment: fields.user_sentiment ?? 'neutral',
        is_gift_query: fields.is_gift_query ?? [],
        product_packaging: fields.product_packaging ?? [],
        is_educational_query: fields.is_educational_query ?? false,
        related_categories: fields.related_categories ?? [],
        is_urgency_indicated: fields.is_urgency_indicated ?? false,
        query_complexity: fields.query_complexity ?? 0,
    };
    return { intent, fields: completeFields, complexity };
}
async function getConversationalAdvice(query, metadata) {
    const HF_API_URL = process.env.HF_API_URL || 'https://xraisenx-chat-bot.hf.space/generate_advice';
    try {
        const res = await fetch(HF_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.HF_API_TOKEN || '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'}`,
            },
            body: JSON.stringify({ query, intent: metadata.intent }),
        });
        const data = await res.json();
        return data.advice || 'Let’s find what you need!';
    }
    catch (err) {
        logger.warn({ err }, 'Fallback to default advice.');
        return metadata.fields.ai_understanding === 'greeting'
            ? 'Hey there! What beauty adventure awaits us today?'
            : metadata.fields.is_fictional_product_query
                ? `${query} sounds mythical! Let's find real-world alternatives.`
                : metadata.fields.is_clarification_needed
                    ? 'Can you clarify which product you’re referring to?'
                    : 'Let’s find what you need!';
    }
}
function formatChatHistoryForGemini(chatHistory, systemPrompt, userQuery) {
    const geminiHistory = [];
    let nextSystemMessages = [];
    for (const message of chatHistory) {
        if (message.role === 'system' && message.content) {
            nextSystemMessages.push(message.content);
        }
        else if (message.content || message.text) {
            let currentMessageContent = nextSystemMessages.length ? nextSystemMessages.join('\n') + '\n' : '';
            currentMessageContent += message.content || message.text || '';
            geminiHistory.push({
                role: message.role === 'model' || message.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: currentMessageContent }],
            });
            nextSystemMessages = [];
        }
    }
    const finalUserMessage = `${systemPrompt}
User Query: "${userQuery}"
Please provide your response as a single JSON object with these fields:
is_product_query, search_keywords, product_types, attributes, vendor, price_filter,
requested_product_count, ai_understanding, advice, sort_by_price, usage_instructions,
is_combo_set_query, is_fictional_product_query, is_clarification_needed,
is_ingredient_query, skin_concern, is_price_range_query, response_confidence,
suggested_follow_ups, is_out_of_stock_query, query_language, is_comparison_query,
cache_ttl_override, is_location_specific, user_intent_priority,
alternative_product_types, is_feedback_request, contextual_clarification,
is_subscription_query, is_personalized_query, product_application_time,
is_promotion_query, user_sentiment, is_gift_query, product_packaging,
is_educational_query, related_categories, is_urgency_indicated, query_complexity.`;
    geminiHistory.push({
        role: 'user',
        parts: [{ text: finalUserMessage }],
    });
    return geminiHistory;
}
export async function generateLLMResponse(systemPrompt, _chatHistory, userQuery) {
    const metadata = preprocessQuery(userQuery, _chatHistory); // Preprocess first
    const kbEntry = await getKnowledgebaseEntry(userQuery);
    if (kbEntry && kbEntry.confidence > 0.7) {
        return {
            ...metadata.fields,
            advice: 'Let’s find what you need!',
            is_ingredient_query: false,
            skin_concern: [],
            is_price_range_query: false,
            response_confidence: 0.5,
            suggested_follow_ups: [],
            is_out_of_stock_query: false,
            query_language: 'en',
            is_comparison_query: false,
            cache_ttl_override: 3600,
            is_location_specific: false,
            user_intent_priority: 'general_info',
            alternative_product_types: [],
            is_feedback_request: false,
            contextual_clarification: '',
            is_subscription_query: false,
            is_personalized_query: false,
            product_application_time: [],
            is_promotion_query: false,
            user_sentiment: 'neutral',
            is_gift_query: [],
            product_packaging: [],
            is_educational_query: false,
            related_categories: [],
            is_urgency_indicated: false,
            query_complexity: metadata.complexity,
        };
    }
    if (metadata.complexity <= 3 || metadata.fields.response_confidence >= 0.9) {
        const advice = await getConversationalAdvice(userQuery, metadata);
        return {
            ...metadata.fields,
            advice,
            is_ingredient_query: metadata.fields.is_ingredient_query ?? false,
            skin_concern: metadata.fields.skin_concern ?? [],
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
            query_complexity: metadata.complexity,
        };
    }
    try {
        const fullFormattedHistory = formatChatHistoryForGemini(_chatHistory, systemPrompt, userQuery);
        const historyForStartChat = fullFormattedHistory.slice(0, -1);
        const currentUserMessageParts = fullFormattedHistory[fullFormattedHistory.length - 1]?.parts;
        if (!currentUserMessageParts)
            throw new Error('No valid user message');
        const chat = model.startChat({ history: historyForStartChat });
        const result = await chat.sendMessage(currentUserMessageParts);
        const responseText = result.response.text();
        let parsed = {};
        try {
            parsed = JSON.parse(responseText.replace(/^.*?{/, '{'));
        }
        catch (e) {
            logger.warn({ error: e, responseText }, 'Failed to parse Gemini output');
        }
        return {
            is_product_query: typeof parsed.is_product_query === 'boolean' ? parsed.is_product_query : metadata.fields.is_product_query || false,
            search_keywords: Array.isArray(parsed.search_keywords) ? parsed.search_keywords : metadata.fields.search_keywords || [],
            product_types: Array.isArray(parsed.product_types) ? parsed.product_types : metadata.fields.product_types || [],
            attributes: Array.isArray(parsed.attributes) ? parsed.attributes : metadata.fields.attributes || [],
            vendor: typeof parsed.vendor === 'string' ? parsed.vendor : metadata.fields.vendor || null,
            price_filter: parsed.price_filter && typeof parsed.price_filter.max_price === 'number' ? parsed.price_filter : metadata.fields.price_filter || null,
            requested_product_count: typeof parsed.requested_product_count === 'number' ? parsed.requested_product_count : metadata.fields.requested_product_count || 1,
            ai_understanding: typeof parsed.ai_understanding === 'string' ? parsed.ai_understanding : metadata.fields.ai_understanding || 'default',
            advice: typeof parsed.advice === 'string' ? parsed.advice : await getConversationalAdvice(userQuery, metadata),
            sort_by_price: typeof parsed.sort_by_price === 'boolean' ? parsed.sort_by_price : metadata.fields.sort_by_price || false,
            usage_instructions: typeof parsed.usage_instructions === 'string' ? parsed.usage_instructions : metadata.fields.usage_instructions || '',
            is_combo_set_query: typeof parsed.is_combo_set_query === 'boolean' ? parsed.is_combo_set_query : metadata.fields.is_combo_set_query || false,
            is_fictional_product_query: typeof parsed.is_fictional_product_query === 'boolean' ? parsed.is_fictional_product_query : metadata.fields.is_fictional_product_query || false,
            is_clarification_needed: typeof parsed.is_clarification_needed === 'boolean' ? parsed.is_clarification_needed : metadata.fields.is_clarification_needed || false,
            is_ingredient_query: typeof parsed.is_ingredient_query === 'boolean' ? parsed.is_ingredient_query : metadata.fields.is_ingredient_query ?? false,
            skin_concern: Array.isArray(parsed.skin_concern) ? parsed.skin_concern : metadata.fields.skin_concern || [],
            is_price_range_query: typeof parsed.is_price_range_query === 'boolean' ? parsed.is_price_range_query : metadata.fields.is_price_range_query ?? false,
            response_confidence: typeof parsed.response_confidence === 'number' ? parsed.response_confidence : metadata.fields.response_confidence ?? 0.5,
            suggested_follow_ups: Array.isArray(parsed.suggested_follow_ups) ? parsed.suggested_follow_ups : metadata.fields.suggested_follow_ups ?? [],
            is_out_of_stock_query: typeof parsed.is_out_of_stock_query === 'boolean' ? parsed.is_out_of_stock_query : metadata.fields.is_out_of_stock_query ?? false,
            query_language: typeof parsed.query_language === 'string' ? parsed.query_language : metadata.fields.query_language ?? 'en',
            is_comparison_query: typeof parsed.is_comparison_query === 'boolean' ? parsed.is_comparison_query : metadata.fields.is_comparison_query ?? false,
            cache_ttl_override: typeof parsed.cache_ttl_override === 'number' ? parsed.cache_ttl_override : metadata.fields.cache_ttl_override ?? 3600,
            is_location_specific: typeof parsed.is_location_specific === 'boolean' ? parsed.is_location_specific : metadata.fields.is_location_specific ?? false,
            user_intent_priority: typeof parsed.user_intent_priority === 'string' ? parsed.user_intent_priority : metadata.fields.user_intent_priority ?? 'general_info',
            alternative_product_types: Array.isArray(parsed.alternative_product_types) ? parsed.alternative_product_types : metadata.fields.alternative_product_types || [],
            is_feedback_request: typeof parsed.is_feedback_request === 'boolean' ? parsed.is_feedback_request : metadata.fields.is_feedback_request ?? false,
            contextual_clarification: typeof parsed.contextual_clarification === 'string' ? parsed.contextual_clarification : metadata.fields.contextual_clarification ?? '',
            is_subscription_query: typeof parsed.is_subscription_query === 'boolean' ? parsed.is_subscription_query : metadata.fields.is_subscription_query ?? false,
            is_personalized_query: typeof parsed.is_personalized_query === 'boolean' ? parsed.is_personalized_query : metadata.fields.is_personalized_query ?? false,
            product_application_time: Array.isArray(parsed.product_application_time) ? parsed.product_application_time : metadata.fields.product_application_time ?? [],
            is_promotion_query: typeof parsed.is_promotion_query === 'boolean' ? parsed.is_promotion_query : metadata.fields.is_promotion_query ?? false,
            user_sentiment: typeof parsed.user_sentiment === 'string' ? parsed.user_sentiment : metadata.fields.user_sentiment ?? 'neutral',
            is_gift_query: Array.isArray(parsed.is_gift_query) ? parsed.is_gift_query : metadata.fields.is_gift_query ?? [],
            product_packaging: Array.isArray(parsed.product_packaging) ? parsed.product_packaging : metadata.fields.product_packaging ?? [],
            is_educational_query: typeof parsed.is_educational_query === 'boolean' ? parsed.is_educational_query : metadata.fields.is_educational_query ?? false,
            related_categories: Array.isArray(parsed.related_categories) ? parsed.related_categories : metadata.fields.related_categories ?? [],
            is_urgency_indicated: typeof parsed.is_urgency_indicated === 'boolean' ? parsed.is_urgency_indicated : metadata.fields.is_urgency_indicated ?? false,
            query_complexity: typeof parsed.query_complexity === 'number' ? parsed.query_complexity : metadata.complexity,
        };
    }
    catch (error) {
        logger.error({ error }, 'Error generating LLM response');
        const fallbackAdvice = await getConversationalAdvice(userQuery, metadata);
        return {
            ...metadata.fields,
            advice: fallbackAdvice,
            is_ingredient_query: metadata.fields.is_ingredient_query ?? false,
            skin_concern: metadata.fields.skin_concern ?? [],
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
            query_complexity: metadata.complexity,
        };
    }
}
