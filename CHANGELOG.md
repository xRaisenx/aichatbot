# Changelog

## [Unreleased]

### [2025-05-14] - Fixes and Enhancements

#### Added
- **New Caching Functions in `lib/redis.ts`**:
  - Implemented `cacheResponse` and `getCachedResponse` functions to cache and retrieve `ChatApiResponse` objects in Redis, using the `chat:response:` prefix and a 7-day TTL.
  - Aligned with existing `cacheResponse` signature by using `ChatApiResponse` instead of `LLMStructuredResponse`, ensuring type consistency and avoiding new variables.
  - Added JSON serialization (`JSON.stringify`/`JSON.parse`) for Redis compatibility and logging with `pino` to match existing style.

#### Changed
- **Updated `lib/types.ts`**:
  - Streamlined type definitions by removing the duplicate `LLMStructuredResponse`, preserving all other interfaces (`ChatApiResponse`, `ChatMessage`, etc.) unchanged.

- **Updated `lib/redis.ts`**:
  - Integrated new caching functions without altering existing logic, prefixes (`chat:response:`, `chat:session:`, etc.), or TTLs (e.g., 10-minute `RESPONSE_TTL` for original `cacheResponse`).
  - Maintained compatibility with Upstash Redis and existing providers (`distilgpt2`, Gemini).

#### Fixed
- **Removed Duplicate `LLMStructuredResponse` Type**:
  - Eliminated redundant `LLMStructuredResponse` definition in `lib/types.ts` to resolve type conflicts causing issues in the project. The primary definition, including optional `history`, `product_card`, and `complementary_products` fields, was retained for compatibility with `lib/llm.ts` and `lib/redis.ts`.
  - No new variables or logic changes introduced, ensuring minimal impact on existing functionality.

- **Resolved `next.config.js` Linting Error**:
  - Fixed `SyntaxError: Unexpected token 'export'` during `npm run lint` by converting `next.config.js` from ES module syntax (`export default`) to CommonJS (`module.exports`).
  - Ensured compatibility with the project's CommonJS setup, avoiding the need for a full ES module migration, which could disrupt dependencies like `distilgpt2` and Gemini providers.

- **Corrected `updateKnowledgebase` Argument Count**:
  - Fixed TypeScript error `Expected 2-4 arguments, but got 5` in `app/api/chat/route.js` by removing the erroneous `userIdNumber` argument from the `updateKnowledgebase` call, aligning with the function’s signature in `lib/redis.ts`.
  - Enhanced `route.js` with TypeScript annotations (`NextRequest`, interface for request body) and restored `ProductVectorMetadata` type for Upstash vector index.
  - Renamed `route.js` to `route.ts` for TypeScript compliance, with an option to keep as JavaScript if preferred.

#### Notes
- **Deployment**:
  - Changes tested locally and prepared for deployment to Vercel and Hugging Face Spaces (`https://xraisenx-chat-bot.hf.space`).
  - Instructions provided for committing changes, redeploying, and testing `/api/chat` endpoint and Redis caching.

- **Future Considerations**:
  - Consider unifying the original and new `cacheResponse` functions if a single caching approach is preferred.
  - Monitor for potential ES module migration if project requirements shift, though CommonJS is currently stable.

[Unreleased]

[2025-05-14] - Improved Product Recommendations and Response Formatting
*   Improved product recommendation logic to prioritize product type over brand.
*   Updated filtering in the `ChatMessage` component to ensure that only products matching the intended product type is displayed.
*   Removed the redundant greeting from the response.
*   Addressed issues where the chatbot was recommending irrelevant products (e.g., shampoo for a moisturizer query).

[2025-05-14] - Fixes and Enhancements
Fixed

*   Removed Duplicate LLMStructuredResponse Type:
    *   Eliminated redundant LLMStructuredResponse definition in lib/types.ts to resolve type conflicts causing issues in the project. The primary definition, including optional history, product_card, and complementary_products fields, was retained for compatibility with lib/llm.ts and lib/redis.ts.
    *   No new variables or logic changes introduced, ensuring minimal impact on existing functionality.
*   Resolved next.config.js Linting Error:
    *   Fixed SyntaxError: Unexpected token 'export' during npm run lint by converting next.config.js from ES module syntax (export default) to CommonJS (module.exports).
    *   Ensured compatibility with the project's CommonJS setup, avoiding the need for a full ES module migration, which could disrupt dependencies like distilgpt2 and Gemini providers.

Added

*   New Caching Functions in lib/redis.ts:
    *   Implemented cacheResponse and getCachedResponse functions to cache and retrieve ChatApiResponse objects in Redis, using the chat:response: prefix and a 7-day TTL.
    *   Aligned with existing cacheResponse signature by using ChatApiResponse instead of LLMStructuredResponse, ensuring type consistency and avoiding new variables.
    *   Added JSON serialization (JSON.stringify/JSON.parse) for Redis compatibility and logging with pino to match existing style.

Changed

*   Updated lib/types.ts:
    *   Streamlined type definitions by removing the duplicate LLMStructuredResponse, preserving all other interfaces (ChatApiResponse, ChatMessage, etc.) unchanged.
*   Updated lib/redis.ts:
    *   Integrated new caching functions without altering existing logic, prefixes (chat:response:, chat:session:, etc.), or TTLs (e.g., 10-minute RESPONSE_TTL for original cacheResponse).
    *   Maintained compatibility with Upstash Redis and existing providers (distilgpt2, Gemini).

Notes

Deployment:

*   Changes tested locally and prepared for deployment to Vercel and Hugging Face Spaces (https://xraisenx-chat-bot.hf.space).
*   Instructions provided for committing changes, redeploying, and testing /api/chat endpoint and Redis caching.

Future Considerations:

*   Consider unifying the original and new cacheResponse functions if a single caching approach is preferred.
*   Monitor for potential ES module migration if project requirements shift, though CommonJS is currently stable.
