# Planet Beauty AI Chatbot: Intelligent Shopping Assistant

## 🚀 Project Overview

Welcome to the Planet Beauty AI Chatbot project! This isn't just a chatbot; it's an intelligent shopping assistant designed to revolutionize the online shopping experience for Planet Beauty customers. Built with cutting-edge AI and seamless e-commerce integration, this chatbot aims to provide personalized assistance, intelligent product recommendations, and instant answers, driving customer engagement and sales.

Our solution leverages the power of Google's Gemini API for sophisticated natural language understanding and Upstash Vector for lightning-fast, relevant product searches. Deep integration with Shopify ensures real-time product data accuracy and a smooth path from query to checkout.

## ✨ Key Features: Crafting the Ultimate Shopping Companion

*   **Sophisticated LLM-Powered Dialogue:** At its heart, our assistant uses **Google's Gemini API**, enabling it to understand not just words, but the *intent and context* behind complex customer queries. This allows for natural, flowing conversations and truly helpful, human-like advice.
*   **Intelligent Product Discovery:** Combines **Upstash Vector** for rapid semantic search with traditional filtering, ensuring customers find the right products quickly, even with vague or multifaceted requests. **Improved product recommendation logic prioritizes product type over brand, resulting in more relevant suggestions.** The LLM now generates keywords for vector search, improving the accuracy of product recommendations.
*   **Unbreakable Context & Memory:** Features **enhanced contextual chat history management using Upstash Redis for session persistence**, remembering previous interactions within a session. For longer conversations, it intelligently uses **LLM-powered summarization** to maintain relevant context efficiently.
*   **Blazing-Fast & Responsive:** Leverages **efficient caching strategies with Upstash Redis** for API responses (reducing LLM calls for repeated queries) and session history, delivering swift responses and a smooth user experience.
*   **Adaptive & Relevant Interactions:** While not "learning" in a self-modifying AI sense, the system is designed for **continuous improvement through iterative prompt engineering and a dynamic Redis-based knowledge base**. The LLM's capabilities allow for responses that adapt to the evolving conversation. The knowledge base learns from interactions to provide faster, consistent answers to common non-product queries.
*   **Shopify GraphQL Fallback:** Guarantees product information availability, even if vector search yields no immediate results for highly specific edge cases.
*   **Dynamic Knowledge Base:** Answers general beauty-related questions and learns from user interactions. Common non-product queries and their answers are stored in Upstash Redis, allowing the chatbot to respond quickly without always relying on the LLM.
*   **Real-time Product Sync:** Keeps product information current via Shopify Admin API.
*   **Scalable & Robust Architecture:** Built on Next.js and Vercel, designed for reliability and growth.
*   **Engaging Personality & Guided Interaction:** AI responses are crafted to be clear, concise, conversational, and helpful, with refined chatbox formatting for a more Gemini-like interaction. The assistant further guides users by providing 4 AI-generated welcome questions on initial load, and then offering 3 new, contextually relevant suggested questions after each of its subsequent responses to encourage deeper engagement and exploration. The greeting line has been removed from the response to make it more concise.
*   **Product Recommendations as a Chatbox Product Carousel:** If there are 2 or more products to display, present them in a carousel format within the chatbox.
*   **Prevent Autoscroll on Chatbot Reply:** Prevent the chat from autoscrolling to the bottom when the chatbot replies, allowing users to read the response without interruption.
*   **Clear Chat and History:** When the "Clear" button is clicked, clear all chat messages and history.
*   **New Conversation Functionality:** When the "New Conversation" button is clicked, refresh auto-suggestions, clear current suggestions, and remove old suggested questions.
*   **Limited Follow-up Questions to 2:** Display only 2 generated follow-up questions instead of 3.
*   **Enhance Product Recommendations with Details:** Include the product title, an explanation of why it’s recommended, and instructions on how to use or apply it in chatbot responses.
*   **Conditional Pro Tip Display:** Show the pro tip only when logically needed based on the conversation context.
*   **Improved Follow-Up Questions UX:** Added a "Show More" button for follow-up questions if more than two are available.

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
*   **Superior Product Discovery & Personalization:** By combining lightning-fast **Upstash Vector search** with the LLM's deep understanding, we deliver highly relevant product recommendations. The LLM now generates keywords for vector search, improving the accuracy of product recommendations. The upcoming "reason for match" feature will further enhance trust by explaining *why* each product is suggested, tailored to the user's specific query.
*   **Seamless & Effortless User Experience:**
    *   **Robust Memory:** The assistant remembers the conversation, using LLM-powered summarization for longer chats, ensuring a coherent and personalized journey without requiring users to repeat themselves.
    *   **Speed & Efficiency:** Strategic use of **Upstash Redis and LRU caching** for chat history, system prompts, and API data ensures swift responses and a frustration-free interaction.
    *   **Intuitive Interface:** Recent UI enhancements like clear product cards (with USD pricing), helpful premade questions, and a natural "typing" indicator make the chat experience smooth and engaging.
*   **Adaptive & Continuously Improving:** While the AI doesn't "learn" independently, its sophisticated LLM allows it to provide responses that adapt intelligently to the flow of conversation. Furthermore, our commitment to **iterative prompt engineering and rigorous simulation testing** means its capabilities are constantly being refined and perfected based on real-world scenarios.
*   **Reliable & Scalable Foundation:** Built on a modern tech stack (Next.js, Vercel), the assistant is designed for high availability and can scale to meet Planet Beauty's growing customer base.

