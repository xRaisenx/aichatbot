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

### Phase 3: Scalability, Optimization, and Refinement (Largely Completed, Ongoing Refinements - As of May 10, 2025)
(Details for items 1-24 omitted for brevity - no changes)

25. [ ] **Verify All Unit Tests (Critical Priority, Stability):**
    *   **Status (as of May 10, 2025):**
        *   `test/shopify.test.js`: Passing.
        *   `test/api/sync-products/route.test.ts`: Skipped.
        *   `test/chat.test.js`, `test/lib/redis.cache.test.js`, `test/gemini.test.js`: Reset to placeholder tests. Need rebuilding.
    *   **Next Steps (High Priority, Post API Stability):** Incrementally rebuild these unit tests.
26. [x] **Update all relevant documentation (High Priority, Maintainability):**
    *   `README.md`, `progress.md`, `actionable_todo.md`, `feedback.md` updated to reflect current status, metadata insights, and next steps (as of May 10, 2025).
27. [x] **Chat Interface UI Enhancements (High Priority, Feature):** (Completed)

### Phase 3.5: Full Product Synchronization (On Hold)
(Details omitted for brevity - no changes)

### Phase 3.7: Verification Checks (Completed - New Issues Identified)
(Details omitted for brevity - no changes)

### Phase 4: Chat API Debugging & Refinement (Current Focus - May 10, 2025)

*   **Goal:** Resolve critical errors, improve product search accuracy based on data insights, and refine AI interaction.

1.  **RESOLVE TYPESCRIPT ERROR in `app/api/chat/route.ts` (CRITICAL BLOCKER, Stability):**
    *   Address the persistent TypeScript error on line 606 (previously 597): "Type 'string | boolean' is not assignable to type 'boolean'".
    *   Multiple attempts (type guards, explicit coercion, direct type definitions, `write_to_file` with full content) have failed to resolve this. The issue likely lies deeper in TypeScript's type inference for the `geminiResult.is_product_query` property throughout its lifecycle.
2.  **Refine Product Search & Filtering Logic in `app/api/chat/route.ts` (High Priority, Core Functionality - POST TS FIX):**
    *   **Leverage Metadata Insights:** Continue adapting filtering logic (`typeMatch`, `attributeMatch` in `performVectorQuery`) based on the observed metadata structure:
        *   `productType` field is often empty or generic.
        *   Specific attributes (e.g., "vegan") are often in `textForBM25`.
    *   **Improve Multi-Type Query Logic:** Address issue where queries like "cleanser and moisturizer" return incorrect product types.
    *   **Review `SIMILARITY_THRESHOLD = 2`:** Assess if this threshold is optimal.
3.  **Update `simulate-chat.ts` for Currency/Price Adjustments (Medium Priority, Testing Accuracy - POST TS FIX):**
    *   Modify price-based test cases to use price values that align with the store's currency (Pesos).
4.  **Address Nonsensical Input Handling (Medium Priority, AI-Friendliness - POST TS FIX):**
    *   Investigate why Gemini misinterprets inputs like "asdfjkl;" based on prior context.
5.  **Verify `simulate-chat.ts` Results (After Fixes in 1 & 2):**
    *   Once the TypeScript error is resolved and filtering logic is further refined, run `simulate-chat.ts` extensively.
    *   Analyze `simulation_run_log.txt` to confirm improvements.
6.  **Continue with `ai_chat_todo.md` (Ongoing):**
    *   Address other pending tasks from `ai_chat_todo.md` as stability improves.
    *   Incrementally rebuild Jest unit tests.
    *   Implement and refine the feedback loop.

### Phase 5: Chat Interface Implementation and Final Polish (Pending API Stability)
(Details omitted for brevity - no changes)

By following this prioritized list, the aim is to stabilize the chat API's core search functionality before moving to broader feature development or UI implementation.
