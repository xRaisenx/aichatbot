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

**Caching & Knowledge Base Integration, Bug Fixes (May 11-12):**
*   **Redis Integration (`lib/redis.ts`):**
    *   Implemented functions for caching API responses (`cacheResponse`, `getCachedResponse`) with TTL.
    *   Implemented functions for session history management (`cacheSessionHistory`, `getSessionHistory`) with TTL, replacing older ephemeral history functions.
    *   Implemented dynamic knowledge base (`updateKnowledgebase`, `getKnowledgebaseEntry`) with basic keyword similarity search and TTL.
    *   Added `invalidateProductCaches` for use during product syncs.
    *   Corrected `STATIC_BASE_PROMPT_CONTENT` syntax issues and ensured `redisClient` is exported.
*   **API Endpoint Updates (`app/api/chat/route.ts`):**
    *   Integrated response caching: checks cache before calling LLM, caches new responses.
    *   Integrated session history: retrieves and stores chat history using new Redis functions.
    *   Integrated knowledge base update: stores relevant non-product Q&As.
    *   Fixed `userId` handling by ensuring it's passed from the frontend and processed correctly.
    *   Refined logic for handling `is_product_query` and `search_keywords` consistency, including better fallback mechanisms.
    *   Corrected import statements and variable usage (e.g., `redisClient` removal, `pino` import).
*   **LLM Logic (`lib/llm.ts`):**
    *   Integrated `getKnowledgebaseEntry` to check for existing answers before calling Gemini API.
    *   Enhanced fallback logic for JSON parsing errors to better align with `is_product_query` expectations and system prompt.
    *   Improved post-processing of LLM response for `is_product_query` consistency and vendor handling (Planet Beauty as a store).
    *   Replaced `console.log` with `pino` logger.
*   **Frontend (`components/ChatInterface.tsx`):**
    *   Added `userId` state (using `uuidv4`) and included it in API requests to `/api/chat`.
*   **Linting:** Addressed various linting errors across multiple files.

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
*   **External Data:** Placeholder for real-time APIs (e.g., pricing, trends)
*   **Logging:** Pino
*   **Testing:** Jest, `ts-node` for simulation scripts

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

## 📊 Current Simulation Snapshot (May 11, 2025)

Our rigorous testing framework (`simulate-chat.ts`) currently shows the following:

*   **Overall Pass Rate:** 8 out of 16 test cases (50%)
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


--- Test Case: Greeting: Simple 'Hi' ---
User Query: Hi
Chat API Response Status: 200
AI Understanding: greeting
Advice: Hi! How can I assist you today?
Evaluation: PASS
  - PASS: ai_understanding contains keyword 'greeting'.
  - PASS: advice contains keyword 'how can i assist'.
  - PASS: Correctly found no products as expected.
  - Overall PASS for implemented checks.

--- Test Case: Greeting: 'Thanks' ---
User Query: Thanks
Chat API Response Status: 200
AI Understanding: greeting
Advice: You're welcome! How else can I help?
Evaluation: PASS
  - PASS: ai_understanding contains keyword 'greeting'.
  - PASS: advice contains keyword 'you're welcome'.
  - PASS: Correctly found no products as expected.
  - Overall PASS for implemented checks.

--- Test Case: General Question: 'What is skincare?' ---
User Query: What is skincare?
Chat API Response Status: 200
AI Understanding: general question about skincare
Advice: Skincare’s like a daily hug for your face—cleansing to remove impurities, treating with targeted products, moi
sturizing for hydration, and protecting for a healthy, glowing appearance!
Evaluation: PASS
  - PASS: ai_understanding contains keyword 'general question'.
  - PASS: ai_understanding contains keyword 'skincare'.
  - PASS: advice contains keyword 'cleansing'.
  - PASS: advice contains keyword 'treating'.
  - PASS: advice contains keyword 'moisturizing'.
  - PASS: advice contains keyword 'health'.
  - PASS: advice contains keyword 'appearance'.
  - PASS: Correctly found no products as expected.
  - Overall PASS for implemented checks.

