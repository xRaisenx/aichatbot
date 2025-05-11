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

### Phase 4: New Architecture Implementation & Configuration (Ongoing - May 10, 2025 - Evening)

*   **Goal:** Implement and configure a new "Gemini-like" AI architecture to enhance contextual understanding, memory, dynamic response generation, and integration with external knowledge.
*   **Work Done This Session (May 10, Evening):**
    *   **LLM Integration (`lib/llm.ts`):** Created a new module for interacting with a powerful LLM, including `generateLLMResponse` and a placeholder API client.
    *   **Enhanced System Prompt (`lib/redis.ts`):** Replaced `STATIC_BASE_PROMPT_CONTENT` with a new "Grok-style" prompt designed for better reasoning, personality, and handling of complex scenarios.
    *   **Chat History Summarization (`lib/redis.ts`):** Added `summarizeChatHistory` function using the LLM.
    *   **General Knowledge Base Search (`lib/redis.ts`):** Added `searchKnowledgeBase` function and `KNOWLEDGE_BASE_INDEX_NAME` (placeholder implementation).
    *   **External Data Integration (`lib/external.ts`):** Created module with placeholder `fetchProductPrices`.
    *   **Centralized Types (`lib/types.ts`):** Created a new file for shared TypeScript types (`ChatMessage`, `ChatHistory`, etc.) and updated `lib/redis.ts`, `lib/llm.ts`, and `app/api/chat/route.ts` to use these types.
    *   **Chat API Refactor (`app/api/chat/route.ts`):**
        *   Replaced direct Gemini SDK calls with the new `generateLLMResponse` function.
        *   Integrated logic for chat history summarization.
        *   Added calls to `searchKnowledgeBase` for non-product queries and `fetchProductPrices` for product queries.
        *   Updated `isPotentiallyGibberish` with more detailed logging for Rule 2.
        *   Refined combo/set search logic in `performVectorQuery` to be more flexible.
        *   Updated prompt for fictional products and complex queries in `lib/redis.ts`.
*   **Key Considerations & Next Steps (for new thread/session):**
    1.  **[ ] LLM and External API Configuration (Critical Priority):**
        *   In `lib/llm.ts`, replace the placeholder `HypotheticalLLMAPIClient` and API URL with the actual SDK/client and endpoint for the chosen LLM (e.g., xAI Grok, OpenAI GPT-4, Google Gemini Pro/Flash).
        *   In `lib/external.ts`, replace the placeholder `fetchProductPrices` implementation with a real API if available.
        *   Ensure all necessary API keys (e.g., `XAI_API_KEY`, `PRICE_API_KEY`) are correctly set up in the environment.
    2.  **[ ] Knowledge Base Implementation (High Priority):**
        *   Create the `idx:beauty_knowledge` Upstash Vector index.
        *   Develop a script/process to populate this index with embeddings of beauty articles, FAQs, skincare tips, etc.
        *   Modify `searchKnowledgeBase` in `lib/redis.ts` to use a separate `Index` client instance configured for `idx:beauty_knowledge` for accurate querying.
    3.  **[ ] Product Search Filtering in Chat API (High Priority):**
        *   In `app/api/chat/route.ts`, within the `if (llmResult.is_product_query)` block, implement robust filtering of `productQueryResults` from Upstash Vector. This filtering should use `llmResult.attributes`, `llmResult.vendor`, and `llmResult.price_filter` to refine the product list returned to the user. This was previously handled by `performVectorQuery`'s internal logic, which needs to be adapted or reimplemented in the main route now that `performVectorQuery` is simpler.
    4.  **[ ] Combo/Set Logic Refinement (Medium Priority):**
        *   With the new LLM and prompt, re-evaluate how `llmResult.product_types` and `llmResult.requested_product_count` are determined for combo/set queries.
        *   Adjust the product search loop in `app/api/chat/route.ts` to ensure it correctly assembles multiple distinct items if the LLM identifies them as part of a set/combo. The previous simulation still failed "Skincare set for dry skin".
    5.  **[ ] `isPotentiallyGibberish` Diagnostics (Medium Priority):**
        *   Analyze the detailed logs from the `isPotentiallyGibberish` function (Rule 2) after the next simulation run to understand why "asdfjkl;" was not caught. Adjust rules if necessary.
    6.  **[ ] Simulation and Testing (Critical Ongoing):**
        *   Run `simulate-chat.ts` (after configuring `tsconfig.json` for emit and compiling).
        *   Update test cases and expectations in `simulate-chat.ts` to match the new Grok-style responses and functionalities.
        *   Address any new failures or regressions identified.
    7.  **[ ] Unit Testing (Medium Priority):**
        *   Write Jest unit tests for the new modules (`lib/llm.ts`, `lib/external.ts`, `lib/types.ts`).
        *   Update and expand unit tests for `lib/redis.ts` and the refactored `app/api/chat/route.ts`.
    8.  **[ ] Review `ai_chat_final.md` and `ai_chat_todo.md`:** Align these planning documents with the new architecture and outstanding tasks.

### Phase 5: Chat Interface Implementation and Final Polish (Pending New Architecture Stability)
(Details omitted for brevity - no changes)

By following this prioritized list, the aim is to fully implement, configure, and stabilize the new "Gemini-like" AI architecture.