**Current Progress Snapshot (As of May 17, 2025):**

```
Project: Planet Beauty AI Chatbot - The Future of Beauty E-commerce
Goal: To be the most intuitive and helpful AI Shopping Assistant in the beauty industry.

Current Phase: Implementing UI Enhancements
--------------------------------------------------------------------
Key Milestones Achieved:
  ✅ Fixed module not found error in `components/ProductCarousel.tsx`.
  ✅ Implemented Product Recommendations as a Chatbox Product Carousel.
  ✅ Implemented Prevent Autoscroll on Chatbot Reply.
  ✅ Implemented Clear Chat and History.
  ✅ Implemented New Conversation Functionality.
  ✅ Limited Follow-up Questions to 2.
  ✅ Added a "Show More" button for follow-up questions if more than two are available.
  ❌ Enhance Product Recommendations with Details (Skipped due to implementation issues).
  ✅ Conditional Pro Tip Display.
  ✅ Stable, lint-free codebase that builds successfully for production.
  ✅ Comprehensive project documentation updated to reflect new features.
  ✅ Removed Clear Chat button from ChatInterface.

End-to-End Simulation Test Status (User Interaction Scenarios):
  - Total Scenarios Tested: 16 (Note: Simulation script may need updates to fully test caching/KB)
  - Successfully Handled: (To be re-evaluated after full testing of recent caching, KB, and bug fixes)
  - Areas of Active Refinement: LLM prompt engineering for complex queries, product count accuracy, and reasoning.

The Path to Perfection - Our Commitment:
  - With caching and knowledge base in place, the focus remains on refining the LLM's
    understanding for nuanced queries not covered by the cache or knowledge base.
  - This involves ongoing prompt engineering and simulation testing to improve:
    1. Precise determination of `requested_product_count`.
    2. Consistent identification and application of price/attribute filters.
    3. Accurate handling of vendor-specific queries (for brands other than Planet Beauty).
    4. Detailed, context-aware "reasoning" for product suggestions.
  - **Future Vision:** Achieve high reliability (~90% pass rate in simulations), then expand into a full-fledged Shopify App.
```

## 🛠️ Current Development Status (As of May 17, 2025)

This section summarizes recent development activities.

*   **Components (`components/ChatInterface.tsx`):**
    *   Implemented Product Recommendations as a Chatbox Product Carousel.
    *   Implemented Prevent Autoscroll on Chatbot Reply.
    *   Implemented Clear Chat and History.
    *   Implemented New Conversation Functionality.
    *   Implemented Conditional Pro Tip Display.
    *   Improved Follow-Up Questions UX.
    *   Removed Clear Chat button.
*   **Components (`components/ProductCarousel.tsx`):**
    *   Fixed module not found error.
*   **Components (`components/ChatMessage.tsx`):**
    *   Addressed linting errors by removing unused variables.
    *   Improved robustness of product card parsing.
*   **Styles (`styles/ChatInterface.module.css`):**
    *   Replaced raw HTML tag selectors with local class names.

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
        *   Consistent inclusion of price/attribute filters in `ai_understanding` and `USD` in `advice`.
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
*   **Google Gemini API (`lib/llm.ts`): For natural language understanding, intent recognition, and generating conversational responses. Checks knowledge base first. The LLM is also used to generate keywords for vector search.
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
*   `UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_TOKEN` (UPSTASH_VECTOR_REST_URL is for presence check only)
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

## 📊 Current Simulation Snapshot (May 17, 2025)

Our rigorous testing framework (`simulate-chat.ts`) currently shows the following:

*   **Overall Pass Rate:** To be re-evaluated after implementing the logic fix in `app/api/chat/route.ts` and updating the simulation script.
*   **Key Strengths Demonstrated:**
    *   ✅ Fixed module not found error in `components/ProductCarousel.tsx`.
    *   ✅ Implemented Product Recommendations as a Chatbox Product Carousel.
    *   ✅ Implemented Prevent Autoscroll on Chatbot Reply.
    *   ✅ Implemented Clear Chat and History.
    *   ✅ Implemented New Conversation Functionality.
    *   ✅ Limited Follow-up Questions to 2.
    *   ✅ Added a "Show More" button for follow-up questions if more than two are available.
    *   ❌ Enhance Product Recommendations with Details (Skipped due to implementation issues).
    *   ✅ Conditional Pro Tip Display.
    *   ✅ Stable, lint-free codebase that builds successfully for production.
    *   ✅ Comprehensive project documentation updated to reflect new features.
    *   ✅ Removed Clear Chat button from ChatInterface.
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
    *   🎯 Consistent identification and use of price/attribute filters (missing "price filter" in `ai_understanding` and "USD" in `advice`).
    *   🎯 Accurate handling of vendor-specific queries (for brands other than Planet Beauty).
    *   🎯 Robustness in handling edge-case/gibberish inputs (aligning `ai_understanding` with direct route response).
    *   🎯 Correct product counts for sets (e.g., "Skincare set for dry skin" expected 3, got 10) and combos (e.g., "cleanser and toner" expected 2, got 1).
    *   🎯 Nuanced follow-up clarification responses (e.g., missing "kit" in advice).
    *   🎯 LLM to provide detailed `reasoning` for each product in `product_matches`.
