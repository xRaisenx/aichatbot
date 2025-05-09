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

1.  [x] **Clarify `mcp-server.js` Purpose (High Priority, Maintainability):**
    *   Investigated and documented the purpose of `mcp-server.js`. It's a custom server script for interacting with Shopify, but it's not used in either the Next.js or Remix apps. It can likely be removed to simplify the project.
2.  [x] **Environment Variables (High Priority, Maintainability):**
    *   Reviewed and refined environment variable management. Removed unused Redis-related environment variables. Documented all environment variables in `README.md`. The `CRON_SECRET` environment variable is now required and has no default value.
3.  [x] **Documentation (High Priority, Maintainability):**
    *   Updated the `README.md` with detailed instructions for setup, deployment, and troubleshooting.
4.  [x] **Testing Coverage (Medium Priority, Completeness):**
    *   Expanded testing coverage to include a unit test for the `gemini.ts` file.
5.  [x] **Error Handling (Medium Priority, Completeness):**
    *   Enhanced error handling in the `/api/chat` route.
6.  [x] **Implement robots.txt and sitemap.xml (Low Priority, Completeness):**
    *   Included `robots.txt` and `sitemap.xml` in the `/public` directory.

### Phase 2: Feature Enhancement and AI Integration (Completed)

7.  [x] **Expand Admin Dashboard (Medium Priority, Completeness):**
    *   Expanded the admin dashboard with pages like `/app/admin/users/page.tsx` and `/app/admin/products/page.tsx`.
8.  [x] **Enhance Analytics (Medium Priority, Completeness):**
    *   Enhanced analytics with `/app/api/analytics/track/route.ts` for tracking user interactions and conversions.
9.  [x] **Implement a robust user isolation strategy (High Priority, Completeness):**
    *   Implemented a more granular key prefixing strategy for Redis keys (e.g., `user:{userId}:chat_history`).
    *   Implemented ephemeral caching (24-hour TTL) for user chat history in Redis.
10. [x] **Implement Rate Limiting (High Priority, Completeness):**
    *   Implemented a rate limiting strategy using the `@upstash/ratelimit` library for the chat API (10 reqs / 10 secs per IP).
    *   Resolved unit test issues for rate limiting logic.

### Phase 3: Scalability, Optimization, and Refinement

1.  [x] **Scalability Analysis (Completed - Further Actions Identified):**
    *   Initial evaluation completed. Confirmed the architecture can potentially support 3000-5000 daily users but **requires significant optimizations** to achieve this reliably. Key areas identified for immediate action include decoupling `buildDynamicMappings`, implementing robust rate limit handling for external services (Shopify, Gemini, Vector), optimizing the chat API's own rate limiter, and integrating real embedding generation. These are detailed in subsequent tasks.
2.  **Adapt Product Sync for Hybrid Search (High Priority, Feature & Stability):**
    *   [x] Modified `app/api/sync-products/route.ts` to prepare data for a hybrid Upstash Vector index (dense vectors + text for BM25). This includes updating `VectorRecord` and `VectorMetadata` types, and the data preparation logic.
    *   [x] Added a unit test to `test/api/sync-products/route.test.ts` to verify the correct structuring of data for hybrid search, including the 768-dimension dense vector placeholder and `textForBM25` in metadata.
    *   [x] Added `requestTimeout: 30000` to Upstash Vector client.
    *   [x] Implemented duplicate checking (vector and metadata) before upserting.
    *   *Status:* Completed.
    *   *Reasoning:* Ensures product data is correctly indexed for effective hybrid search, resolving previous "dense vector" errors, improving resilience, and preventing redundant upserts.
