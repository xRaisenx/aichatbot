# Planet Beauty AI Chatbot

## Description

This project is an AI chatbot for Planet Beauty, built with Next.js and deployed on Vercel. It uses the Google Gemini API for natural language understanding and the Upstash Vector database (BM25 sparse search) for product search and retrieval. It integrates with the Shopify Admin API (GraphQL) to sync product data.

## Current Status (As of May 9, 2025 - End of Session)

*   **Core Functionality & Stability:**
    *   Linting (`npm run lint`) and build (`npm run build`) remain successful.
*   **Jest ESM Transition & Debugging (Ongoing):**
    *   `jest.config.cjs` updated to use `preset: 'ts-jest/presets/default-esm'` for improved ES Module support.
    *   `transformIgnorePatterns` adjusted to correctly handle ESM dependencies.
    *   Added explicit Jest globals imports (`import { jest, ... } from '@jest/globals';`) to test files (`test/shopify.test.js`, `test/gemini.test.js`, `test/api/sync-products/route.test.ts`, `test/chat.test.js`).
    *   Manual mocks created for `@upstash/redis` (in `__mocks__/@upstash/redis.ts`) and `next/server` (in `__mocks__/next/server.ts`) to resolve complex mocking issues in ESM.
    *   Duplicate manual mock `__mocks__/next/server.js` was deleted.
    *   **Current Test Status:**
        *   `test/shopify.test.js`: Passing.
        *   `test/api/sync-products/route.test.ts`: Skipped (per user instruction). Previously had issues with mock types and `NextResponse.json` mock.
        *   `test/gemini.test.js`: Failing due to mock value mismatches and ineffective embedding mock.
        *   `test/lib/redis.cache.test.js`: Failing due to issues with the manual mock interaction (data not persisting as expected, spy errors).
        *   `test/chat.test.js`: Failing due to `TypeError: Response.json is not a function` (manual `next/server` mock likely not fully effective or correctly implemented/picked up) and one test timeout. The previous `ReferenceError: require is not defined` seems resolved by the manual `next/server` mock.
*   **Previous Enhancements (Summary):**
    *   Sparse search (BM25), Upstash Vector query timeouts, Pino logging in `app/api/chat/route.ts`.
    *   Expanded unit tests for chat, Jest config updates for `ts-jest` and ES Modules.
*   **Product Synchronization (`/api/sync-products`):**
    *   Logic remains for GraphQL fetching and BM25 upserts. (Currently not being tested via `npm test`).
*   **Chat Functionality (`/api/chat`):**
    *   Core logic for sparse queries and logging is in place. Test failures indicate issues with mocks for `next/server`.
*   **Next Steps (for new thread/session):**
    *   **Resolve all remaining Jest test failures:**
        *   `test/gemini.test.js`: Debug mock effectiveness (especially for embeddings) and update mock response data.
        *   `test/lib/redis.cache.test.js`: Ensure manual mock for `@upstash/redis` works correctly for data persistence and spying.
        *   `test/chat.test.js`: Fix `TypeError: Response.json is not a function` by ensuring the manual `next/server` mock is correctly implemented and used. Address test timeout.
    *   Once tests are stable (excluding `sync-products` for now), proceed with implementing the feedback loop functionality from `ai_chat_todo.md`.
    *   Address other pending tasks in `ai_chat_todo.md`.

## Technologies Used

*   Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS
*   Backend: Next.js API Routes (Serverless Functions on Vercel)
*   AI: Google Gemini API
*   Vector Database: Upstash Vector (currently using **Sparse Search - BM25**)
*   Caching & Session Management: Upstash Redis
*   E-commerce Integration: Shopify Admin API (**GraphQL**) & Storefront API

## Upstash Vector (Sparse Search - BM25)

The project utilizes Upstash Vector for product search, currently configured for **Sparse Search using BM25**. This approach relies on keyword matching and term frequency.
*   **Sparse Vectors (BM25 - Keyword Search):** For precise keyword matching based on product titles, descriptions, tags, vendor, and product type.

The `app/api/sync-products/route.ts` API fetches product data from Shopify (via GraphQL), prepares `textForBM25` by concatenating relevant product fields, and upserts this text data to Upstash Vector for BM25 indexing. It includes:
*   A duplicate checking mechanism based on metadata comparison to avoid re-upserting unchanged products.
*   Batch processing (`BATCH_SIZE_VECTOR = 25`) and retry logic for upserts.

