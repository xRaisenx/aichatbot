# Planet Beauty AI Chatbot: Intelligent Shopping Assistant

## 🚀 Project Overview

Welcome to the Planet Beauty AI Chatbot project! This isn't just a chatbot; it's an intelligent shopping assistant designed to revolutionize the online shopping experience for Planet Beauty customers. Built with cutting-edge AI and seamless e-commerce integration, this chatbot aims to provide personalized assistance, intelligent product recommendations, and instant answers, driving customer engagement and sales.

Our solution leverages the power of Google's Gemini API for sophisticated natural language understanding and Upstash Vector for lightning-fast, relevant product searches. Deep integration with Shopify ensures real-time product data accuracy and a smooth path from query to checkout.

## ✨ Key Features

*   **Advanced Natural Language Conversations:** Understands complex user queries, intent, and context using a powerful integrated Large Language Model (LLM) (e.g., xAI's Grok, OpenAI's GPT-4, or similar).
*   **Intelligent Product Search:** Utilizes Upstash Vector (BM25 sparse search) for quick and accurate product discovery.
*   **Shopify GraphQL Fallback:** Ensures product information is always available.
*   **Enhanced Contextual Chat History:**
    *   Remembers previous turns in the conversation.
    *   Utilizes LLM-powered summarization for long conversations to maintain relevant context efficiently.
*   **General Knowledge Base:** Answers general beauty-related questions (e.g., "What is skincare?") using a dedicated Upstash Vector index.
*   **External Data Integration:** Capable of fetching real-time data (e.g., product prices, trends) from external APIs to enrich responses (placeholder implementation).
*   **Real-time Product Sync:** Keeps product information up-to-date via Shopify Admin API.
*   **Efficient Caching & Rate Limiting:** Employs Upstash Redis for optimized performance and stability.
*   **Scalable Architecture:** Built on Next.js and Vercel.
*   **Grok-like Personality:** AI responses are designed to be clear, concise, conversational, and slightly witty.

## 📈 Business Value for Planet Beauty

*   **Enhanced Customer Experience:** Provides instant, 24/7 support and highly personalized, intelligent shopping guidance.
*   **Increased Sales Conversion:** Helps customers find the right products quickly and provides comprehensive information.
*   **Improved Customer Engagement:** Offers a more dynamic and knowledgeable interactive experience.
*   **Reduced Support Load:** Automates responses to a wider range of common and complex queries.

## 🛠️ Current Development Status (As of May 10, 2025 - Evening Session Update)

This session focused on a major refactoring of the Chat API (`app/api/chat/route.ts`) and supporting libraries to integrate a more powerful, "Gemini-like" AI architecture.

*   **Key Architectural Enhancements Implemented:**
    *   **LLM Integration (`lib/llm.ts`):**
        *   Created a new module to abstract interactions with a powerful external Large Language Model.
        *   Includes a placeholder API client and `generateLLMResponse` function.
    *   **Enhanced System Prompt (`lib/redis.ts` - `STATIC_BASE_PROMPT_CONTENT`):**
        *   The system prompt has been completely rewritten to emulate a "Grok-like" personality – clever, friendly, and witty.
        *   Includes more explicit instructions for handling complex queries, fictional products, and combo/set requests.
    *   **Chat History Summarization (`lib/redis.ts`):**
        *   Added `summarizeChatHistory` function, which uses the LLM to condense long chat histories, improving context retention.
    *   **General Knowledge Base Search (`lib/redis.ts`):**
        *   Added `searchKnowledgeBase` function and `KNOWLEDGE_BASE_INDEX_NAME` constant for querying a separate vector index for general beauty knowledge (currently a placeholder querying the product index).
    *   **External Data Integration (`lib/external.ts`):**
        *   Created a new module with a placeholder `fetchProductPrices` function to demonstrate fetching real-time external data.
    *   **Centralized Types (`lib/types.ts`):**
        *   Created a new file to store shared TypeScript type definitions (`ChatMessage`, `ChatHistory`, `LLMStructuredResponse`, etc.), ensuring consistency across modules.
    *   **Chat API Refactor (`app/api/chat/route.ts`):**
        *   The main API logic now uses `generateLLMResponse` for core AI processing.
        *   Integrates `summarizeChatHistory`, `searchKnowledgeBase`, and `fetchProductPrices` into the response generation flow.
        *   Updated to use the centralized types from `lib/types.ts`.
*   **Previous Simulation Issues Addressed (Structurally):**
    *   The new prompt and LLM integration aim to improve understanding of complex queries and fictional products.
    *   The refactored API structure provides hooks for more intelligent combo/set handling and knowledge base lookups.
    *   Detailed logging was added to `isPotentiallyGibberish` for better diagnostics.

## 💡 Next Steps & Roadmap (Focus on New Architecture Configuration & Testing)

With the new architecture in place, the immediate priority is to configure and test its components.

1.  **LLM and External API Configuration (High Priority):**
    *   Replace placeholder API URLs and client logic in `lib/llm.ts` and `lib/external.ts` with actual implementations for the chosen LLM (e.g., xAI, OpenAI) and any external data services.
    *   Set up required environment variables (e.g., `XAI_API_KEY`, `PRICE_API_KEY`).
