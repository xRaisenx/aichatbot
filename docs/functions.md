# Functions Library Dictionary

This document provides a concise reference for key functions, variables, and components in the codebase, focusing on critical elements to prevent accidental deletion and ensure maintainability. It includes dependency tracking, maintenance guidelines, and styling information.

---

## 📁 File Overview

- **Core Libraries**: `lib/redis.ts`, `lib/llm.ts`, `lib/types.ts`
- **Components**: `components/ChatInterface.tsx`, `components/ProductCard.tsx`, `components/KnowledgeBaseDisplay.tsx`, `components/ThemeToggle.tsx`, `components/ProductCarousel.tsx`
- **Providers**: `providers/ThemeProvider.tsx`
- **Tests**: `src/lib/redis.test.ts`, `src/lib/chat.route.test.ts`
- **Styles**: `styles/ChatInterface.module.css`, `styles/globals.css`

---

## 📚 redis.ts

### Variables
- `redisClient`: Redis client instance for database operations
- `logger`: Pino logger for logging with severity levels
- `RESPONSE_CACHE_PREFIX`, `SESSION_PREFIX`, `KNOWLEDGEBASE_PREFIX`, `EMBEDDING_PREFIX`: Cache key prefixes
- `RESPONSE_TTL` (10 min), `SESSION_TTL` (30 min), `KNOWLEDGEBASE_TTL` (30 days), `EMBEDDING_TTL` (1 day): Cache time-to-live settings
- `STATIC_BASE_PROMPT_CONTENT`: Placeholder for LLM base prompt (currently empty, dynamically built in `llm.ts`)

### Critical Functions
| Function | Purpose | Parameters | Returns |
|----------|---------|-----------|--------|
| `normalizeQuery(query: string)` | Normalizes query strings for Redis keys | Query string | Normalized string |
| `extractKeywords(query: string)` | Extracts keywords for caching | Query string | Array of keywords |
| `cacheResponse(userId: string, query: string, response: ChatApiResponse)` | Caches chat responses | User ID, query, response | `Promise<void>` |
| `getCachedResponse(userId: string, query: string)` | Retrieves cached responses | User ID, query | `Promise<CachedResponse \| null>` |
| `cacheSessionHistory(userId: string, history: ChatHistory)` | Caches session history | User ID, history | `Promise<void>` |
| `getSessionHistory(userId: string)` | Retrieves session history | User ID | `Promise<ChatHistory \| null>` |
| `cacheEmbedding(userId: string, query: string, intent: string, fields: Partial<ChatApiResponse>)` | Caches embeddings | User ID, query, intent, fields | `Promise<void>` |
| `getCachedEmbedding(userId: string, query: string)` | Retrieves cached embeddings | User ID, query | `Promise<CachedEmbedding \| null>` |
| `updateKnowledgebase(query: string, answer: string, productTypes?: string[], attributes?: string[])` | Updates knowledgebase entries | Query, answer, optional product types/attributes | `Promise<void>` |
| `getKnowledgebaseEntry(query: string)` | Retrieves knowledgebase entries | Query | `Promise<KnowledgebaseEntry \| null>` |
| `invalidateProductCaches()` | Invalidates product-related caches | None | `Promise<void>` |
| `warmProductCache()` | Warms product cache with popular items | None | `Promise<void>` |
| `getCacheStats()` | Retrieves cache statistics | None | `Promise<Record<string, any>>` |
| `invalidateCache(userId: string, query: string)` | Invalidates cache entries | User ID, query | `Promise<void>` |

---

## 📚 llm.ts

### Variables
- `logger`: Pino logger for logging
- `genAI`: GoogleGenerativeAI instance
- `model`: Gemini model with safety settings
- `fictionalTerms`: List of fictional product terms for query validation

### Critical Functions
| Function | Purpose | Parameters | Returns |
|----------|---------|-----------|--------|
| `isPotentiallyFictional(query: string)` | Detects fictional product queries | Query | `boolean` |
| `extractPriceFilter(query: string)` | Extracts price filter from query | Query | `{ max_price: number; currency: string } \| null` |
| `isFollowUpClarification(query: string, chatHistory: ChatHistory)` | Identifies follow-up clarifications | Query, history | `boolean` |
| `impliesProductList(query: string)` | Checks if query implies product list | Query | `boolean` |
| `preprocessQuery(query: string, chatHistory: ChatHistory)` | Extracts query metadata | Query, history | `QueryMetadata` |
| `getConversationalAdvice(query: string, metadata: QueryMetadata, provider: string)` | Gets conversational advice | Query, metadata, provider | `Promise<string>` |
| `generateLLMResponse(systemPrompt: string, chatHistory: ChatHistory, userQuery: string)` | Generates LLM response | Prompt, history, query | `Promise<LLMStructuredResponse>` |

---

## 📚 types.ts

### Interfaces
- `ChatMessage`: Single chat message structure
- `ChatHistory`: Ordered sequence of chat messages
- `ProductVectorMetadata`: Metadata for product vectors
- `ProductCardResponse`: Structure for product card UI
- `LLMStructuredResponse`: LLM response JSON structure
- `ChatApiResponse`: Structure for `/api/chat` endpoint
- `GenerateSuggestedQuestionsRequest`: Request body for `/api/chat/generate-suggested-questions`

---

## 🎨 Styling and Theming

### ChatInterface.module.css
- **Key Classes**: `.widget`, `.toggle`, `.container`, `.header`, `.controls`, `.area`, `.message-base`, `.user-message`, `.bot-message`, `.messageBubble`, `.typing-container`, `.productCard`, `.productImage`, `.productInfo`, `.chip`, `.inputArea`, `.footer`
- **Features**: Responsive layout, themed colors, hover effects, animations for typing indicator

