// lib/types.ts

/**
 * Represents a single message in a chat conversation.
 * Roles can be 'user', 'assistant' (for AI responses), 'system' (for system prompts),
 * or 'bot'/'model' for compatibility with older structures.
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'bot' | 'model';
  text?: string; // Primarily used by older Redis history structure
  content?: string; // Primarily used by LLM APIs and newer history structure
}

/**
 * Represents an ordered sequence of chat messages.
 */
export type ChatHistory = ChatMessage[];

/**
 * Metadata structure for product vectors in Upstash Vector.
 */
export interface ProductVectorMetadata {
  id?: string; // Upstash vector ID
  title: string;
  price: number; // Price stored in cents (e.g., 1299 for $12.99)
  imageUrl: string | null;
  productUrl: string;
  variantId?: string; // Shopify GID or similar
  tags?: string[]; // Optional tags
  textForBM25: string; // Text optimized for keyword search
  brand?: string; // Example: Add brand to metadata
  skin_type?: string[]; // Example: Add skin type compatibility
  product_type?: string; // Example: Add product type
  attributes?: string[]; // Example: Add attributes like 'vegan', 'SPF 30'
  [key: string]: unknown; // Allow other properties
}

/**
 * Structure for product card responses in the chat UI.
 */
export interface ProductCardResponse {
  title: string;
  description: string;
  price: number; // Price stored in dollars (e.g., 12.99)
  image: string | null;
  landing_page: string;
  variantId: string; // Numeric ID string
  // Optional fields from metadata or further processing
  matches?: string;
  availableForSale?: boolean;
  quantityAvailable?: number;
}

/**
 * Defines the expected JSON structure from the LLM's understanding.
 * This aligns with the fields defined in the STATIC_BASE_PROMPT_CONTENT in redis.ts.
 */
export interface LLMStructuredResponse {
  hair_concern?: string[];
  is_product_query: boolean;
  search_keywords: string[];
  product_types: string[];
  attributes: string[];
  vendor: string | null;
  price_filter: { max_price: number; currency: string } | null; // max_price in dollars
  requested_product_count: number;
  ai_understanding: string;
  advice: string;
  sort_by_price: boolean; // Should be boolean based on usage
  usage_instructions: string;
  is_combo_set_query: boolean;
  is_fictional_product_query: boolean;
  is_clarification_needed: boolean;
  is_ingredient_query: boolean;
  skin_concern: string[];
  is_price_range_query: boolean;
  response_confidence: number; // Should be number based on usage
  suggested_follow_ups: string[];
  is_out_of_stock_query: boolean;
  query_language: string;
  is_comparison_query: boolean;
  cache_ttl_override: number; // TTL in seconds
  is_location_specific: boolean;
  user_intent_priority: string; // Should be string based on usage
  alternative_product_types: string[];
  is_feedback_request: boolean;
  contextual_clarification: string;
  is_subscription_query: boolean;
  is_personalized_query: boolean;
  product_application_time: string[]; // Should be string[] based on usage
  is_promotion_query: boolean;
  user_sentiment: string; // Should be string based on usage
  is_gift_query: string[]; // Should be string[] based on usage
  product_packaging: string[]; // Should be string[] based on usage
  is_educational_query: boolean;
  related_categories: string[];
  is_urgency_indicated: boolean;
  query_complexity: number; // Should be number based on usage

  // Optional internal use - not typically returned in ChatApiResponse
  history?: ChatHistory;
  product_card?: ProductCardResponse | null;
  complementary_products?: ProductCardResponse[] | null;
}

/**
 * Overall structure of the JSON response sent by the /api/chat endpoint.
 */
export interface ChatApiResponse {
  advice: string;
  product_card: ProductCardResponse | null;
  complementary_products: ProductCardResponse[] | null;
  history: ChatHistory;
  is_product_query: boolean;
  ai_understanding: string;
  is_fictional_product_query: boolean;
  is_clarification_needed: boolean;
  search_keywords: string[];
  product_types: string[];
  attributes: string[];
  vendor: string | null;
  price_filter: { max_price: number; currency: string } | null;
  requested_product_count: number;
  sort_by_price: boolean;
  usage_instructions: string;
  is_combo_set_query: boolean;
  is_ingredient_query: boolean;
  skin_concern: string[];
  hair_concern: string[]; // Added hair concern to ChatApiResponse
  is_price_range_query: boolean;
  response_confidence: number;
  suggested_follow_ups: string[];
  is_out_of_stock_query: boolean;
  query_language: string;
  is_comparison_query: boolean;
  cache_ttl_override: number;
  is_location_specific: boolean;
  user_intent_priority: string;
  alternative_product_types: string[];
  is_feedback_request: boolean;
  contextual_clarification: string;
  is_subscription_query: boolean;
  is_personalized_query: boolean;
  product_application_time: string[];
  is_promotion_query: boolean;
  user_sentiment: string;
  is_gift_query: string[];
  product_packaging: string[];
  is_educational_query: boolean;
  related_categories: string[];
  is_urgency_indicated: boolean;
  query_complexity: number;
}

/**
 * Defines the request body for the /api/chat/generate-suggested-questions endpoint.
 */
export interface GenerateSuggestedQuestionsRequest {
  type?: 'initial' | 'contextual'; // Defaults to 'initial' if not provided
  conversation_history?: ChatMessage[]; // Required if type is 'contextual'
}