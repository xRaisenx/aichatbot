# Changelog

All notable changes to the Planet Beauty AI Chatbot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning (though version numbers are not explicitly tracked in this log for now, focusing on dates and feature sets).

## [Unreleased] - May 12, 2025

### Added
- **Redis Caching & Dynamic Knowledge Base Integration (May 11-12):**
    - Implemented API response caching in `lib/redis.ts` and `app/api/chat/route.ts` to reduce LLM calls for repeated queries (10-min TTL).
    - Implemented session history management using Redis (`lib/redis.ts`, `app/api/chat/route.ts`) to persist conversation context (30-min TTL).
    - Developed a dynamic knowledge base in Redis (`lib/redis.ts`, `lib/llm.ts`, `app/api/chat/route.ts`) with basic keyword similarity search for common non-product questions (30-day TTL).
    - Added `invalidateProductCaches` function in `lib/redis.ts` for use during product synchronization.
    - `lib/llm.ts` updated to check Redis knowledge base before calling Gemini API.
- **User ID Handling:**
    - Added `userId` state (using `uuidv4`) to `components/ChatInterface.tsx`.
    - Included `userId` in API requests from frontend to `/api/chat`.
    - Ensured `app/api/chat/route.ts` correctly processes `userId` for caching and session management.

### Changed
- **API Endpoint Logic (`app/api/chat/route.ts`):**
    - Refined logic for `is_product_query` and `search_keywords` consistency, including improved fallback mechanisms.
    - Updated import statements and logging (switched to `pino` ES6 import).
- **LLM Logic (`lib/llm.ts`):**
    - Enhanced fallback logic for JSON parsing errors.
    - Improved post-processing of LLM response for `is_product_query` consistency and vendor handling (Planet Beauty as a store).
    - Replaced `console.log` with `pino` logger.
- **Redis Utilities (`lib/redis.ts`):**
    - Exported `redisClient` for potential use in other modules (e.g., admin, analytics).
    - Corrected syntax issues in `STATIC_BASE_PROMPT_CONTENT` template literal.
- **Simulation Script (`simulate-chat.ts`):**
    - Updated `evaluateResponse` function to better handle scenarios with an empty Upstash Vector product index.
- **Documentation:**
    - Updated `README.md`, `actionable_todo.md`, `progress.md`, `feedback.md`, and `project_structure.md` to reflect all recent changes including caching, knowledge base, and bug fixes.

### Fixed
- **`is_product_query` Bug:** Addressed misclassification of product queries by enhancing LLM response interpretation in `lib/llm.ts` and `app/api/chat/route.ts`.
- **"Missing userId" Error:** Resolved by adding `userId` to frontend API requests and ensuring backend processing.
- **Linting Errors:** Fixed various ESLint errors across `app/api/chat/route.ts`, `lib/llm.ts`, and `lib/redis.ts`.
- **Template Literal Syntax Errors:** Corrected issues in `STATIC_BASE_PROMPT_CONTENT` in `lib/redis.ts`.

## [Previous Releases]

### May 11, 2025 (Evening) - Contextual Suggested Questions

#### Added
- **Contextual Suggested Questions Feature:**
    - **Backend (`app/api/chat/generate-suggested-questions/route.ts`):** Modified to handle `POST` requests with `type: 'initial'` (4 welcome questions) or `type: 'contextual'` (3 questions based on `conversation_history`). Implemented new LLM prompt for contextual questions.
    - **Types (`lib/types.ts`):** Added `GenerateSuggestedQuestionsRequest` type.
    - **Frontend (`components/ChatInterface.tsx`):** Added state for contextual suggestions and loading status. Updated `sendMessage` to fetch contextual suggestions after bot responses. Implemented rendering for contextual suggestions.

#### Changed
- **Documentation (`README.md`):** Updated to reflect the new dual suggested questions feature.

### May 11, 2025 (Early Morning) - UI/UX Enhancements & Initial LLM Refinements

#### Added
- **Type Definitions (`lib/types.ts`):** Added `product_matches: Array<{ variantId: string; reasoning: string }>` to `LLMStructuredResponse`.
- **Frontend - Product Card (`components/ProductCard.tsx` & `styles/ChatInterface.module.css`):**
    - Implemented USD currency formatting for price (e.g., "$43.00").
    - Added new CSS class `styles.productReasoning` for "reason for match" text (gray, subtle, italic).
- **Frontend - Chat Interface (`components/ChatInterface.tsx`):**
    - Expanded static `suggestedQuestions` list (later replaced by dynamic fetching).
    - Modified to display more random premade questions on initial load.
- **API for Suggested Questions (`app/api/chat/generate-suggested-questions/route.ts`):**
    - Initial version refined to generate more creative questions using LLM.

#### Changed
- **ESLint Configuration:** Updated `.eslintrc.json` to ignore `lib/upstash-vector-reference.ts`.
- **Backend Logic (`app/api/chat/route.ts`):**
    - Modified product mapping to use new `description` field (reason for match).
    - Commented out verbose `console.log` and removed unused currency constants.