### globals.css
- **Features**: Montserrat font, reset styles, color variables (`--pb-white`, `--pb-pink`, etc.), `slideIn`/`bounce` animations, mobile-responsive chatbox adjustments

### ThemeProvider.tsx
- **Exports**: `ThemeProvider`, `useTheme`
- **Functionality**: Manages light/dark mode, persists to localStorage, applies theme classes
- **Used By**: `ChatInterface.tsx`, `ThemeToggle.tsx`, `app/layout.tsx`

### Component Styling
- **KnowledgeBaseDisplay.tsx**: FAQ-style answers with DOMPurify for safe HTML, themed borders/padding
- **ThemeToggle.tsx**: Light/dark mode toggle with emoji icons (🌙/☀️), rounded corners, hover effects
- **ProductCard.tsx/ProductCarousel.tsx**: Consistent product displays with shadows, responsive layouts, themed colors

---

## 🧪 Testing Implementation

### Test Files
- **redis.test.ts**: Tests Redis client, caching, invalidation, and statistics
- **chat.route.test.ts**: Tests end-to-end chat flows, history, and suggested questions

### Coverage Areas
1. **Core Functionality**: Chat exchange, caching, knowledgebase, product recommendations
2. **Performance**: Response time, memory usage, cache hit/miss
3. **Error Handling**: Network failures, invalid inputs, timeouts
4. **Security**: XSS protection, input sanitization, secure Redis
5. **Edge Cases**: Long messages, special characters, rapid requests
6. **UX**: Typing indicators, loading states, theme switching

### Testing Tools
- Vitest, React Testing Library, Supertest, Cypress, Jest, DOMPurify, MSW, Sinon.js, Chai, Mocha, Nock

---

## 📦 Dependency Tracking

### redis.ts
- **Exports**: `redisClient`, cache prefixes, TTLs, `STATIC_BASE_PROMPT_CONTENT`, all cache functions
- **Used By**: `llm.ts`, `ChatInterface.tsx`, `redis.test.ts`, `chat.route.test.ts`
- **Depends On**: `@upstash/redis`, `pino`, `types.ts`

### llm.ts
- **Exports**: All LLM functions
- **Used By**: `ChatInterface.tsx`, `chat.route.test.ts`
- **Depends On**: `@google/generative-ai`, `node-fetch`, `pino`, `redis.ts`, `types.ts`

### types.ts
- **Exports**: All interfaces
- **Used By**: `llm.ts`, `redis.ts`, `ChatInterface.tsx`, `ProductCard.tsx`, `chat.route.test.ts`

### Components
- **ChatInterface.tsx**:
  - **Depends On**: `react`, `next/image`, `isomorphic-dompurify`, `llm.ts`, `types.ts`, `ThemeProvider`, `ChatMessage`, `ProductCard`, `KnowledgeBaseDisplay`, `ThemeToggle`
- **ThemeToggle.tsx**: Depends on `react`, `ThemeProvider`
- **ProductCard.tsx**: Depends on `react`, `types.ts`
- **KnowledgeBaseDisplay.tsx**: Depends on `react`, `isomorphic-dompurify`

---

## 🧠 AI Instructions Handling
- **STATIC_BASE_PROMPT_CONTENT** (redis.ts):
  - Purpose: Placeholder for LLM base prompt, dynamically built in `llm.ts`
  - Usage: Guides LLM response format, tone, and product knowledge
  - Notes: Keep as placeholder; sensitive content not documented for security
  - Optimization: Move static parts to `STATIC_BASE_PROMPT_CONTENT` to reduce dynamic overhead

---

## 🧩 Maintenance Guidelines

### Critical Elements to Preserve
- **Files**: `redis.ts`, `llm.ts`, `types.ts`, `ChatInterface.tsx`, `ThemeProvider.tsx`, `ChatInterface.module.css`
- **Constants**: Cache prefixes, TTLs, `STATIC_BASE_PROMPT_CONTENT`, type definitions
- **Functions**: `cacheResponse`, `getCachedResponse`, `cacheSessionHistory`, `getSessionHistory`, `generateLLMResponse`, `preprocessQuery`

### Safe Modification Workflow
1. Review dependencies and tests
2. Backup files
3. Update documentation (functions.md)
4. Make incremental changes
5. Run tests (`redis.test.ts`, `chat.route.test.ts`)
6. Verify integration and performance
7. Document breaking changes

### Interface Stability
- Maintain function signatures and return types for exported functions
- Preserve type definitions in `types.ts`
- Update dependent components before core changes
- Keep CSS class structure in `ChatInterface.module.css`

---

## 📊 Codebase Statistics
- **Total Files**: 43
- **Line Counts**:
  - `redis.ts`: 337
  - `llm.ts`: 345
  - `ChatInterface.tsx`: 42
  - `ChatInterface.module.css`: 531
- **Review Time Estimates**:
  - `redis.ts`, `llm.ts`: 20-35 min
  - `ChatInterface.tsx`: 15-20 min
  - `ChatInterface.module.css`: 30-40 min

---

## 📌 File Dependency Graph
```
app/layout.tsx
└── ThemeProvider.tsx
    ├── ThemeToggle.tsx
    └── ChatInterface.tsx
        ├── llm.ts
        │   ├── redis.ts
        │   │   ├── redis.test.ts
        │   │   └── chat.route.test.ts
        │   ├── node-fetch
        │   └── pino
        ├── ChatMessage.tsx
        ├── ProductCard.tsx
        │   └── types.ts
        ├── KnowledgeBaseDisplay.tsx
        │   └── isomorphic-dompurify
        └── ProductCarousel.tsx
```