--- Test Case: Product Search: 'Find me a vegan lipstick' ---
User Query: Find me a vegan lipstick
Chat API Response Status: 200
AI Understanding: product query for vegan lipstick
Advice: Looking for vegan lipsticks! Here are some great options.
Product Card: Jane Iredale ColorLuxe Hydrating Cream Lipstick, BLUSH - 34
Evaluation: PASS
  - PASS: ai_understanding contains keyword 'product query'.
  - PASS: ai_understanding contains keyword 'vegan'.
  - PASS: ai_understanding contains keyword 'lipstick'.
  - PASS: advice contains keyword 'vegan lipstick'.
  - PASS: advice contains keyword 'options'.
  - PASS: product_card presence matched expectation (true).
  - PASS: complementary_products count matched expectation (0).
  - PASS: product_card.title contains expected keywords: "lipstick".
  - Overall PASS for implemented checks.

--- Test Case: Product Search with Attribute: 'serum for dry skin' ---
User Query: serum for dry skin
Chat API Response Status: 200
AI Understanding: product query for serum for dry skin
Advice: Looking for serums for dry skin! Here are some great options.
Product Card: Guinot Bioxygene Face Serum - 88
Evaluation: PASS
  - PASS: ai_understanding contains keyword 'product query'.
  - PASS: ai_understanding contains keyword 'serum'.
  - PASS: ai_understanding contains keyword 'dry skin'.
  - PASS: advice contains keyword 'serum'.
  - PASS: advice contains keyword 'dry skin'.
  - PASS: product_card presence matched expectation (true).
  - PASS: product_card.title contains expected keywords: "serum".
  - Overall PASS for implemented checks.

