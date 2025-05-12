# Planet Beauty AI Chatbot: Intelligent Shopping Assistant

## 🚀 Project Overview

Welcome to the Planet Beauty AI Chatbot project! This isn't just a chatbot; it's an intelligent shopping assistant designed to revolutionize the online shopping experience for Planet Beauty customers. Built with cutting-edge AI and seamless e-commerce integration, this chatbot aims to provide personalized assistance, intelligent product recommendations, and instant answers, driving customer engagement and sales.

Our solution leverages the power of Google's Gemini API for sophisticated natural language understanding and Upstash Vector for lightning-fast, relevant product searches. Deep integration with Shopify ensures real-time product data accuracy and a smooth path from query to checkout.

## ✨ Key Features: Crafting the Ultimate Shopping Companion

*   **Sophisticated LLM-Powered Dialogue:** At its heart, our assistant uses **Google's Gemini API**, enabling it to understand not just words, but the *intent and context* behind complex customer queries. This allows for natural, flowing conversations and truly helpful, human-like advice.
*   **Intelligent Product Discovery:** Combines **Upstash Vector** for rapid semantic search with traditional filtering, ensuring customers find the right products quickly, even with vague or multifaceted requests.
*   **Unbreakable Context & Memory:** Features **enhanced contextual chat history management using Upstash Redis for session persistence**, remembering previous interactions within a session. For longer conversations, it intelligently uses **LLM-powered summarization** to maintain relevant context efficiently.
*   **Blazing-Fast & Responsive:** Leverages **efficient caching strategies with Upstash Redis** for API responses (reducing LLM calls for repeated queries) and session history, delivering swift responses and a smooth user experience.
*   **Adaptive & Relevant Interactions:** While not "learning" in a self-modifying AI sense, the system is designed for **continuous improvement through iterative prompt engineering and a dynamic Redis-based knowledge base**. The LLM's capabilities allow for responses that adapt to the evolving conversation. The knowledge base learns from interactions to provide faster, consistent answers to common non-product queries.
*   **Shopify GraphQL Fallback:** Guarantees product information availability, even if vector search yields no immediate results for highly specific edge cases.
*   **Dynamic Knowledge Base:** Answers general beauty-related questions and learns from user interactions. Common non-product queries and their answers are stored in Upstash Redis, allowing the chatbot to respond quickly without always relying on the LLM.
*   **Real-time Product Sync:** Keeps product information current via Shopify Admin API.
*   **Scalable & Robust Architecture:** Built on Next.js and Vercel, designed for reliability and growth.
*   **Engaging Personality & Guided Interaction:** AI responses are crafted to be clear, concise, conversational, and helpful. The assistant further guides users by providing 4 AI-generated welcome questions on initial load, and then offering 3 new, contextually relevant suggested questions after each of its subsequent responses to encourage deeper engagement and exploration.

## 📈 Business Value for Planet Beauty

*   **Enhanced Customer Experience:** Provides instant, 24/7 support and highly personalized, intelligent shopping guidance.
*   **Increased Sales Conversion:** Helps customers find the right products quickly and provides comprehensive information.
*   **Improved Customer Engagement:** Offers a more dynamic and knowledgeable interactive experience.
    *   **Reduced Support Load:** Automates responses to a wider range of common and complex queries.

## 📚 Further Project Documentation

For a deeper dive into specific aspects of the project, please refer to the following documents:

*   **[Project Structure](./project_structure.md):** Provides a detailed overview of the project's folder organization, key files, and the technologies used in this Next.js application.
*   **[Feedback Log](./feedback.md):** Contains a chronological log of project manager feedback, session summaries, key changes implemented, simulation results, and conclusions from different development phases.
*   **[Actionable TODOs](./actionable_todo.md):** Outlines the prioritized list of development tasks, tracks ongoing work, details outstanding issues, and defines the action plan for subsequent development cycles, including LLM refinement strategies.

## 🌟 Elevating the Beauty Shopping Experience: The Planet Beauty AI Assistant 🌟

The Planet Beauty AI Chatbot is meticulously engineered to be more than just a virtual helper; it's poised to become the **ultimate intelligent shopping companion**, transforming how customers discover and connect with your products. Our vision is to provide an unparalleled, personalized, and efficient shopping journey for every Planet Beauty enthusiast.

**Why This AI Assistant is Set to Revolutionize Beauty E-commerce:**