**Example Upstash Vector SDK Usage (Illustrative for Sparse Search):**
```typescript
import { Index } from "@upstash/vector";
// Initialize the client with your actual URL and token from environment variables
const index = new Index({
  url: process.env.UPSTASH_VECTOR_URL || "YOUR_UPSTASH_VECTOR_URL_PLACEHOLDER",
  token: process.env.UPSTASH_VECTOR_TOKEN || "YOUR_UPSTASH_VECTOR_TOKEN_PLACEHOLDER",
});

// Example: Upserting data for sparse search (BM25)
await index.upsert({
  id: "product-id-123",
  data: "Product Title Product Description relevant keywords for BM25", // Text content for BM25
  metadata: {
    title: "Product Title",
    handle: "product-handle",
    vendor: "Product Vendor",
    productType: "Product Type",
    tags: ["tag1", "tag2", "relevant-tag"], // Example of tags as string[]
    price: "19.99",
    imageUrl: "https://example.com/image.jpg",
    productUrl: "https://example.com/product/product-handle",
    variantId: "gid://shopify/ProductVariant/1234567890"
    // ... other relevant metadata fields
  },
});

// Example: Querying the sparse index (as implemented in app/api/chat/route.ts)
const queryText = "user search query string";

await index.query({
  data: queryText,          // Query text for BM25 sparse search
  topK: 5,
  includeMetadata: true,
});

```
**Note:** The Upstash Vector index should be configured for sparse search (BM25). The sync API prepares and sends text data suitable for this type of index.

## Environment Variables

The following environment variables are required to run this project:

*   `BLOB_READ_WRITE_TOKEN`: Vercel Blob read/write token.
*   `CRON_SECRET`: Secret for cron jobs.
*   `DIAGNOSTIC_SECRET`: Secret for diagnostics.
*   `VERCEL_DEPLOYMENT`: Vercel deployment URL.
*   `VERCEL_DOMAINS`: Vercel domains.
*   `VERCEL_OIDC_TOKEN`: Vercel OIDC token.
*   `UPSTASH_VECTOR_URL`: Upstash Vector URL. **Should point to a Hybrid Index.**
*   `UPSTASH_VECTOR_TOKEN`: Upstash Vector token.
*   `GEMINI_API_KEY`: Google Gemini API key.
*   `SHOPIFY_STOREFRONT_ACCESS_TOKEN`: Shopify Storefront access token.
*   `SHOPIFY_ADMIN_ACCESS_TOKEN`: Shopify Admin access token.
*   `SHOPIFY_API_SECRET_KEY`: Shopify API secret key.
*   `SHOPIFY_STORE_NAME`: Shopify store name.
*   `LATEST_API_VERSION`: Shopify API version.
*   `TEST_SHOPIFY_ORDER_ID`: Test Shopify order ID.
*   `KV_CHA_KV_REST_API_URL`: Upstash KV REST API URL.
*   `KV_CHA_KV_REST_API_TOKEN`: Upstash KV REST API token.
*   `REDIS_URL`: Redis URL.
*   `GOOGLE_DRIVE_FOLDER_ID`: Google Drive folder ID.
*   `GOOGLE_SERVICE_ACCOUNT`: Google service account credentials.
*   `MAX_CHAT_HISTORY`: Maximum chat history length.
*   `NEXT_PUBLIC_WELCOME_MESSAGE`: Welcome message for the chatbot.
*   `PREPROCESS_BATCH_SIZE`: Preprocess batch size.
*   `PRODUCT_LIMIT_PER_RESPONSE`: Product limit per response.

## Product Data Structure

The product data structure used in the `app/api/sync-products/route.ts` file includes the following fields:

*   `title`: The title of the product.
*   `handle`: The handle of the product.
*   `vendor`: The vendor of the product.
*   `productType`: The product type.
*   `tags`: An array of tags associated with the product.
*   `price`: The minimum variant price of the product.
*   `imageUrl`: The URL of the product's image.
*   `productUrl`: The URL of the product on the Shopify store.
*   `variantId`: The ID of the product's variant.

**Note:** The `CRON_SECRET` environment variable must be set for the product sync API (`/api/sync-products`) to function correctly.

## Setup

1.  **Install dependencies:**
    *   Run `npm install` to install the required dependencies.
2.  **Configure environment variables:**
    *   Create a `.env` file in the root directory of the project.
    *   Copy the environment variables from the `.env.example` file (if it exists) to the `.env` file.
    *   Set the values of the environment variables in the `.env` file.
    *   **Note:** Do not commit the `.env` file to version control.
3.  **Run the development server:**
    *   Run `npm run dev` to start the development server.
    *   The development server will be running at `http://localhost:3000`.

## Deployment

This project is deployed on Vercel. To deploy this project to Vercel, follow these steps:

1.  **Create a Vercel account:**
    *   If you don't have a Vercel account, create one at [https://vercel.com/](https://vercel.com/).
2.  **Install the Vercel CLI:**
    *   Run `npm install -g vercel` to install the Vercel CLI.
