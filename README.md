# Planet Beauty AI Chatbot

## Description

This project is an AI chatbot for Planet Beauty, built with Next.js and deployed on Vercel. It uses the Google Gemini API for natural language understanding and the Upstash Vector database for product search and retrieval. It also integrates with the Shopify Admin API to sync product data.

## Current Status (As of May 8, 2025 - Evening)

*   **Core Functionality & Stability:**
    *   All verification checks (`npm run lint`, `npm run build`, `npm test`) are passing.
    *   Linting errors in `app/api/sync-products/route.ts` (related to `@ts-expect-error`) have been resolved.
    *   Build errors in `app/api/chat/route.ts` (related to hybrid query payload typing) have been fixed.
    *   Unit test mocks in `test/chat.test.js` for `@google/generative-ai` embedding model have been corrected.
*   **Product Synchronization (`/api/sync-products` & `simulate-sync.ts`):**
    *   The product sync API (`app/api/sync-products/route.ts`) has been updated to remove the hardcoded limit of 10,000 fetched products, allowing it to attempt syncing all products from Shopify by paginating as long as a cursor is available.
    *   The Upstash index (`UPSTASH_VECTOR_URL`) is confirmed to be configured for hybrid search (768-dim dense + sparse).
    *   Full product synchronization is currently on hold pending verification of the complete sync process and resolution of any potential timeout or resource issues with large datasets.
*   **Chat Functionality (`/api/chat` & `simulate-chat.ts`):**
    *   The chat API (`app/api/chat/route.ts`) has been updated to ensure it attempts hybrid queries correctly (sending both `vector` and `data`) and connects to the same hybrid index as the sync API.
    *   The chat simulation (`simulate-chat.ts`) connects successfully to the API.
    *   **Key Issue (On Hold):** Despite the hybrid index configuration and API updates, the chat simulation **still fails to retrieve any specific products** from the vector index. Debugging this specific issue is paused.
*   **Current Focus (AI Smart Interactions - Completed for this iteration):**
    *   The primary focus was on **improving AI smart interactions**, specifically how the AI handles simple greetings and conversational turns.
    *   **Key Changes Implemented:**
        *   **AI Smart Interactions (`app/api/chat/route.ts`):**
            *   Refined Gemini prompt and response logic to handle simple greetings and conversational turns more naturally, avoiding awkward product-related advice.
            *   Added a 10-second timeout wrapper for Gemini API calls to prevent Vercel function timeouts.
            *   Ensured Upstash Vector client initialization cleans URL/token strings.
        *   **Product Synchronization (`app/api/sync-products/route.ts`):**
            *   Removed the hardcoded 10,000 product fetch limit to allow for full synchronization of all products.
            *   Ensured Upstash Vector client initialization cleans URL/token strings to prevent parsing errors.
            *   Added a 500ms delay between batch upserts to manage load.
            *   Refined duplicate product checking logic to correctly handle items potentially missing dense vectors from previous sparse-only fallbacks.
        *   **Linting & Build:** Resolved all ESLint errors and ensured the project builds successfully.
    *   These changes were verified by linting, building, and running simulations.
    *   **Next Steps:** Monitor chat interactions and the full sync process (especially with the removed fetch limit) for stability, performance, and any further issues.

## Technologies Used

*   Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS
*   Backend: Next.js API Routes (Serverless Functions on Vercel)
*   AI: Google Gemini API
*   Vector Database: Upstash Vector (intended for Hybrid Search - Dense + Sparse/BM25, requires correct index configuration)
*   Caching & Session Management: Upstash Redis
*   E-commerce Integration: Shopify Admin API & Storefront API

## Upstash Vector (Hybrid Search)

The project utilizes Upstash Vector for product search, configured to use Hybrid Search. This combines the strengths of:
*   **Dense Vectors (Semantic Search):** For understanding the meaning and context of user queries and product descriptions. The target dense embedding model is `google-bert/bert-base-uncased` (768 dimensions).
*   **Sparse Vectors (BM25 - Keyword Search):** For precise keyword matching.

The `app/api/sync-products/route.ts` API fetches product data from Shopify, generates 768-dimension dense vectors (using Google's `models/embedding-001`), prepares `textForBM25` metadata, and upserts data suitable for a hybrid index. It includes:
*   Error handling for sparse-only indexes (falls back to sparse upsert if dense/hybrid upsert fails with "This index requires sparse vectors").
*   A 30-second request timeout for Upstash Vector client operations.
*   A duplicate checking mechanism to avoid re-upserting unchanged products (compares both vector and metadata).
*   Batch processing (`BATCH_SIZE_VECTOR = 25`) to manage Vercel serverless function execution limits.

**Example Upstash Vector SDK Usage (Illustrative):**
```typescript
import { Index } from "@upstash/vector";
// Initialize the client with your actual URL and token from environment variables
const index = new Index({
  url: process.env.UPSTASH_VECTOR_URL || "YOUR_UPSTASH_VECTOR_URL_PLACEHOLDER",
  token: process.env.UPSTASH_VECTOR_TOKEN || "YOUR_UPSTASH_VECTOR_TOKEN_PLACEHOLDER",
  requestTimeout: 30000, // Example of request timeout
});

// Example: Upserting data for hybrid search
// (The actual structure might vary slightly based on specific needs and SDK version)
await index.upsert({
  id: "product-id-123",
  vector: [0.1, 0.2, /* ...768 dimensions */], // Dense vector from embedding model
  // For hybrid search, text data for BM25 is often passed in metadata
  metadata: { 
    textForBM25: "Product Title Product Description relevant keywords",
    title: "Product Title",
    // ... other metadata fields
  },
});

// Example: Querying the hybrid index (as implemented in app/api/chat/route.ts)
const queryText = "user search query string";
const queryVector = await generateEmbeddings(queryText); // Generate 768-dim vector

if (queryVector) {
  // Hybrid Search
  await index.query({
    vector: queryVector,      // Dense query vector
    data: queryText,          // Query text for BM25 sparse search
    topK: 5,
    includeMetadata: true,
  } as any); // Type assertion might be needed depending on SDK version/typings
} else {
  // Fallback Sparse Search
  await index.query({
    data: queryText,          // Query text for BM25 sparse search
    topK: 5,
    includeMetadata: true,
  });
}

```
**Note:** For optimal performance and to fully utilize hybrid search, the Upstash Vector index should be configured to support both 768-dimension dense vectors and sparse (BM25) data. The sync API includes workarounds if the index is sparse-only (e.g., by attempting a sparse-only upsert if a hybrid upsert fails with a relevant error message) and a duplicate check to prevent re-processing identical items.

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

**Note:** The test environment uses `jsdom` by default, but API route tests (like `test/api/sync-products/route.test.ts`) use the `node` environment via a `// @jest-environment node` directive. A polyfill for `Request` (`jest.setup.js`) is used to handle Web API dependencies in the test environment. Mocks for `next/server` and specific API routes (`__mocks__/`) are used to isolate testing.

5.  **Set up a custom domain (optional):**
    *   In the Vercel dashboard, set up a custom domain for the project.

## Testing

Unit tests are written using Jest. All unit tests, including those for the product sync API (`test/api/sync-products/route.test.ts`) and chat functionalities, were passing as of the last run after recent modifications. The codebase also passes all lint checks. Run all tests with:

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
