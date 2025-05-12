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
    *   **Status (as of May 12, 2025):**
        *   `test/shopify.test.js`: Passing.
        *   `test/api/sync-products/route.test.ts`: Skipped.
        *   `test/app/api/chat/route.test.ts`: Expanded with new tests for contextual intents and GraphQL fallback. TypeScript errors resolved.
        *   `test/chat.test.js`, `test/lib/redis.cache.test.js`, `test/gemini.test.js`: Reset to placeholder tests. Need rebuilding. Unit tests for `lib/redis.ts` (prompt caching) are pending.
    *   **Next Steps (High Priority):** Incrementally rebuild remaining unit tests.
26. [x] **Update all relevant documentation (High Priority, Maintainability):**
    *   `README.md`, `progress.md`, `actionable_todo.md`, `feedback.md`, and `project_structure.md` updated to reflect recent changes.
27. [x] **Chat Interface UI Enhancements (High Priority, Feature):** (Completed)

### Phase 3.5: Full Product Synchronization (On Hold)
(Details omitted for brevity - no changes)

### Phase 3.7: Verification Checks (Completed - New Issues Identified)
(Details omitted for brevity - no changes)

### Phase 4: New Architecture Implementation, Caching & Refinement (Ongoing - May 12, 2025)

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
    *   **[x] scripts/populate-vector-index.ts:** Updated the id logic in vectorIndex.upsert and enhanced logging.
    *   **[x] Type Definitions (`lib/types.ts`):** Combined ProductVectorMetadata and updated LLMStructuredResponse and ChatApiResponse.
*   **Previous Work (May 10 - Retained for context):**
    *   Initial LLM prompt refinements, gibberish detection, product data formatting.
*   **Current Status (End of Session - May 12, 2025):**
    *   Caching and dynamic knowledge base (Redis-based) implemented.
    *   `is_product_query` and `userId` bugs addressed.
    *   Logic for assigning `product_card` and `complementary_products` corrected.
    *   All relevant documentation updated.
*   **Key Outstanding Issues & Next Steps:**
    1.  **[ ] Resolve Remaining Failing Test Cases in `simulate-chat.ts` (Critical Priority):**
        *   (Details from previous actionable_todo.md retained for context)
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
    2.  **[ ] Knowledge Base Implementation (Initial Redis-based version COMPLETED):**
        *   Dynamic knowledge base using Redis for common Q&A implemented in `lib/redis.ts` and integrated into `lib/llm.ts` and `app/api/chat/route.ts`.
        *   **Next Step (Lower Priority):** Consider Upstash Vector for semantic search for knowledge base if keyword similarity proves insufficient.
    3.  **[ ] Unit Testing (Medium Priority):**
        *   Write/rebuild Jest unit tests for `lib/llm.ts`, `lib/redis.ts` (including caching & KB functions), and `app/api/chat/route.ts`.

### Phase 5: Chat Interface Implementation and Final Polish (Pending AI Enhancements & Debugging)
(Details omitted for brevity - no changes)

By following this prioritized list, the aim is to fully implement, configure, and stabilize the new "Gemini-like" AI architecture, enhanced with robust caching and a dynamic knowledge base.