2.  **Knowledge Base Setup (High Priority):**
    *   Create and populate the `idx:beauty_knowledge` Upstash Vector index with relevant beauty articles, FAQs, and skincare tips.
    *   Ensure `searchKnowledgeBase` in `lib/redis.ts` can correctly query this new index (may require a separate `Index` client instance).
3.  **Product Search Filtering (Medium Priority):**
    *   Implement the `TODO` in `app/api/chat/route.ts` to filter product search results from Upstash Vector based on attributes, vendor, and price filters extracted by the LLM in `llmResult`.
4.  **Refine Combo/Set Logic with LLM (Medium Priority):**
    *   Leverage the LLM's improved understanding (via the new prompt) to better distinguish between requests for pre-packaged sets vs. assembling individual items for a combo. The `app/api/chat/route.ts` product search logic may need further adjustments based on the LLM's output for `product_types` and `requested_product_count`.
5.  **Iterative Testing & Simulation (`simulate-chat.ts`):**
    *   Thoroughly test the new architecture by running and expanding `simulate-chat.ts`.
    *   Update test expectations to align with the new Grok-style responses and enhanced capabilities.
    *   Pay close attention to the logs from `isPotentiallyGibberish` to diagnose any remaining issues with inputs like "asdfjkl;".
6.  **Unit Testing (Ongoing):**
    *   Develop Jest unit tests for the new modules (`lib/llm.ts`, `lib/external.ts`) and critical functions in the refactored `app/api/chat/route.ts`.

## 💻 Technology Stack

*   **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
*   **Backend:** Next.js API Routes (Serverless Functions on Vercel)
*   **AI - Language Model:** **Integrated external LLM (e.g., xAI Grok, OpenAI GPT-4, Google Gemini Pro/Flash via API)**
*   **AI - Vector Search:** Upstash Vector (for products and general knowledge base)
*   **Caching & Session Management:** Upstash Redis, LRUCache
*   **E-commerce Platform:** Shopify (Admin API - GraphQL, Storefront API)
*   **External Data:** Placeholder for real-time APIs (e.g., pricing, trends)
*   **Logging:** Pino
*   **Testing:** Jest, `ts-node` for simulation scripts

## ⚙️ Core Mechanisms

### AI & Search: Gemini and Upstash Vector (BM25)
The chatbot uses Google Gemini for intent recognition and Upstash Vector (BM25) for product search. The `app/api/chat/route.ts` API route manages this flow.

### Product Data Structure in Vector Store (Observed)
Analysis of data retrieved from Upstash Vector indicates the following typical structure for product metadata.

```json
{
  "textForBM25": "Jane Iredale ColorLuxe Hydrating Cream Lipstick, BLUSH Rich-yet-weightless...",
  "title": "Jane Iredale ColorLuxe Hydrating Cream Lipstick, BLUSH",
  "handle": "jane-iredale-colorluxe-hydrating-cream-lipstick-blush",
  "vendor": "jane iredale",
  "productType": "", // Often empty or generic like "Personal Care"
  "tags": ["beauty", "skincare"], // Often generic, may not contain specific attributes
  "price": "3400.0", // Note: Appears to be in Pesos (e.g., 3400.00 means ₱3400)
  "imageUrl": "https://...",
  "productUrl": "/products/...",
  "variantId": "gid://shopify/ProductVariant/48182142828749"
  // "id" (Shopify Product GID) is also available from the vector query result itself.
}
```
**Key Observations for Search Logic:**
*   Specific `productType` is often not in the `productType` field. Filtering logic also checks the `title`.
*   Attributes are often found within `textForBM25`. Filtering logic also checks `textForBM25`.

### Shopify Integration
Product synchronization (`app/api/sync-products/route.ts`) populates the vector store. The chat API includes a Shopify GraphQL fallback (`performShopifyGraphQLQuery`).

## 🛠️ Setup & Deployment
(Setup and Deployment instructions remain largely the same as previous versions, focusing on cloning, `npm install`, `.env.local` configuration, and Vercel deployment.)

## 🧪 Testing & Simulation
*   **Jest Unit Tests:** Continue development for new and refactored modules.
*   **Simulation (`simulate-chat.ts`):** Primary tool for E2E testing. Requires updates for new response styles and capabilities. Run with `npx tsc --project tsconfig.json && node dist_sim/simulate-chat.js` (after temporarily setting `noEmit: false` in `tsconfig.json`).

## 🔑 Environment Variables (Essential - Updated)
*   `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
*   `UPSTASH_VECTOR_URL`, `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_TOKEN` (for product index)
*   **`XAI_API_KEY` or `OPENAI_API_KEY` or `GEMINI_API_KEY` (for the chosen LLM)**
*   `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`
*   `MAX_CHAT_HISTORY` (optional, defaults to 10)
*   **`PRICE_API_KEY` (for hypothetical external price API)**
*   *(Potentially separate Vector credentials if using a different Upstash project for the knowledge base)*

## Troubleshooting Tips
*   **Product Search Failures:**
    *   Verify that the `productType` and `attributes` being filtered for exist in the expected fields of products in Upstash Vector.
    *   Ensure price filters in `simulate-chat.ts` account for Pesos.
*   **TypeScript Errors:** A persistent TypeScript error related to boolean type inference for product query checks in `app/api/chat/route.ts` was a major challenge. It is now considered resolved following manual user edits and subsequent refactoring of the conditional logic.

---

This README reflects the current understanding and ongoing efforts to enhance the Planet Beauty AI Chatbot as of May 10, 2025.