3.  [x] **Implement Real Dense Embedding Generation (Critical Priority, Feature & AI-Friendliness):**
    *   Completed. `app/api/sync-products/route.ts` now uses `generateEmbeddings` from `lib/gemini.ts` (Google's `models/embedding-001`) to create 768-dimension vectors. Includes fallback to dummy vectors on error.
    *   *Reasoning:* Critical for enabling semantic search capabilities.
4.  [x] **Implement Hybrid Search in Chat API (High Priority, Feature):**
    *   Completed. `app/api/chat/route.ts` updated to generate query embeddings and perform hybrid search (dense vector + sparse data) against Upstash Vector. Falls back to sparse-only if query embedding fails.
    *   *Reasoning:* Enables the chat to leverage the full capabilities of the hybrid index.
5.  [x] **Handle "Index does not support dense vectors" Error (High Priority, Stability):**
    *   Completed. `app/api/sync-products/route.ts` (`upsertWithRetry`) now catches this specific error and attempts a sparse-only upsert as a fallback.
    *   *Reasoning:* Prevents sync failures if the Upstash index is misconfigured (sparse-only instead of hybrid). Allows sync to proceed with sparse data.
6.  [x] **Prevent Function Timeouts in Sync API (High Priority, Stability):**
    *   Completed. Reduced the number of products processed per invocation in `app/api/sync-products/route.ts` from 500 to 25 to avoid `FUNCTION_INVOCATION_TIMEOUT`.
    *   *Reasoning:* Ensures the sync function completes within typical serverless time limits. Requires multiple sequential runs for full sync.
7.  **Decouple `buildDynamicMappings` (Critical Priority, Scalability):**
    *   Modify `app/api/chat/route.ts` so that `buildDynamicMappings` is not called on every cold start.
    *   Implement a scheduled job (e.g., cron, or a separate Vercel cron job) to run `buildDynamicMappings` periodically (e.g., daily or on-demand after product syncs).
    *   Store the results of `buildDynamicMappings` in a persistent cache (e.g., Redis) accessible by the chat API during runtime.
    *   *Reasoning:* Critical for preventing severe performance bottlenecks and excessive Upstash Vector load at scale, which currently risks system stability under high traffic.
8.  **Implement Shopify Admin API Rate Limit Handling (High Priority, Stability):**
    *   Modify `lib/shopify-admin.ts` (specifically `fetchAdminShopifyProducts`) to detect HTTP 429 "Too Many Requests" errors from the Shopify Admin API.
    *   Implement retry logic with exponential backoff, respecting `Retry-After` headers if provided by Shopify.
    *   *Reasoning:* Essential for reliable product synchronization. Prevents sync failures due to Shopify's rate limits, ensuring data freshness for the chatbot.
9.  **Implement Gemini API Rate Limit Handling (High Priority, Scalability & Reliability):**
    *   In `app/api/chat/route.ts`, add retry logic with exponential backoff for calls to the Google Gemini API when rate limit errors (e.g., 429) are encountered.
    *   *Reasoning:* Improves the reliability and consistency of AI-driven responses under load, preventing degraded user experience due to external service limits.
10. **Implement Upstash Vector Query Rate Limit Handling (High Priority, Scalability & Reliability):**
    *   In `app/api/chat/route.ts`, add retry logic with exponential backoff for Upstash Vector queries when rate limit errors are encountered.
    *   *Reasoning:* Ensures more reliable product searching capabilities during peak traffic, preventing failed searches and improving user experience.
11. **Review and Optimize Chat API Rate Limiter (Medium Priority, Scalability):**
    *   Evaluate changing the `@upstash/ratelimit` identifier in `app/api/chat/route.ts` from IP-based to `userId`-based. This depends on the consistent availability and uniqueness of the `x-user-id` header from the client.
    *   *Reasoning:* Provides fairer per-user rate limiting and better scalability for users behind shared IPs, preventing a few users or a single IP from exhausting limits for others.
12. **Document `worker_threads` Non-Feasibility (Low Priority, Maintainability):**
    *   Update `README.md` or relevant architectural documents to note that Node.js `worker_threads` were investigated and found unsuitable for the Vercel Edge environment, and `lib/worker.ts` (Web Worker) is not currently used by the server-side application.
    *   *Reasoning:* Clarifies architectural decisions and prevents future redundant investigations.
13. **Code Documentation (Medium Priority, Maintainability):**
    *   Add more comments to the code to explain complex logic and functionality, especially in `app/api/chat/route.ts` and `app/api/sync-products/route.ts`.
    *   *Reasoning:* Good code documentation is essential for maintainability.
14. **Consistent Coding Style (Medium Priority, Maintainability):**
    *   Enforce a consistent coding style throughout the project. Ensure linters and formatters are configured and run regularly.
    *   *Reasoning:* A consistent coding style improves readability and maintainability.
15. **Dependency Management (Medium Priority, Maintainability):**
    *   Review and update dependencies. Remove any unused dependencies.
    *   *Reasoning:* Up-to-date dependencies improve security and performance.
16. **Project Structure Review (Low Priority, Maintainability):**
    *   Re-evaluate if both the Next.js app and the Remix app in `planet-beauty-ai-chat/` are needed, or if the project can be simplified. (This was previously noted, keeping for completeness).
    *   *Reasoning:* Simplifying the project structure can improve maintainability.
17. **Clear Intent Recognition (Medium Priority, AI-Friendliness):**
    *   Improve the chatbot's ability to recognize user intent. This can be achieved by refining prompts for Gemini and potentially training/fine-tuning models if applicable.
    *   *Reasoning:* Clear intent recognition is essential for providing accurate and relevant responses.
18. **Contextual Awareness (Medium Priority, AI-Friendliness):**
    *   Enhance the chatbot's ability to maintain context throughout the conversation. Review chat history management and its use in prompts.
    *   *Reasoning:* Contextual awareness improves the chatbot's ability to provide relevant and helpful responses.
19. **API Documentation (Medium Priority, AI-Friendliness):**
    *   Provide clear and concise documentation for all internal APIs used by the chatbot (e.g., `/api/chat`, `/api/sync-products`).
    *   *Reasoning:* Clear API documentation improves maintainability and onboarding.
20. [x] **Fix unit tests for `app/api/sync-products/route.ts` (High Priority, Completeness):**
    *   Completed.
21. [x] **Create sync and chat simulations (High Priority, Completeness):**
    *   Completed.
22. [x] **Ensure Linting Passes (High Priority, Stability):**
    *   Completed.
23. [x] **Fix and Verify Chat Simulation (High Priority, Stability):**
    *   Completed.
24. [x] **Verify Production Build (High Priority, Stability):**
    *   Completed.
25. [x] **Verify All Unit Tests (High Priority, Stability):**
    *   Completed.
26. [x] **Update all relevant documentation (High Priority, Maintainability):**
    *   Completed for previous phases. `README.md` updated with hybrid search details, sync API enhancements (timeout, duplicate check, sparse fallback details), and chat UI changes. Ongoing for new changes.
27. [x] **Chat Interface UI Enhancements (High Priority, Feature):**
    *   [x] Chatbox made resizable (`resize: both`, `overflow: auto`).
    *   [x] Chatbox height on desktop landscape increased to `70vh` (with `min-height: 400px`, `min-width: 300px`).
    *   [x] "Montserrat" font applied globally via `app/globals.css`.
    *   *Status:* Completed.
    *   *Reasoning:* Improves user experience and visual appeal of the chat interface.

### Phase 3.5: Full Product Synchronization (Execute after Phase 3 refinements)

1.  **Finalize and Execute Full Product Synchronization (Critical Priority, Core Functionality):**
    *   **Review `app/api/sync-products/route.ts`:** Conduct a final review of the sync logic, particularly the duplicate checking, error handling (sparse/dense fallbacks), batching, and timeout configurations to ensure robustness for a full sync operation.
    *   **Ensure Dev Server is Running:** Verify the Next.js development server (`npm run dev`) is active to serve the API endpoint.
    *   **Execute Sync Iteratively:** Run the `npx tsx simulate-sync.ts` command.
    *   **Monitor Logs:** After each execution, carefully examine the console output from the `npm run dev` process (which hosts the API) for:
        *   "Sync complete. Fetched: X, Processed: Y, Errors: Z" message.
        *   The `fetched` count: If less than `BATCH_SIZE_VECTOR` (25), it suggests all products are processed. If equal, more likely remain.
        *   "Skipped X identical items" messages.
        *   Warnings like "Falling back to dummy vector" or "Retrying batch without dense vectors."
        *   Successful sparse-only upserts: "Successfully upserted batch of X records (sparse only)."
        *   Any unexpected errors or failures during sparse fallback ("Failed to upsert sparse-only batch").
    *   **Repeat Sync:** Continue running `npx tsx simulate-sync.ts` until the `fetched` count in the API's "Sync complete" response is less than `BATCH_SIZE_VECTOR`, signifying all products have been processed.
    *   *Reasoning:* Essential to populate the vector database with all Shopify products, enabling comprehensive search for the chatbot. This is a core operational goal.

### Phase 4: Chat Interface Implementation and Final Polish (Pending Phase 3 & 3.5 Completion)

1.  **Implement Chatbot Frontend (High Priority, Feature):**
    *   Develop the chatbot user interface based on the documentation and plans found in `frontend-dev/` (e.g., `chatbot.html`, `chatbot_plan.md`, `chatbot_todo.md`).
    *   Ensure the frontend correctly sends a unique `x-user-id` header with every chat request to facilitate chat history isolation and potentially per-user rate limiting.
    *   Integrate the frontend with the `/api/chat` backend, handling responses and displaying product cards, advice, etc.
    *   Implement mechanisms for managing chat history display on the client side.
    *   *Reasoning:* Delivers the primary user-facing component of the chatbot, making it interactive.
2.  **End-to-End Testing (Medium Priority, Stability):**
    *   Perform thorough end-to-end testing of the complete application, including the new chat interface, backend APIs, and data synchronization.
    *   *Reasoning:* Ensures all components work together correctly and identifies integration issues.
3.  **Performance and Load Testing (Medium Priority, Scalability):**
    *   Conduct performance and load testing, especially after scalability improvements from Phase 3, to validate the system's capacity to handle target user loads (3000-5000 daily users).
    *   *Reasoning:* Verifies that scalability optimizations are effective.
4.  **Final Documentation Review and Update (High Priority, Maintainability):**
    *   Review and update all project documentation (`README.md`, `actionable_todo.md`, `progress.md`, API docs, architectural diagrams) to reflect the final state of the application.
    *   *Reasoning:* Ensures the project is well-documented for future maintenance and development.

By following this prioritized and sequenced TODO list, the Planet Beauty AI Chatbot project can be developed in a stable, scalable, and maintainable way.