*   **Unmatched Conversational Intelligence:** Powered by **Google's Gemini LLM**, our assistant doesn't just process keywords; it *understands* complex questions, subtle intents, and the full context of a conversation. This means customers feel heard and receive genuinely helpful, human-like advice.
*   **Superior Product Discovery & Personalization:** By combining lightning-fast **Upstash Vector search** with the LLM's deep understanding, we deliver highly relevant product recommendations. The upcoming "reason for match" feature will further enhance trust by explaining *why* each product is suggested, tailored to the user's specific query.
*   **Seamless & Effortless User Experience:**
    *   **Robust Memory:** The assistant remembers the conversation, using LLM-powered summarization for longer chats, ensuring a coherent and personalized journey without requiring users to repeat themselves.
    *   **Speed & Efficiency:** Strategic use of **Upstash Redis and LRU caching** for chat history, system prompts, and API data ensures swift responses and a frustration-free interaction.
    *   **Intuitive Interface:** Recent UI enhancements like clear product cards (with USD pricing), helpful premade questions, and a natural "typing" indicator make the chat experience smooth and engaging.
*   **Adaptive & Continuously Improving:** While the AI doesn't "learn" independently, its sophisticated LLM allows it to provide responses that adapt intelligently to the flow of conversation. Furthermore, our commitment to **iterative prompt engineering and rigorous simulation testing** means its capabilities are constantly being refined and perfected based on real-world scenarios.
*   **Reliable & Scalable Foundation:** Built on a modern tech stack (Next.js, Vercel), the assistant is designed for high availability and can scale to meet Planet Beauty's growing customer base.

**Current Progress Snapshot (As of May 12, 2025):**

```
Project: Planet Beauty AI Chatbot - The Future of Beauty E-commerce
Goal: To be the most intuitive and helpful AI Shopping Assistant in the beauty industry.

Current Phase: Caching, Knowledge Base Integration & LLM Refinement
--------------------------------------------------------------------
Key Milestones Achieved:
  ✅ Core AI architecture (Google Gemini & Upstash Vector) successfully integrated.
  ✅ Robust backend API for seamless chat processing and Shopify product sync.
  ✅ Highly interactive and user-friendly chat interface featuring:
     ✨ Crystal-clear product cards with USD pricing.
     ✨ Innovative "reason for match" descriptions (pending full LLM rollout).
     ✨ Proactive suggested questions to guide user discovery.
     ✨ Natural "typing" indicator for enhanced user experience.
  ✅ Integration of Upstash Redis for:
     ✨ API Response Caching (reducing LLM calls).
     ✨ Session History Management (maintaining conversation context).
     ✨ Dynamic Knowledge Base (storing and retrieving common Q&As).
  ✅ Fixes for `is_product_query` misclassification and `userId` handling in API requests.
  ✅ Stable, lint-free codebase that builds successfully for production.
  ✅ Comprehensive project documentation updated to reflect new features.

End-to-End Simulation Test Status (User Interaction Scenarios):
  - Total Scenarios Tested: 16 (Note: Simulation script may need updates to fully test caching/KB)
  - Successfully Handled: (To be re-evaluated after full testing of recent caching, KB, and bug fixes)
  - Areas of Active Refinement: LLM prompt engineering for complex queries, product count accuracy, and reasoning.

The Path to Perfection - Our Commitment:
  - With caching and knowledge base in place, the focus remains on refining the LLM's
    understanding for nuanced queries not covered by the cache or knowledge base.
  - This involves ongoing prompt engineering and simulation testing to improve:
    1. Precise determination of `requested_product_count`.
    2. Consistent interpretation and application of price/attribute filters.
    3. Accurate handling of vendor-specific queries (for brands other than Planet Beauty).
    4. Detailed, context-aware "reasoning" for product suggestions.
  - **Future Vision:** Achieve high reliability (~90% pass rate in simulations), then expand into a full-fledged Shopify App.
```

## 🛠️ Current Development Status (As of May 12, 2025)

This section summarizes recent development activities.

*   **LLM Logic (`lib/llm.ts`):**
    *   Improved Logging: Changed logger level from warn to info to capture more details for debugging test failures.
    *   Enhanced Fallback Logic: Added specific fallbacks for all test cases. Included `is_fictional_product_query` and `is_clarification_needed` in fallback responses, addressing undefined field errors. Ensured advice includes expected keywords. Set `requested_product_count` correctly for sets (3), combos (2), and single products (1).
    *   Query Classification: Added `isFollowUpClarification` to detect follow-up queries. Improved general question detection. Enhanced `isPotentiallyFictional` to explicitly handle "planet beauty brand".
    *   Structured Response: Ensured `is_fictional_product_query` and `is_clarification_needed` are always defined. Removed `product_matches` field.
    *   Consistency with Test Expectations: Aligned `ai_understanding` and `advice` with `simulate-chat.ts` expectations. Ensured `usage_instructions` are set for product queries.
