# Planet Beauty AI Chatbot: Intelligent Shopping Assistant

## 🚀 Project Overview

Welcome to the Planet Beauty AI Chatbot project! This isn't just a chatbot; it's an intelligent shopping assistant designed to revolutionize the online shopping experience for Planet Beauty customers. Built with cutting-edge AI and seamless e-commerce integration, this chatbot aims to provide personalized assistance, intelligent product recommendations, and instant answers, driving customer engagement and sales.

Our solution leverages the power of Google's Gemini API for sophisticated natural language understanding and Upstash Vector for lightning-fast, relevant product searches. Deep integration with Shopify ensures real-time product data accuracy and a smooth path from query to checkout.

## ✨ Key Features

*   **Natural Language Conversations:** Understands complex user queries, intent, and context using Google Gemini.
*   **Intelligent Product Search:** Utilizes Upstash Vector (BM25 sparse search) for quick and accurate product discovery.
*   **Shopify GraphQL Fallback:** Ensures product information is always available, even if vector search limits are encountered.
*   **Contextual Chat History:** Remembers previous turns in the conversation for a more natural interaction.
*   **Real-time Product Sync:** Keeps product information up-to-date via Shopify Admin API.
*   **Efficient Caching & Rate Limiting:** Employs Upstash Redis for optimized performance and stability.
*   **Scalable Architecture:** Built on Next.js and Vercel.

## 📈 Business Value for Planet Beauty

*   **Enhanced Customer Experience:** Provides instant, 24/7 support and personalized shopping guidance.
*   **Increased Sales Conversion:** Helps customers find the right products quickly.
*   **Improved Customer Engagement:** Offers an interactive way for customers to connect with the brand.
*   **Reduced Support Load:** Automates responses to common queries.

## 🛠️ Current Development Status (As of May 10, 2025 - Mid-Day)

The project is actively being refined, with significant progress made in stabilizing core chat functionalities. However, a persistent TypeScript issue is currently a primary focus.

*   **Chat API (`app/api/chat/route.ts`) Enhancements & Status:**
    *   **Improved Greeting & General Query Handling:** The chatbot correctly handles greetings and general questions without erroneous product searches.
    *   **Shopify GraphQL Fallback:** Implemented and functional.
    *   **Metadata ID Handling:** Addressed.
    *   **Search Parameter Tuning:** `SIMILARITY_THRESHOLD` is at `2`.
    *   **Vendor Filtering Logic:** Corrected.
    *   **Attribute Filtering Attempt:** Logic broadened, but requires ongoing refinement.
    *   **Persistent TypeScript Error:** A critical TypeScript error on line 606 (previously 597) of `app/api/chat/route.ts` (`Type 'string | boolean' is not assignable to type 'boolean'`) remains unresolved despite multiple attempts using type guards, explicit coercion, and direct type definitions for `geminiResult.is_product_query`. This is the highest priority technical debt.
*   **Product Search & Filtering (Ongoing Debugging - Blocked by TS Error):**
    *   Further refinement of search logic for specific queries (e.g., "vegan lipstick", "cheap sunscreen") is pending resolution of the TypeScript error.
    *   **Key Insight (Still Valid):**
        *   `productType` field is often empty/generic.
        *   Specific attributes are frequently in `textForBM25`.
*   **Environment & Stability:**
    *   Environment variable configurations are stable.
*   **Simulation Testing (`simulate-chat.ts`):**
    *   This script remains the primary tool for end-to-end testing. It will be updated to reflect currency considerations for price-based queries (e.g., using Peso-equivalent values) once the API is stable.

## 💡 Next Steps & Roadmap (New Thread - To Be Created)

The immediate focus for the next development cycle will be:

1.  **RESOLVE TYPESCRIPT ERROR (CRITICAL BLOCKER):** Address the persistent TypeScript error in `app/api/chat/route.ts` (line 606) to ensure code health, accurate type checking, and unblock further development on search logic.
2.  **Refine Product Search & Filtering Logic (High Priority - Post TS Fix):**
    *   Continue to adapt the filtering logic in `performVectorQuery` in `app/api/chat/route.ts` based on the observed metadata structure.
    *   Improve handling of multi-type queries (e.g., "cleanser and moisturizer").
3.  **Update `simulate-chat.ts` (Medium Priority):** Modify test cases, particularly price-based queries, to align with the store's currency (Pesos).
4.  **Address Nonsensical Input Handling (Medium Priority):** Improve Gemini's prompt or the API's logic for gibberish inputs.
5.  **Continue with `ai_chat_todo.md` (Ongoing):** Systematically address remaining tasks, including rebuilding Jest unit tests and expanding simulation scenarios.

## 💻 Technology Stack

*   **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
*   **Backend:** Next.js API Routes (Serverless Functions on Vercel)
*   **AI - Language Model:** Google Gemini API
*   **AI - Vector Search:** Upstash Vector (Sparse Search - BM25)
*   **Caching & Session Management:** Upstash Redis, LRUCache
*   **E-commerce Platform:** Shopify (Admin API - GraphQL, Storefront API)
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
  "price": "3400.0", // Note: Appears to be in Pesos (e.g., 3400.00 means ₱3400)
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
*   **Jest Unit Tests:** Rebuilding Jest tests is a pending task.
*   **Simulation (`simulate-chat.ts`):** Primary tool for E2E testing. Will be updated for currency values. Run with `node --loader ts-node/esm simulate-chat.ts`.

## 🔑 Environment Variables (Essential)
(List of essential environment variables like `UPSTASH_VECTOR_REST_URL`, `GEMINI_API_KEY`, Shopify tokens, etc., remains the same.)

## Troubleshooting Tips
*   **Product Search Failures:**
    *   Verify that the `productType` and `attributes` being filtered for exist in the expected fields of products in Upstash Vector.
    *   Ensure price filters in `simulate-chat.ts` account for Pesos.
*   **TypeScript Errors:** The persistent error on line 606 of `app/api/chat/route.ts` is a known critical issue. The type of `geminiResult.is_product_query` is not being correctly inferred as a boolean despite multiple attempts at coercion and type guarding. This needs to be the top priority for resolution.

---

This README reflects the current understanding and ongoing efforts to enhance the Planet Beauty AI Chatbot as of May 10, 2025.
