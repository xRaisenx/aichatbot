# Actionable TODO List: Prioritized and Sequenced

This document outlines the steps needed to maintain and improve the Planet Beauty AI Chatbot project, ensuring a comprehensive and up-to-date view of the project, while prioritizing tasks for sequential development to minimize risks.

## Goal

To ensure the Planet Beauty AI Chatbot project is complete, maintainable, scalable, and AI-friendly, with a clear roadmap for future development.

## Development Principles

*   **Sequential Development:** Tasks are prioritized and sequenced to minimize the risk of breaking existing functionality. Lower-risk tasks are tackled first to build a stable foundation.
*   **Prioritization:** Tasks are prioritized based on their impact on the project's core functionality, maintainability, scalability, and AI-friendliness.
*   **Documentation First:** Before starting any major development task, ensure that the existing code and project structure are well-documented.

## Prioritized TODO Items

### Phase 1: Foundation and Stability (Completed)
(Details omitted for brevity - no changes)

### Phase 2: Feature Enhancement and AI Integration (Completed)
(Details omitted for brevity - no changes)

### Phase 3: Scalability, Optimization, and Refinement (Largely Completed, Ongoing Refinements - As of May 10, 2025 - Late Afternoon)
(Details for items 1-24 omitted for brevity - no changes)

25. [ ] **Verify All Unit Tests (Critical Priority, Stability):**
    *   **Status (as of May 10, 2025 - Late Afternoon):**
        *   `test/shopify.test.js`: Passing.
        *   `test/api/sync-products/route.test.ts`: Skipped.
        *   `test/app/api/chat/route.test.ts`: Expanded with new tests for contextual intents and GraphQL fallback. TypeScript errors resolved.
        *   `test/chat.test.js`, `test/lib/redis.cache.test.js`, `test/gemini.test.js`: Reset to placeholder tests. Need rebuilding. Unit tests for `lib/redis.ts` (prompt caching) are pending.
    *   **Next Steps (High Priority):** Incrementally rebuild remaining unit tests.
26. [x] **Update all relevant documentation (High Priority, Maintainability):**
    *   `README.md`, `progress.md`, `actionable_todo.md`, `feedback.md` updated to reflect current status as of May 10, 2025 - Late Afternoon.
27. [x] **Chat Interface UI Enhancements (High Priority, Feature):** (Completed)

### Phase 3.5: Full Product Synchronization (On Hold)
(Details omitted for brevity - no changes)

### Phase 3.7: Verification Checks (Completed - New Issues Identified)
(Details omitted for brevity - no changes)

### Phase 4: New Architecture Implementation, Caching & Refinement (Ongoing - May 12, 2025)