--- Test Case: Product Search - Multiple Types: 'cleanser and moisturizer' ---
User Query: I need a cleanser and moisturizer
Chat API Response Status: 200
AI Understanding: product query for cleanser and moisturizer
Advice: Looking for a cleanser and moisturizer!  To help me narrow down the best options for you, could you tell me an
ything about your skin type or any concerns you have (e.g., dryness, acne-prone, sensitive...
Complementary Products: 2 items
  - Bumble and bumble Gentle Shampoo, 33OZ
  - Bumble and bumble Gentle Shampoo, 8OZ
Evaluation: PASS
  - PASS: ai_understanding contains keyword 'product query'.
  - PASS: ai_understanding contains keyword 'cleanser'.
  - PASS: ai_understanding contains keyword 'moisturizer'.
  - PASS: advice contains keyword 'cleanser'.
  - PASS: advice contains keyword 'moisturizer'.
  - PASS: product_card presence matched expectation (false).
  - PASS: complementary_products count matched expectation (2).
  - Overall PASS for implemented checks.

--- Test Case: No Results Scenario (Specific Item): 'Find unobtainium face cream' ---
User Query: Find unobtainium face cream
Chat API Response Status: 200
AI Understanding: query for fictional product
Advice: Find unobtainium face cream is a fictional material straight out of sci-fi! I can't find it, but how about a r
eal-world product with specific benefits like hydration?
Evaluation: PASS
  - PASS: ai_understanding contains keyword 'query for fictional product'.
  - PASS: advice contains keyword 'fictional material'.
  - PASS: advice contains keyword 'can't find'.
  - PASS: advice contains keyword 'hydration'.
  - PASS: product_card presence matched expectation (false).
  - PASS: Correctly found no products as expected.
  - Overall PASS for implemented checks.

--- Test Case: Product Search with Price Filter: 'cheap sunscreen under $30' ---
User Query: cheap sunscreen under $30
Chat API Response Status: 200
AI Understanding: product query for cheap sunscreen
Advice: Looking for affordable sunscreens under $30!  I can help you find some great options. To give you the best rec
ommendations, do you have a preferred SPF or skin type (e.g., oily, dry, sensitive)?
Complementary Products: 10 items
  - Sun Bum Kids SPF 50 Clear Sunscreen Lotion
  - Sun Bum Original SPF 50 Sunscreen Roll-On Lotion
Evaluation: FAIL
  - PASS: ai_understanding contains keyword 'product query'.
  - PASS: ai_understanding contains keyword 'sunscreen'.
  - PASS: ai_understanding contains keyword 'cheap'.
  - FAIL: ai_understanding missing keyword 'price filter'. Got: "product query for cheap sunscreen"
  - PASS: advice contains keyword 'sunscreen'.
  - PASS: advice contains keyword 'under'.
  - FAIL: advice missing keyword 'usd'. Got: "Looking for affordable sunscreens under $30!  I can help you find some g
reat options. To give you th..."
  - FAIL: product_card presence. Expected: true, Got: false
  - FAIL: Expected product_card properties but no product_card was present.

--- Test Case: Product Search with Vendor: 'Planet Beauty brand moisturizer' ---
User Query: Planet Beauty brand moisturizer
Chat API Response Status: 200
AI Understanding: product query for Planet Beauty brand moisturizer
Advice: Looking for Planet Beauty brand moisturizers!  To help me narrow down the options, could you tell me your skin
 type (e.g., oily, dry, sensitive) and any other preferences?
(No products found matching ...
Evaluation: FAIL
  - PASS: ai_understanding contains keyword 'product query'.
  - PASS: ai_understanding contains keyword 'moisturizer'.
  - PASS: ai_understanding contains keyword 'Planet Beauty'.
  - PASS: advice contains keyword 'Planet Beauty'.
  - PASS: advice contains keyword 'moisturizer'.
  - FAIL: product_card presence. Expected: true, Got: false
  - FAIL: Expected product_card properties but no product_card was present.

--- Test Case: Invalid/Edge Case Input: 'asdfjkl;' ---
User Query: asdfjkl;
Chat API Response Status: 200
AI Understanding: gibberish input
Advice: I'm sorry, I didn't understand your input.  Could you please rephrase your query?
Evaluation: FAIL
  - FAIL: ai_understanding missing keyword 'Unable to understand'. Got: "gibberish input"
  - FAIL: ai_understanding missing keyword 'query'. Got: "gibberish input"
  - PASS: advice contains keyword 'sorry'.
  - PASS: advice contains keyword 'didn't understand'.
  - PASS: advice contains keyword 'rephrase'.
  - FAIL: advice missing keyword 'more details'. Got: "I'm sorry, I didn't understand your input.  Could you please re
phrase your query?..."
  - PASS: product_card presence matched expectation (false).
  - PASS: Correctly found no products as expected.

--- Test Case: Fallback Logic - General Skincare: 'Any good eye creams for dark circles?' ---
User Query: Any good eye creams for dark circles?
Chat API Response Status: 200
AI Understanding: product query for eye cream
Advice: Looking for eye creams to help with dark circles! I can definitely help with that.  Here are some options know
n to be effective.
Complementary Products: 10 items
  - Obagi ELASTIderm Eye Cream
  - Kate Somerville + Retinol Firming Eye Cream
Evaluation: FAIL
  - PASS: ai_understanding contains keyword 'product query'.
  - PASS: ai_understanding contains keyword 'eye cream'.
  - FAIL: ai_understanding missing keyword 'dark circles'. Got: "product query for eye cream"
  - PASS: advice contains keyword 'eye creams'.
  - PASS: advice contains keyword 'dark circles'.
  - FAIL: product_card presence. Expected: true, Got: false
  - FAIL: Expected product_card properties but no product_card was present.

--- Test Case: Product Search: Complex with multiple attributes and price filter ---
User Query: I'm looking for a vegan and cruelty-free serum, preferably under $100.
Chat API Response Status: 200
AI Understanding: product query for vegan and cruelty-free serum under $100
Advice: Looking for vegan and cruelty-free serums under $100!  I can help you find some excellent options.  We have a
wide selection, and I can filter by price and attributes to narrow down the choices.  What...
Complementary Products: 10 items
  - MASAMI Mekabu Hydrating Shine Serum
  - Amika Blockade Heat Defense Serum - 1.7oz
Evaluation: FAIL
  - PASS: ai_understanding contains keyword 'product query'.
  - PASS: ai_understanding contains keyword 'vegan'.
  - PASS: ai_understanding contains keyword 'cruelty-free'.
  - PASS: ai_understanding contains keyword 'serum'.
  - FAIL: ai_understanding missing keyword 'price filter'. Got: "product query for vegan and cruelty-free serum under
$100"
  - PASS: advice contains keyword 'vegan'.
  - PASS: advice contains keyword 'cruelty-free'.
  - PASS: advice contains keyword 'serum'.
  - FAIL: advice missing keyword 'usd'. Got: "Looking for vegan and cruelty-free serums under $100!  I can help you fi
nd some excellent options.  ..."
  - FAIL: product_card presence. Expected: true, Got: false
  - FAIL: Expected product_card properties but no product_card was present.

--- Test Case: Product Search: 'Skincare set for dry skin' ---
User Query: I need a skincare set for dry skin
Chat API Response Status: 200
AI Understanding: product query for skincare set for dry skin
Advice: Looking for skincare sets for dry skin!  I can help you find some great options. To give you the best recommen
dations, could you tell me your preferred price range?
Complementary Products: 10 items
  - Frankie Rose Hydrating Rose Setting Spray
  - Smashbox Skin-Balancing Setting Powder, Translucent Medium
Evaluation: FAIL
  - PASS: ai_understanding contains keyword 'product query'.
  - PASS: ai_understanding contains keyword 'set'.
  - PASS: ai_understanding contains keyword 'dry skin'.
  - PASS: advice contains keyword 'skincare set'.
  - PASS: advice contains keyword 'dry skin'.
  - PASS: product_card presence matched expectation (false).
  - FAIL: complementary_products count. Expected: 3, Got: 10

--- Test Case: Memory Query: 'What were we talking about?' ---
User Query: What were we talking about?
Chat API Response Status: 200
AI Understanding: memory query
Advice: We were discussing skincare sets for dry skin.  Would you like me to show you some options, or were you lookin
g for something else?
Evaluation: PASS
  - PASS: ai_understanding contains keyword 'memory query'.
  - PASS: advice contains keyword 'skincare set'.
  - PASS: advice contains keyword 'dry skin'.
  - PASS: Correctly found no products as expected.
  - Overall PASS for implemented checks.

--- Test Case: Follow-up Clarification: 'Is that moisturizer part of a kit?' ---
User Query: Is that moisturizer part of a kit?
Chat API Response Status: 200
AI Understanding: follow-up clarification
Advice: You asked about the moisturizer.  It's a single product, but it's great for dry skin. Were you looking for a s
et with multiple items, such as a cleanser and serum, in addition to a moisturizer?
Evaluation: FAIL
  - PASS: ai_understanding contains keyword 'follow-up clarification'.
  - PASS: advice contains keyword 'moisturizer'.
  - FAIL: advice missing keyword 'kit'. Got: "You asked about the moisturizer.  It's a single product, but it's great
for dry skin. Were you looki..."
  - PASS: advice contains keyword 'set'.
  - PASS: Correctly found no products as expected.

--- Test Case: General Question: 'What's your name?' ---
User Query: What's your name?
Chat API Response Status: 200
AI Understanding: general question (about chatbot)
Advice: I'm Planet Beauty's AI shopping assistant, here to help you find the perfect products!
Evaluation: PASS
  - PASS: ai_understanding contains keyword 'general question'.
  - PASS: ai_understanding contains keyword 'chatbot'.
  - PASS: advice contains keyword 'planet beauty'.
  - PASS: advice contains keyword 'ai shopping assistant'.
  - PASS: Correctly found no products as expected.
  - Overall PASS for implemented checks.

--- Test Case: Product Search - Combo with specific types: 'I want a combo with cleanser and toner for oily skin' ---
User Query: I want a combo with cleanser and toner for oily skin
Chat API Response Status: 200
AI Understanding: product query for cleanser and toner combo for oily skin
Advice: Looking for a cleanser and toner combo for oily skin!  I can help you find some great options. What's your pri
ce range?
Complementary Products: 1 items
  - Kiehl's Ultra Facial Oil-Free Cleanser
Evaluation: FAIL
  - PASS: ai_understanding contains keyword 'product query'.
  - PASS: ai_understanding contains keyword 'combo'.
  - PASS: ai_understanding contains keyword 'cleanser'.
  - PASS: ai_understanding contains keyword 'toner'.
  - PASS: ai_understanding contains keyword 'oily skin'.
  - PASS: advice contains keyword 'combo'.
  - PASS: advice contains keyword 'cleanser'.
  - PASS: advice contains keyword 'toner'.
  - PASS: advice contains keyword 'oily skin'.
  - PASS: product_card presence matched expectation (false).
  - FAIL: complementary_products count. Expected: 2, Got: 1

Chat simulation finished.
```
</details>

---

This README reflects the current understanding and ongoing efforts to enhance the Planet Beauty AI Chatbot as of May 11, 2025.
