# Project Structure: Planet Beauty AI Chatbot (Vercel/Next.js)

This document outlines the current and anticipated structure of the Planet Beauty AI Chatbot project, developed using Next.js and deployed on Vercel. It captures the transition from Google Apps Script to a modern web application stack and highlights ongoing development efforts.

## Key Technologies Utilized

*   Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS
*   Backend: Next.js API Routes (Serverless Functions on Vercel)
*   AI: Google Gemini API (for natural language understanding, intent recognition, embeddings, and text generation)
*   Vector Database: Upstash Vector (for product embeddings and semantic search via `idx:products_vss`)
*   Caching, Session Management & Knowledge Base: Upstash Redis (for API response caching, chat session history, dynamic knowledge base for common Q&A, and rate limiting)
*   Relational Data: SQLite via Prisma (Groundwork laid, optional, for persistent user data and admin information)
*   E-commerce Integration: Shopify Admin API & Storefront API

## Folders

### /app

The core of the Next.js 13+ application, leveraging the App Router. It includes layouts, pages (both server and client components), and API route handlers.

**Files:**

*   `eslint.config.js`: Configuration file for ESLint to enforce code quality and consistency.
*   `favicon.ico`: The application's favicon displayed in browser tabs.
*   `globals.css`: Global CSS styles applied across the entire application.
*   `layout.tsx`: Root layout defining shared UI elements (e.g., navigation, footer) and wrapping content with providers like ThemeProvider.
*   `page.tsx`: Main entry point for the homepage (e.g., https://pbaichatbot.vercel.app/), likely rendering the ChatInterface component.

**Subfolders:**

*   `/admin`: Contains pages and components for an admin dashboard.
    *   `/dashboard`
        *   `page.tsx`: Main page for the admin dashboard UI.
    *   `(Other admin-specific pages)`: e.g., `/admin/users/page.tsx`, `/admin/products/page.tsx`.
*   `/api`: Houses all backend API route handlers.
    *   `/chat`
        *   `route.ts`: Core endpoint handling chat messages. Integrates Gemini AI (via `lib/llm.ts`), Upstash Vector (for product search), and Upstash Redis (for API response caching, session history, and knowledge base updates). Implements logic for prioritizing product cards and skipping vector search for fictional or clarification queries. Also includes fixes for `is_product_query` misclassification and `userId` handling.
        *   `generate-suggested-questions/route.ts`: API endpoint (POST) for generating AI-suggested questions. Handles requests for 4 general welcome questions (for initial chat load, `type: 'initial'`) and 3 contextually relevant suggested questions based on conversation history (`type: 'contextual'`).
    *   `/sync-products`
        *   `route.ts`: Endpoint for syncing Shopify products to Upstash Vector. Also triggers invalidation of relevant Redis caches. Potentially triggered manually or via cron.
    *   `/admin/[...slug]`
        *   `route.ts`: API routes for admin tasks (e.g., user management, analytics).
    *   `/analytics`
        *   `route.ts`: (If implemented) Logs analytics events like search queries or user interactions.
    *   `/user`
        *   `route.ts`: (If implemented with Prisma) Manages user data such as preferences or saved items.
*   `/test-chat`
    *   `page.tsx`: A dedicated page for testing chat functionality.

### /components

Contains reusable React UI components used throughout the application.

**Files:**

*   `ChatInterface.tsx`: Primary chat UI component. Manages user input, displays conversation history via `ChatMessage`. Fetches and displays 4 AI-generated suggested questions on initial load, and also fetches and displays 3 new, contextually relevant AI-generated suggested questions after each chatbot response.
*   `ChatMessage.tsx`: Renders individual chat messages (user or bot) with styling.
*   `ComplementaryProducts.tsx`: Displays suggested complementary products.
*   `KnowledgeBaseDisplay.tsx`: Shows structured non-product knowledge base info (if implemented).
*   `ProductCard.tsx`: Displays product details (image, name, price, etc.) from Shopify.
*   `ProductComparison.tsx`: Enables side-by-side product comparisons.
*   `ThemeToggle.tsx`: Allows switching between light and dark themes.
*   `(Optional) LoadingSpinner.tsx` or `SkeletonLoader.tsx`: Indicates loading states.

### /lib

Holds utility functions, helper modules, SDK initializations, and business logic not tied to API routes or UI components.

**Files:**

*   `gemini.ts` (or `lib/llm.ts` as per current project): Interacts with the Google Gemini API. Checks Redis knowledge base (via `getKnowledgebaseEntry` from `redis.ts`) before making an API call. Handles JSON parsing and fallback logic. Implements improved logging, enhanced fallback logic, query classification, structured response formatting, and ensures consistency with test expectations.
*   `redis.ts`: Manages Upstash Redis connections and provides functions for API response caching, session history management, dynamic knowledge base (with keyword similarity search), cache invalidation, and storing/retrieving the base system prompt. Exports `redisClient` for direct use in other modules if needed.
*   `vectorDb.ts` (or `upstashVector.ts`): Handles Upstash Vector operations for product embeddings and search (Note: `vectorIndex` is currently initialized directly in `app/api/chat/route.ts` and `lib/redis.ts`).
*   `shopify.ts`: Interfaces with the Shopify Storefront API for product data and potential cart features.
*   `shopify-admin.ts`: Connects to the Shopify Admin API for sync and admin tasks.
*   `(Optional) prisma.ts`: Initializes Prisma client for SQLite (if used).
*   `(Optional) utils.ts` or `helpers.ts`: General utility functions (e.g., formatting, error handling).

### /providers

Contains React Context providers for global state management.

**Files:**

*   `ThemeProvider.tsx`: Manages theme context (light/dark mode) across the app.

### /public

Stores static assets served directly by the web server.

**Files:**

*   `file.svg`: A static SVG asset.
*   `globe.svg`: A static SVG asset.
*   `next.svg`: A static SVG asset.
*   `planet-beauty-logo.png`: The Planet Beauty logo.
*   `vercel.svg`: A static SVG asset.
*   `window.svg`: A static SVG asset.
*   `(Optional)`: Files like `robots.txt`, `sitemap.xml`.

### /styles

Contains CSS modules or additional stylesheets (note: globals.css is in /app).

**Files:**

*   `ChatInterface.module.css`: Styles specific to the ChatInterface component (if using CSS Modules).

*Note: Tailwind CSS reduces reliance on separate CSS files by using utility classes in TSX.*

### /prisma (If using Prisma)

Contains Prisma-related files for relational data management.

**Files:**

*   `schema.prisma`: Defines the database schema for Prisma.
*   `/migrations`: Stores migration files generated by Prisma.

## Root Files

*   `.env` (or `.env.local, .env.production`): Stores environment variables (e.g., API keys, database URLs). Keep out of version control.
*   `mcp-server.js`: A custom server script that provides JSON-RPC and HTTP interfaces for interacting with Shopify. It supports commands like fetching and syncing products, operates in `stdio` or `http` transport modes, and includes robust logging and security features.
*   `next.config.js`: Configures Next.js settings (e.g., image optimization, redirects).
*   `package.json`: Lists dependencies and scripts for project management.
*   `tailwind.config.js`: Customizes Tailwind CSS settings.
*   `test-chat.js`: Standalone script for testing chat functionality.
*   `test-redis-vector.js`: Standalone script for testing Redis and vector functionality.
*   `tsconfig.json`: Configures TypeScript compiler options.
*   `eslint.config.js`: Sets up ESLint for code linting.
*   `.gitignore`: Specifies files for Git to ignore (e.g., node_modules, .env).
*   `README.md`: Documents project overview and setup instructions.
*   `scripts/populate-vector-index.ts`: Populates the Upstash Vector index with sample products for testing, ensuring product searches return expected results. This script uses @upstash/vector and pino for logging, and now includes a fix for the id type error and enhanced logging.

This structure supports the Planet Beauty AI Chatbot's core features, AI integrations, and scalability, aligning with Next.js best practices and enabling future enhancements like deeper Shopify integration and admin tools.

The project also includes a `planet-beauty-ai-chat` folder, which contains a separate Remix application.