3.  **Deploy the project:**
    *   Run `vercel` in the root directory of the project.
    *   Follow the prompts to deploy the project to Vercel.
4.  **Configure environment variables:**
    *   In the Vercel dashboard, configure the environment variables for the project.
    *   Make sure to set the correct values for all required environment variables.

**Note:** The Jest test environment is now configured to `'node'` by default (in `jest.config.cjs`). Specific test files needing `jsdom` would require a `// @jest-environment jsdom` docblock. Manual mocks in the `__mocks__` directory are used for `@upstash/redis` and `next/server`.

5.  **Set up a custom domain (optional):**
    *   In the Vercel dashboard, set up a custom domain for the project.

## Testing

Unit tests are written using Jest. The test suite is currently undergoing significant updates for ES Module compatibility. Current status:
*   `test/shopify.test.js`: Passing.
*   `test/api/sync-products/route.test.ts`: Skipped.
*   Other test files (`test/gemini.test.js`, `test/lib/redis.cache.test.js`, `test/chat.test.js`): Failing, debugging in progress.
The codebase passes all lint checks. Run all tests (including currently skipped/failing) with:

```bash
npm test
```

Run specific tests by providing the file path:

```bash
npm run test test/api/sync-products/route.test.ts
```

## Simulations

Two simulation scripts are provided for basic end-to-end testing:

*   **`simulate-sync.ts`**: Triggers the product sync API (`/api/sync-products`) to simulate fetching products from Shopify and upserting them into the vector database. Requires the `CRON_SECRET` environment variable.
*   **`simulate-chat.ts`**: Simulates a basic user conversation with the chat API (`/api/chat`), sending messages and receiving responses.

To run the simulations, you need `tsx` (or similar TypeScript runner) and dependencies:

```bash
npm install -g tsx # Or use npx tsx
npm install node-fetch dotenv uuid @types/node-fetch @types/uuid
```

Then run the scripts:

```bash
npx tsx simulate-sync.ts
npx tsx simulate-chat.ts
```

**Note:** These simulations interact with the live API endpoints (running locally via `npm run dev`). The `simulate-chat.ts` script has been recently fixed and verified to work correctly. They do not automatically mock external services like Shopify, Upstash, or Gemini.

## Troubleshooting

*   **The chatbot is not responding:**
    *   Make sure that the Google Gemini API key is set correctly in the `.env` file.
    *   Make sure that the Upstash Vector database is running and accessible.
    *   Check the server logs for any errors.
*   **The chatbot is not displaying product information:**
    *   Make sure that the Shopify Storefront access token is set correctly in the `.env` file.
    *   Make sure that the Shopify store is accessible.
    *   Check the server logs for any errors.
*   **The chatbot is not displaying the correct theme:**
    *   Make sure that the theme is configured correctly in the application.
    *   Check the browser console for any errors.
*   **Upstash Redis Connection Issues:**
    *   Ensure that the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables are set correctly in the `.env` file.
    *   Verify that the Upstash Redis database is running and accessible from the application.
    *   Check the server logs for any connection errors.
*   **Chat Interface Issues (e.g., font, size):**
    *   Verify "Montserrat" font is correctly imported and applied in `app/globals.css`.
    *   Inspect CSS for `ChatInterface.module.css` to ensure `resize`, `overflow`, `height`, `min-height`, and `min-width` properties are correctly applied, especially within media queries.

## Phase 2: Feature Enhancement and AI Integration

The following features were added in Phase 2:

*   **Admin Dashboard:** Basic admin pages for users and products were created. These pages can be accessed at `/app/admin/users/page.tsx` and `/app/admin/products/page.tsx`.
*   **Enhanced Analytics:** Analytics tracking was enhanced to store event details and incorporate user IDs. This allows for more granular analysis of user interactions.
*   **User Isolation & Caching:**
    *   Implemented a more granular key prefixing strategy for Redis keys (e.g., `user:{userId}:chatHistory`) to isolate user-specific data.
    *   Implemented ephemeral caching (24-hour TTL) for user chat history using Redis (`lib/redis.ts`, integrated into `app/api/chat/route.ts`). This improves performance for returning users by quickly retrieving recent conversation context. Unit tests (`test/lib/redis.cache.test.js`) verify this functionality.
    *   Implemented rate limiting using the `@upstash/ratelimit` library to limit the number of requests per user.
    *   Unit tests for rate limiting (`test/chat.test.js`) were fixed after addressing mock complexities for `@upstash/ratelimit`.
*   **Shopify Integration:** Deeper Shopify cart and checkout integrations were explored. Users can now retrieve cart details and create checkout URLs directly from the chatbot interface. Basic unit tests for these Shopify integration functions have been added and are passing.