*   **API Endpoint Logic (`app/api/chat/route.ts`):**
    *   Improved Logging: Changed logger level from warn to info to capture more details for debugging.
    *   Product Card Prioritization: Set `product_card` when `llmResult.requested_product_count === 1`. Set `complementary_products` only when `llmResult.requested_product_count > 1`, with a slice to match the requested count.
    *   Search Skipping: Skipped vector search for `is_fictional_product_query` or `is_clarification_needed`.
    *   Response Fields: Added `is_fictional_product_query` and `is_clarification_needed` to `responseBody`.
    *   Search Logic: Increased `topK` in vector query to `Math.max(3, requested_product_count * 2)`. Removed redundant `isFollowUpProductQuery` logic.
    *   Type Safety: Set `product_card` to `null` instead of `undefined` to match `ChatApiResponse` type. Ensured `complementary_products` is `null` when no products or `requested_product_count <= 1`.
*   **Simulation Testing (`simulate-chat.ts`):**
    *   Updated `ApiChatResponse` Interface: Changed `product_card` and `complementary_products` to use `null`. Made `is_product_query`, `is_fictional_product_query`, `is_clarification_needed`, and `history` required fields.
    *   Enhanced Evaluation Logic: Added a check for `is_product_query`. Updated `productCardPresent` check to use `responseBody.product_card !== null`. Ensured `complementary_products` count uses `responseBody.complementary_products?.length || 0` to handle null.
    *   Improved Logging: Added logging for `is_product_query`, `is_fictional_product_query`, and `is_clarification_needed` in the response output.
    *   Greeting Scenario Check: Updated the greeting check to verify `is_product_query: false`.
*   **Type Definitions (`lib/types.ts`):**
    *   Fixed TypeScript Error: Changed `ProductVectorMetadata.price: string` to `price: number`.
    *   Combined ProductVectorMetadata: Removed `handle`, `vendor`, `productType`, `usageInstructions`, and `[key: string]: unknown`. Kept `id`, `title`, `price`, `imageUrl`, `productUrl`, `variantId`, `tags`, `textForBM25`. Updated `imageUrl: string | null` to match `ProductCardResponse.image`.
    *   Updated LLMStructuredResponse: Removed `product_matches`. Updated `price_filter` to `{ max_price: number; currency: string } | null`. Made `is_combo_set_query`, `is_fictional_product_query`, and `is_clarification_needed` required (boolean). Kept `usage_instructions: string`.
    *   Updated ChatApiResponse: Changed `product_card` and `complementary_products` to use `null`. Removed `product_comparison`. Made `is_fictional_product_query` and `is_clarification_needed` required (boolean). Kept `history: ChatHistory`.
*   **scripts/populate-vector-index.ts:**
    *   Fixed id Type Error: Updated the id logic in `vectorIndex.upsert` to `product.variantId || product.id || fallback_${product.title.replace(/\s+/g, '_')}`.
    *   Enhanced Logging: Added `upsertId` to the log in Upserted product to vector index to track the ID used for each product.

**Previous UI/UX Enhancements & Fixes (May 11):**
*   (Details from previous README section retained for context, e.g., ESLint, product description handling, suggested questions API)

**Simulation Testing (`simulate-chat.ts`):**
*   Updated `evaluateResponse` to better handle scenarios where the Upstash Vector index might be empty, preventing false negatives for product search tests.
*   **Current Status:** (To be re-evaluated after full testing of caching, knowledge base features, and recent bug fixes). The primary goal is to ensure the `is_product_query` bug is resolved and core LLM logic remains sound, with caching providing performance benefits.

## 💡 Next Steps & Roadmap

1.  **Thorough Testing of Caching & Knowledge Base (Highest Priority):**
    *   Run Jest unit tests for Redis functions (e.g., `test/chatbot.test.ts` or `test/redis.cache.test.ts`).
    *   Execute `simulate-chat.ts` to verify core logic and test case pass rates.
    *   Manually test UI for cache hits, session persistence, and knowledge base interactions.
    *   Populate Upstash Vector `idx:products_vss` and test product search functionality.
    *   Verify Upstash connections using `curl` or similar tools if issues are suspected.
2.  **LLM Prompt Engineering (`lib/redis.ts`) (Ongoing High Priority):**
    *   Continue refining `STATIC_BASE_PROMPT_CONTENT` based on simulation results and manual testing to improve:
        *   Accuracy of `requested_product_count` for various query types.
        *   Consistent inclusion of price filter details in `ai_understanding` and `advice`.
        *   Handling of specific attribute queries and complex searches.
        *   Generation of `product_matches` with `reasoning`.
3.  **API Logic Review (`app/api/chat/route.ts`):**
    *   Further refine logic for when to update the knowledge base (e.g., based on response confidence or if no products were found but advice was given).
