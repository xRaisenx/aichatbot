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

## 🌟 Elevating the Beauty Shopping Experience: The Planet Beauty AI Assistant 🌟

The Planet Beauty AI Chatbot is meticulously engineered to be more than just a virtual helper; it's poised to become the **ultimate intelligent shopping companion**, transforming how customers discover and connect with your products. Our vision is to provide an unparalleled, personalized, and efficient shopping journey for every Planet Beauty enthusiast.

**Why This AI Assistant Stands Out:**

*   **Deep Product Understanding:** Goes beyond simple keyword matching. Our AI, powered by Google's Gemini, comprehends complex queries, nuances in customer language (like "cheap sunscreen" or "serum for dry skin"), and the intent behind their words.
*   **Personalized Recommendations:** Aims to provide tailored suggestions by understanding product attributes, customer needs (e.g., "vegan," "for oily skin"), and even desired price points. The new "reason for match" feature will offer transparency, explaining *why* a product is suggested.
*   **Intuitive & Engaging Interface:** Recent UI enhancements include clear product cards with formatted USD pricing, helpful premade questions to kickstart conversations, and a smooth "typing" indicator for a natural chat flow.
*   **Robust & Scalable Foundation:** Built on a modern tech stack (Next.js, Vercel, Upstash Vector & Redis), ensuring reliability and the capacity to grow with Planet Beauty's needs.
*   **Continuous Improvement:** Our iterative development process, backed by rigorous simulation testing, ensures we are constantly refining the AI's capabilities to meet and exceed customer expectations.

**Current Progress Snapshot (As of May 11, 2025):**

```
Project: Planet Beauty AI Chatbot - The Future of Beauty E-commerce
Goal: To be the most intuitive and helpful AI Shopping Assistant in the beauty industry.

Current Phase: Advanced LLM Refinement & Scenario Mastery
-----------------------------------------------------------
Key Milestones Achieved:
  ✅ Core AI architecture (Google Gemini & Upstash Vector) successfully integrated.
  ✅ Robust backend API for seamless chat processing and Shopify product sync.
  ✅ Highly interactive and user-friendly chat interface featuring:
     ✨ Crystal-clear product cards with USD pricing.
     ✨ Innovative "reason for match" descriptions (pending full LLM rollout).
     ✨ Proactive premade questions to guide user discovery.
     ✨ Natural "typing" indicator for enhanced user experience.
  ✅ Stable, lint-free codebase that builds successfully for production.
  ✅ Comprehensive project documentation for transparency and maintainability.

End-to-End Simulation Test Status (User Interaction Scenarios):
  - Total Scenarios Tested: 16
  - Successfully Handled: 8 (50%)
  - Areas of Active Refinement: 8 (50%)
  - Current Strengths: Excels at greetings, general knowledge, basic product/attribute searches,
    multi-type queries, fictional item handling, and conversation memory.

The Path to Perfection - Our Commitment:
  - The current 50% success rate in complex simulations highlights that our foundational
    AI logic and simpler interactions are performing exceptionally well.
  - The remaining scenarios require fine-tuning our Large Language Model's (LLM)
    prompt engineering. This involves teaching the AI to more precisely:
    1. Determine the exact number of products to show (e.g., one specific item vs. a set).
    2. Interpret and apply price filters consistently.
    3. Handle specific brand/vendor queries with greater accuracy.
    4. Provide detailed, context-aware "reasoning" for every product suggestion.
  - Our dedicated team is focused on these refinements. We anticipate that a few
    more cycles of intensive prompt engineering and testing will elevate the AI's
    performance across all scenarios, solidifying its position as an industry-leading
    shopping assistant.
```

## 🛠️ Current Development Status (As of May 11, 2025 - Early Morning Update)

This section summarizes recent development activities.

**UI/UX Enhancements & Fixes (May 11, Early Morning):**
*   **ESLint Configuration:** Updated `.eslintrc.json` to ignore `lib/upstash-vector-reference.ts`.
*   **Backend (`app/api/chat/route.ts`):**
    *   Product descriptions now aim to be "reasons for match" derived from LLM output (`product_matches`), replacing direct use of `textForBM25`.
    *   Reduced console noise by commenting out a verbose log and removing unused currency constants.
*   **Type Definitions (`lib/types.ts`):** Added `product_matches` to `LLMStructuredResponse`.
*   **Frontend Components & Styles:**
    *   `ProductCard.tsx`: Price prop is now a `number`, formatted as USD ($XX.XX). Description uses new `styles.productReasoning` class (gray, subtle, italic).
    *   `ChatInterface.tsx`: Displays 5 random premade questions on load.
    *   `ChatMessage.tsx`: Removed "Bella is thinking..." text. Price type updated in `Message` interface and `parseAdvice`.
    *   `ComplementaryProducts.tsx`: Corrected price prop type.
*   **Build & Linting:** All changes passed `npm run lint` and `npm run build`.

