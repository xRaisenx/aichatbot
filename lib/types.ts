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
  id?: string;
  title: string;
  price: number;
  imageUrl: string | null;
  productUrl: string;
  variantId?: string;
  tags: string[];
  textForBM25: string;
  [key: string]: unknown; // Added for Upstash Vector Dict compatibility
}

/**
 * Structure for product card responses in the chat UI.
 */
export interface ProductCardResponse {
  title: string;
  description: string;
  price: number;
  image: string | null;
  landing_page: string;
  variantId: string;
  matches?: string;
  availableForSale?: boolean;
  quantityAvailable?: number;
}

/**
 * Defines the expected JSON structure from the LLM's understanding.
 * This aligns with the fields defined in the STATIC_BASE_PROMPT_CONTENT in redis.ts.
 */
export interface LLMStructuredResponse {
  is_product_query: boolean;
  search_keywords: string[];
  product_types: string[];
  attributes: string[];
  vendor: string | null;
  price_filter: { max_price: number; currency: string } | null;
  requested_product_count: number;
  ai_understanding: string;
  advice: string;
  sort_by_price: boolean;
  usage_instructions: string;
  is_combo_set_query: boolean;
  is_fictional_product_query: boolean;
  is_clarification_needed: boolean;
}

/**
 * Overall structure of the JSON response sent by the /api/chat endpoint.
 */
export interface ChatApiResponse {
  advice: string;
  product_card: ProductCardResponse | null;
  complementary_products: ProductCardResponse[] | null;
  is_product_query: boolean;
  ai_understanding: string;
  is_fictional_product_query: boolean;
  is_clarification_needed: boolean;
  history: ChatHistory;
}

/**
 * Defines the request body for the /api/chat/generate-suggested-questions endpoint.
 */
export interface GenerateSuggestedQuestionsRequest {
  type?: 'initial' | 'contextual'; // Defaults to 'initial' if not provided
  conversation_history?: ChatMessage[]; // Required if type is 'contextual'
}