- **Frontend - Product Card (`components/ProductCard.tsx`):** Changed `price` prop to type `number`.
- **Frontend - Chat Message (`components/ChatMessage.tsx`):**
    - Removed "Bella is thinking..." text from loading indicator.
    - Updated `Message` interface: `product_card.price` to `number`. Ensured `Number()` conversion in `parseAdvice`.
- **Frontend - Complementary Products (`components/ComplementaryProducts.tsx`):** Corrected `price` prop type.
- **Build & Linting:** Ensured `npm run lint` and `npm run build` passed.

### May 10, 2025 (Evening) - LLM Refinement & Simulation Focus

#### Added
- **System Prompt Caching (`lib/redis.ts`, `app/api/chat/route.ts`):** Implemented caching for `STATIC_BASE_PROMPT_CONTENT`.

#### Changed
- **Product Price & Description Formatting (`app/api/chat/route.ts`):**
    - Ensured product prices in `ProductCardResponse` are numbers (USD).
    - Truncated product descriptions (`MAX_DESCRIPTION_LENGTH`).
- **System Prompt Refinements (`lib/redis.ts` - `STATIC_BASE_PROMPT_CONTENT`):**
    - Multiple iterations to improve LLM adherence to `requested_product_count`, price filter text, and specific examples (e.g., "asdfjkl;").
- **Gibberish Detection (`app/api/chat/route.ts`):** Refined `isPotentiallyGibberish` function.
- **Linting & Build Errors:** Addressed various errors in `app/api/sync-products/route.ts`, `lib/llm.ts`, `lib/redis.ts`.
- **Build Configuration (`tsconfig.json`):** Excluded `lib/upstash-vector-reference.ts` from build.
- **Next.js Cache:** Cleared `.next` directory.
- **Simulation Testing (`simulate-chat.ts`):** Expanded test cases and updated expectations. Achieved 8/16 passing.

### May 10, 2025 (Afternoon) - Core API Enhancements & Debugging

#### Added
- **Sparse Search with BM25 Embeddings (`expandKeywords`) in Chat API.** (Details likely in `lib/redis.ts` or `app/api/chat/route.ts` from that period).
- **Timeout for Vector Queries (`performVectorQuery`).**
- **Structured Logging with `pino` introduced.**
- **Shopify GraphQL Fallback (`performShopifyGraphQLQuery`) implemented and refined.**

#### Changed
- **`filterNegativePhrasing` strengthened.**
- **`chatHistoryCache` optimized with `LRUCache`.**
- **`getEphemeralUserChatHistory` in `lib/redis.ts` made more robust.**
- **Vector Query Logic (`performVectorQuery` in `app/api/chat/route.ts`):**
    - Resolved `UPSTASH_VECTOR_REST_URL` inconsistencies.
    - Addressed "Invalid metadata in vector query result".
    - Corrected return logic.
    - Relaxed `vendorMatch`, broadened `attributeMatch` and `typeMatch`.
    - Updated price filtering (initially for Pesos, then shifted to USD assumption).
- **Gemini Prompt (`lib/redis.ts`):** Updated for contextual queries, complex filters, fictional items, combo/set definitions.

#### Fixed
- **Critical TypeScript Error in `app/api/chat/route.ts` and related test file.**

### Pre-May 10, 2025 - Foundation & Initial Features

*(Details for this period are inferred from overall project structure and later refinements)*

#### Added
- **Project Setup:** Next.js with TypeScript, Tailwind CSS.
- **Core Chat Interface (`components/ChatInterface.tsx`, `ChatMessage.tsx`):** Initial UI for chat.
- **Basic API Endpoint (`app/api/chat/route.ts`):** Initial version for handling chat messages.
- **LLM Integration (`lib/llm.ts`):** Initial setup with Google Gemini API.
- **Upstash Vector Integration (`lib/redis.ts`, `app/api/chat/route.ts`):** Setup for product search.
- **Upstash Redis Integration (`lib/redis.ts`):** Initial setup for chat history and potentially other caching.
- **Shopify Integration (`lib/shopify.ts`, `lib/shopify-admin.ts`):**
    - Product synchronization (`app/api/sync-products/route.ts`).
    - Basic Shopify Admin API and Storefront API interactions.
- **Type Definitions (`lib/types.ts`):** Core types for messages, products, API responses.
- **Basic Admin Dashboard Structure (`/app/admin`).**
- **Simulation Scripts (`simulate-chat.ts`, `simulate-sync.ts`):** Initial versions for testing.
- **ESLint, Prettier, TypeScript configurations.**
- **Deployment on Vercel.**

#### Changed
- **Architectural Shift:** Transition from a Google Apps Script based solution to a modern Next.js web application stack.

This changelog is based on the available documentation and our recent interactions. For a more granular history, the Git commit log would be the definitive source.