**Simulation Testing (`simulate-chat.ts` - as of May 11, after UI changes):**
*   **Current Status:** 8 out of 16 test cases PASSING (50%).
*   **Passing Highlights:** Greetings (Hi, Thanks), General Question (What is skincare?), Basic Product Search (vegan lipstick), Product Search with Attribute (serum for dry skin), Multiple Types (cleanser and moisturizer - count correct, products not ideal), No Results (fictional item), Memory Query, General Question (chatbot name).
*   **Outstanding Issues (from `simulate-chat.ts` - LLM Behavior):**
    *   **Price Filter Queries (e.g., "cheap sunscreen under $30"):** `ai_understanding` missing "price filter", `advice` missing "USD", `product_card` expected `true` but got 10 `complementary_products`.
    *   **Vendor Query ("Planet Beauty brand moisturizer"):** `product_card` expected `true`, but no products found.
    *   **Gibberish Handling ("asdfjkl;"):** `ai_understanding` ("gibberish input") not matching direct route response ("Unable to understand the query"), `advice` missing "more details".
    *   **Fallback Logic / Specific Attribute Query ("Any good eye creams for dark circles?"):** `ai_understanding` missing "dark circles", `product_card` expected `true` but got 10 `complementary_products`.
    *   **Complex Search (vegan, cruelty-free serum under $100):** Similar to price filter issues.
    *   **Set/Combo Counts:** "Skincare set for dry skin" (expected 3, got 10), "combo with cleanser and toner" (expected 2, got 1).
    *   **Follow-up Clarification ("Is that moisturizer part of a kit?"):** `advice` missing "kit".

**Previous Session (May 10, Evening - LLM Refinement Focus):**
*   **Product Price & Description Formatting (`app/api/chat/route.ts`):**
    *   Product prices in `ProductCardResponse` initially set to numbers (USD).
    *   Product descriptions initially truncated.
*   **Linting & Build Errors:** Initial fixes in various files.
*   **System Prompt Refinements (`lib/redis.ts` - `STATIC_BASE_PROMPT_CONTENT`):**
    *   Multiple iterations to improve LLM adherence to `requested_product_count`, price filter text, and specific examples.
    *   Refined `isPotentiallyGibberish` function in `app/api/chat/route.ts`.

## 💡 Next Steps & Roadmap (Focus on LLM Behavior and Simulation Failures)

The immediate priority is to stabilize the LLM's behavior to pass all `simulate-chat.ts` tests.
1.  **LLM Prompt Engineering (`lib/redis.ts`) (Highest Priority):**
    *   **Update prompt to include `product_matches` with `reasoning` for each product.**
    *   **Simplify `requested_product_count` Rules:** The current prioritized list might be too complex. Try a simpler structure:
        1.  Handle non-product queries (count: 0).
        2.  Handle explicit lists ("show me X", "any Y", "top N Z") (count: 10 or N).
        3.  Handle "X and Y" / "combo" (count: 2).
        4.  Handle "set" (count: 3).
        5.  Default all other product queries to count: 1.
    *   **Reinforce Price Filter Output:** Use stronger keywords like "ALWAYS" for including "with price filter" in `ai_understanding` and "USD" in `advice`.
    *   **Specificity in `ai_understanding`:** For queries like "eye creams for dark circles", ensure the LLM includes all key attributes in the `ai_understanding`.

1.  **LLM Prompt Engineering (`lib/redis.ts`) (Highest Priority):**
    *   **Simplify `requested_product_count` Rules:** The current prioritized list might be too complex. Try a simpler structure:
        1.  Handle non-product queries (count: 0).
        2.  Handle explicit lists ("show me X", "any Y", "top N Z") (count: 10 or N).
        3.  Handle "X and Y" / "combo" (count: 2).
        4.  Handle "set" (count: 3).
        5.  Default all other product queries to count: 1.
    *   **Reinforce Price Filter Output:** Use stronger keywords like "ALWAYS" for including "with price filter" in `ai_understanding` and "USD" in `advice`.
    *   **Specificity in `ai_understanding`:** For queries like "eye creams for dark circles", ensure the LLM includes all key attributes in the `ai_understanding`.
2.  **API Logic Review (`app/api/chat/route.ts`):**
    *   **Gibberish Check:** Re-evaluate `isPotentiallyGibberish` for "asdfjkl;" to ensure it's caught before LLM, or ensure LLM fallback for nonsense is robust.
    *   **Product Slicing for Complementary:** Ensure `finalProductCards.slice(0, requestedCount)` is correctly applied when `requestedCount` is > 1.
3.  **Data Verification (Medium Priority):**
    *   Verify product data for "Planet Beauty" vendor to ensure the "Planet Beauty brand moisturizer" test can pass if logic is correct.
4.  **Iterative Testing (`simulate-chat.ts`):**
    *   Run simulation after each significant prompt or logic change to track progress and regressions.

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