<<<<<<< HEAD
*   **Goal:** Implement, configure, and refine the new "Gemini-like" AI architecture (`gemini-1.5-flash` model), integrate Redis caching and dynamic knowledge base, pass all simulation tests in `simulate-chat.ts`, implement requested UI/UX enhancements, and ensure code quality.
*   **Work Done This Session (May 11-12):**
    *   **[x] Redis Caching & Knowledge Base (`lib/redis.ts`, `app/api/chat/route.ts`, `lib/llm.ts`):**
        *   Implemented API response caching to reduce LLM calls.
        *   Implemented session history management using Redis.
        *   Implemented a dynamic knowledge base in Redis with basic keyword similarity search for common non-product queries.
        *   Added cache invalidation logic.
        *   Corrected `STATIC_BASE_PROMPT_CONTENT` syntax and exported `redisClient`.
    *   **[x] API Endpoint Updates (`app/api/chat/route.ts`):**
        *   Integrated caching mechanisms for responses and session history.
        *   Integrated knowledge base update logic.
        *   Fixed `userId` handling (ensured it's passed from frontend and used in API).
        *   Refined logic for `is_product_query` and `search_keywords` consistency.
    *   **[x] LLM Logic (`lib/llm.ts`):**
        *   Integrated `getKnowledgebaseEntry` to check Redis before calling Gemini.
        *   Enhanced fallback and post-processing for `is_product_query` and JSON parsing.
    *   **[x] Frontend (`components/ChatInterface.tsx`):**
        *   Added `userId` state and included it in API requests to `/api/chat`.
    *   **[x] Linting:** Addressed various linting errors.
    *   **[x] ESLint Configuration:** Updated `.eslintrc.json` to ignore `lib/upstash-vector-reference.ts`. (from May 11)
    *   **[x] Backend Logic (`app/api/chat/route.ts` - May 11):**
        *   Modified product mapping for "reason for match".
    *   **[x] Type Definitions (`lib/types.ts` - May 11):**
        *   Added `product_matches` to `LLMStructuredResponse`.
    *   **[x] Frontend UI/UX (May 11):**
        *   Product card price formatting, description styling.
        *   Dynamic/Contextual suggested questions feature.
    *   **[x] Build & Linting (May 11):** Initial pass.
*   **Previous Work (May 10 - Retained for context):**
    *   Initial LLM prompt refinements, gibberish detection, product data formatting.
*   **Current Status (End of Session - May 12, 2025 - After Caching/KB Implementation):**
    *   Caching and dynamic knowledge base (Redis-based) implemented.
    *   `is_product_query` and `userId` bugs addressed.
=======
*   **Goal:** Implement, configure, and refine the new "Gemini-like" AI architecture (`gemini-1.5-flash` model) to pass all simulation tests in `simulate-chat.ts`. Also, implement requested UI/UX enhancements and ensure code quality.
*   **Work Done This Session (May 11, Early Morning):**
    *   **[x] ESLint Configuration:** Updated `.eslintrc.json` to ignore `lib/upstash-vector-reference.ts`.
    *   **[x] Backend Logic (`app/api/chat/route.ts`):**
        *   Modified product mapping to use a new `description` field for "reason for match" (derived from `llmResult.product_matches` or a fallback), instead of raw `textForBM25`.
        *   Commented out a verbose `console.log` for `llmResult` to reduce console noise.
        *   Removed unused `CURRENCY_SYMBOL` and `DEFAULT_LOCALE_FOR_CURRENCY` constants.
    *   **[x] Type Definitions (`lib/types.ts`):**
        *   Added `product_matches: Array<{ variantId: string; reasoning: string }>` to `LLMStructuredResponse`.
    *   **[x] Frontend - Product Card (`components/ProductCard.tsx` & `styles/ChatInterface.module.css`):**
        *   Changed `price` prop to type `number` and implemented USD currency formatting (e.g., "$43.00").
        *   Updated description display to use a new CSS class `styles.productReasoning` (styled to be gray, subtle, italic).
    *   **[x] Frontend - Chat Interface (`components/ChatInterface.tsx`):**
        *   Expanded `suggestedQuestions` list.
        *   Modified to display 5 random premade questions on initial load.
    *   **[x] Frontend - Chat Message (`components/ChatMessage.tsx`):**
        *   Removed "Bella is thinking..." text from the loading indicator.
        *   Updated `Message` interface: `product_card.price` is now `number`.
        *   Ensured `productCardData.price` is converted to `Number` in `parseAdvice`.
    *   **[x] Frontend - Complementary Products (`components/ComplementaryProducts.tsx`):**
        *   Corrected `price` prop passed to `ProductCard` to be a `number`.
    *   **[x] AI-Generated Suggested Questions (Refined):**
        *   Updated API endpoint `/api/chat/generate-suggested-questions` to dynamically generate 4 (instead of 5) more creative welcome questions using the LLM (adjusted temperature to 0.9, topP to 0.80, model to 'gemini-1.5-flash', and refined prompt).
        *   Updated `components/ChatInterface.tsx` to fetch and display 4 questions from this endpoint, with updated fallback questions.
    *   **[x] Build & Linting:**
        *   Successfully ran `npm run lint` and `npm run build` after all modifications, resolving any emergent issues (including unused variable in new API route).
*   **Previous Work (May 10, Evening - Retained for context):**
    *   Product prices in `ProductCardResponse` initially set to numbers (USD).
    *   Product descriptions initially truncated.
    *   Initial linting error fixes (various files).
    *   Initial exclusion of `lib/upstash-vector-reference.ts` from build.
    *   System prompt refinements for `requested_product_count`, price filter, "asdfjkl;" example.
    *   Gibberish detection refinements.
    *   Next.js cache cleared.
*   **Current Status (End of Session - May 11, Early Morning - Post UI Changes & Simulation Run):**
    *   UI/UX changes implemented as per latest requests.
>>>>>>> 64a827b9f867e23e5563b1f13d65920ff791ff11
    *   Codebase is lint-free and builds successfully.
    *   Simulation (`simulate-chat.ts`) run: **(To be re-evaluated after full testing of new features)**. Key LLM-related issues likely persist and are the next focus.
        *   **Passing (from May 11):** Greetings, General Question (skincare), Basic Product Search (vegan lipstick), Attribute Search (serum for dry skin), Multiple Types (cleanser/moisturizer - count correct), No Results (fictional), Memory Query, Chatbot Name.
*   **Key Outstanding Issues & Next Steps (based on May 11 simulation, to be re-verified):**
    1.  **[ ] Resolve Remaining Failing Test Cases in `simulate-chat.ts` (Critical Priority):**
        *   **Price Filter Queries (e.g., "cheap sunscreen under $30", "vegan and cruelty-free serum under $100"):**
            *   `ai_understanding` often missing "price filter".
            *   `advice` often missing "USD".
            *   `product_card` expected `true`, but `complementary_products` (10 items) are returned. LLM not setting `requested_product_count` to 1.
        *   **Vendor Query ("Planet Beauty brand moisturizer"):**
            *   `product_card` expected `true`, but no products found/returned (Note: "Planet Beauty brand" is now treated as fictional by LLM prompt, this test case might need adjustment or is expected to fail differently).
        *   **Gibberish Handling ("asdfjkl;"):**
            *   `ai_understanding` from LLM ("gibberish input") needs to align with direct `route.ts` response ("Unable to understand the query") or LLM fallback needs to be robust.
            *   `advice` missing "more details".
        *   **Fallback Logic / Specific Attribute Query ("Any good eye creams for dark circles?"):**
            *   `ai_understanding` missing "dark circles".
            *   `product_card` expected `true`, but `complementary_products` (10 items) are returned. LLM not setting `requested_product_count` to 1.
        *   **Set/Combo Counts:**
            *   "Skincare set for dry skin": Expected 3 `complementary_products`, Got 10.
            *   "combo with cleanser and toner for oily skin": Expected 2 `complementary_products`, Got 1.
        *   **Follow-up Clarification ("Is that moisturizer part of a kit?"):**
            *   `advice` missing keyword "kit".
        *   **Reason for Match (General LLM Task):** The LLM prompt needs to be updated to provide the `product_matches` field with `reasoning` for each product.
        *   **Action Plan for Next Session:**
            *   **Intensive LLM Prompt Engineering (`lib/redis.ts` - `STATIC_BASE_PROMPT_CONTENT`):**
                *   Prioritize rules for `requested_product_count` (especially for single items with filters).
                *   Strengthen instructions for price filter text in `ai_understanding` and `advice`.
                *   Ensure LLM includes all specific attributes from the query in `ai_understanding`.
                *   Add instructions for the LLM to populate the `product_matches` field with `variantId` and `reasoning`.
                *   Refine examples for sets, combos, and follow-up clarifications.
            *   **Logic Review (`app/api/chat/route.ts`):**
                *   Verify product assignment logic based on `requested_product_count`.
            *   **Data Investigation:** If vendor query (for actual brands) persists, check vector store.
    2.  **[x] Knowledge Base Implementation (Initial Redis-based version COMPLETED):**
        *   Dynamic knowledge base using Redis for common Q&A implemented in `lib/redis.ts` and integrated into `lib/llm.ts` and `app/api/chat/route.ts`.
        *   **Next Step (Lower Priority):** Consider Upstash Vector for semantic search for knowledge base if keyword similarity proves insufficient.
    3.  **[ ] Unit Testing (Medium Priority):**
        *   Write/rebuild Jest unit tests for `lib/llm.ts`, `lib/redis.ts` (including caching & KB functions), and `app/api/chat/route.ts`.
    4.  **[ ] Update All Documentation:** (Partially completed for README, `actionable_todo.md`. `progress.md`, `feedback.md`, `project_structure.md` pending) Ensure all docs are fully aligned with the final stable state, including caching and knowledge base features.

### Phase 5: Chat Interface Implementation and Final Polish (Pending New Architecture Stability)
(Details omitted for brevity - no changes)

By following this prioritized list, the aim is to fully implement, configure, and stabilize the new "Gemini-like" AI architecture, enhanced with robust caching and a dynamic knowledge base.