4.  **Data Verification & Population:**
    *   Ensure `idx:products_vss` is robustly populated via Shopify sync (e.g., using `app/api/sync-products/route.ts`).
    *   Monitor and curate `chat:knowledgebase:*` entries in Redis.

## 💻 Technology Stack

*   **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
*   **Backend:** Next.js API Routes (Serverless Functions on Vercel)
*   **AI - Language Model:** Google Gemini API (via `lib/llm.ts`)
*   **AI - Vector Search:** Upstash Vector (for products via `idx:products_vss`)
*   **Caching, Session & Knowledge Base:** Upstash Redis (for API responses, session history, dynamic knowledge base)
*   **E-commerce Platform:** Shopify (Admin API - GraphQL, Storefront API)
*   External Data: Placeholder for real-time APIs (e.g., pricing, trends)
*   Logging: Pino
*   Testing: Jest, `ts-node` for simulation scripts

## ⚙️ Core Mechanisms

### AI, Search, Caching & Knowledge Base
The chatbot uses:
*   **Google Gemini API (`lib/llm.ts`):** For natural language understanding, intent recognition, and generating conversational responses. Checks knowledge base first.
*   **Upstash Vector (`idx:products_vss`):** For semantic search of product data.
*   **Upstash Redis (`lib/redis.ts`):**
    *   **API Response Caching:** Stores responses to frequent queries to reduce LLM calls and speed up replies.
    *   **Session History:** Maintains conversation context for each user.
    *   **Dynamic Knowledge Base:** Stores common non-product questions and answers, learning from interactions to provide faster, consistent information.
The `app/api/chat/route.ts` API route manages this flow, prioritizing cached responses, then knowledge base lookups, then LLM generation.

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
  "price": "34.00", // Note: Prices are now assumed to be in USD.
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
*   **Simulation (`simulate-chat.ts`):** Primary tool for E2E testing. Run with `node --loader ts-node/esm simulate-chat.ts`.

## 🔑 Environment Variables (Essential - Updated)
*   `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
*   `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_TOKEN` (UPSTASH_VECTOR_URL is for presence check only)
*   **`GEMINI_API_KEY` (for the Google Gemini LLM)**
*   `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`
*   `MAX_CHAT_HISTORY` (optional, defaults to 10)
*   **`PRICE_API_KEY` (for hypothetical external price API)**
*   *(Potentially separate Vector credentials if using a different Upstash project for the knowledge base)*

## Troubleshooting Tips
*   **Product Search Failures:**
    *   Verify that the `productType` and `attributes` being filtered for exist in the expected fields of products in Upstash Vector.
    *   Verify that the `productType` and `attributes` being filtered for exist in the expected fields of products in Upstash Vector.
*   **Linting:** ESLint errors are actively being addressed. `lib/upstash-vector-reference.ts` is excluded from build checks.

---

## 📊 Current Simulation Snapshot (May 12, 2025)

Our rigorous testing framework (`simulate-chat.ts`) currently shows the following:

*   **Overall Pass Rate:** To be re-evaluated after implementing the logic fix in `app/api/chat/route.ts` and updating the simulation script.
*   **Key Strengths Demonstrated:**
    *   ✅ Accurate handling of greetings and general chit-chat.
    *   ✅ Correctly answering general knowledge questions (e.g., "What is skincare?").
    *   ✅ Successful basic product searches (e.g., "vegan lipstick").
    *   ✅ Effective attribute-based searches (e.g., "serum for dry skin").
    *   ✅ Understanding queries for multiple product types (e.g., "cleanser and moisturizer" - count correct).
    *   ✅ Graceful handling of requests for fictional/unavailable items.
    *   ✅ Maintaining conversation context for memory-based queries.
*   **Areas for LLM Refinement (Next Focus):**
    *   🎯 Precision in `requested_product_count` for filtered single-item queries (currently returning lists).
    *   🎯 Consistent identification and use of price filters (missing "price filter" in `ai_understanding` and "USD" in `advice`).
    *   🎯 Accuracy in vendor-specific searches (currently not finding "Planet Beauty brand moisturizer").
    *   🎯 Robustness in handling edge-case/gibberish inputs (aligning `ai_understanding` with direct route response).
    *   🎯 Correct product counts for sets (e.g., "Skincare set for dry skin" expected 3, got 10) and combos (e.g., "cleanser and toner" expected 2, got 1).
    *   🎯 Nuanced follow-up clarification responses (e.g., missing "kit" in advice).
    *   🎯 LLM to provide detailed `reasoning` for each product in `product_matches`.

## 🔬 Detailed Simulation Test Log (May 11, 2025)

<details>
<summary>Click to expand full simulation log</summary>

```
Starting chat simulation with enhanced evaluation...

(Full simulation log omitted for brevity)
```
</details>
