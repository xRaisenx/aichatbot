# 💬 Chat Interface Documentation

This document provides a comprehensive overview of how the chat interface interacts with users and the AI system, including its implementation, underlying logic, and integration points.

## 🧠 1. Chat Architecture Overview

The chat interface is a sophisticated system that combines multiple technologies to provide intelligent, context-aware responses to user queries.

``mermaid
graph TD
    A[User Input] --> B[Chat Interface]
    B --> C[Gemini LLM Analysis]
    C --> D{Cache Check}
    D -->|Hit| E[Redis Cache Response]
    D -->|Miss| F[Vector Search]
    F --> G{Vector Results}
    G -->|Found| H[Product Recommendations]
    G -->|Not Found| I[Shopify GraphQL Fallback]
    H --> J[Structured Response]
    I --> J
    J --> K[Response Parser]
    K --> L[Chat Message Rendering]
    L --> M[Product Card Display]
    L --> N[Follow-up Questions]
```

## 🛠️ 2. Implementation Details

### 📁 File Structure
```
├── app/
│   └── api/
│       └── chat/
│           ├── route.ts - Main chat API logic
│           └── get-history/
│               └── route.ts - History fetching endpoint
├── components/
│   ├── ChatInterface.tsx - Main chat UI component
│   ├── ChatMessage.tsx - Individual message rendering
│   ├── ProductCard.tsx - Product recommendation display
│   └── ProductCarousel.tsx - Multiple product display
├── lib/
│   ├── llm.ts - Gemini LLM integration
│   ├── redis.ts - Redis cache and knowledge base
│   └── types.ts - Type definitions
└── styles/
    └── ChatInterface.module.css - Shared styling for chat and product cards
```

### 🧩 Key Technologies

- **Google Gemini API**: For natural language understanding and response generation
- **Upstash Redis**: For caching responses, maintaining conversation history, and knowledge base
- **Upstash Vector**: For semantic product search
- **Next.js App Router**: For server-side rendering and API routes
- **Pino**: For logging and debugging
- **Embla Carousel**: For displaying multiple product recommendations

## 🗨️ 3. User Interaction Flow

### ✨ Initial Setup

When the chat interface loads, it displays:

1. A welcome message (configurable via environment variable)
2. A set of initial suggested questions
3. The input field for user messages

```typescript
// From ChatInterface.tsx
const welcomeMessageText =
  process.env.NEXT_PUBLIC_WELCOME_MESSAGE ||
  "Welcome! How can I help you find beauty products today?";

const fallbackSuggestedQuestions = [
  "What are the best products for oily skin?",
  "Can you suggest a good hydrating serum?",
  "Show me popular vegan makeup items.",
  "Find cleansers suitable for sensitive skin.",
];
```

### 🧒 User Input

Users can interact with the chat in several ways:

1. Typing free-form questions
2. Clicking on suggested questions
3. Submitting multi-turn requests through follow-up questions
4. Requesting new conversation to clear history

### 🤖 AI Processing

When a query is submitted, the system follows this processing flow:

1. **Query Validation**: Checks if the query is empty or invalid
2. **History Fetch**: Retrieves conversation history from Redis
3. **Cache Check**: Looks for cached responses to similar queries
4. **Knowledge Base Check**: Verifies if the query relates to non-product information
5. **LLM Analysis**: Uses Gemini LLM to understand intent and generate structured response
6. **Vector Search**: If products are needed, performs semantic search using Upstash Vector
7. **Response Generation**: Creates final response with content and recommendations
8. **Display**: Renders response with appropriate formatting and follow-up questions
9. **Context Update**: Stores the interaction in Redis for future reference

## 🎯 4. AI Logic and Prompts

### 🧠 Gemini LLM Integration

The system uses Google's Gemini API for natural language understanding and response generation.

```typescript
// From llm.ts - Gemini model configuration
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

const logger = pino({ level: 'warn' });

// Validate environment variables
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY must be set for Gemini provider');
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genApi.getGenerativeModel({
  model: 'gemini-1.5-flash',
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ],
});
```

### 🔍 Query Preprocessing

The LLM includes sophisticated preprocessing to categorize and understand user queries:

```typescript
// From llm.ts - Query preprocessing function
function preprocessQuery(query: string, chatHistory: ChatHistory): QueryMetadata {
  const normalizedQuery = query.trim().toLowerCase();
  const isProductQuery = /(lipstick|moisturizer|serum|sunscreen|mascara|cleanser|toner|shampoo|conditioner|lotion|mask|treatment|oil|balm|cream|gel|powder|spray|set|combo)/i.test(normalizedQuery);
  
  // ... other preprocessing logic
}
```

### 🪄 Structured Response Format

The system generates a structured response format that includes:

- Natural language advice
- Product recommendations (single or carousel)
- Follow-up questions
- Metadata about query type and characteristics

``typescript
// Example response structure from route.ts
interface ChatApiResponse {
  advice: string; // Natural language advice
  product_card?: ProductCardResponse; // Single product recommendation
  complementary_products?: ProductCardResponse[]; // Additional product recommendations
  products: ProductCardResponse[]; // All product recommendations
  is_product_query: boolean; // Whether this is a product-related query
  ai_understanding: string; // Explanation of what the query was understood as
  // ... other metadata fields
}
```

## 🔄 5. Follow-Up Questions

### 🧮 Generation Logic

The system generates relevant follow-up questions based on the current conversation context:

1. The Gemini LLM analyzes the conversation history and latest response
2. It generates follow-up questions in the `suggested_follow_ups` field
3. The frontend displays up to 2 follow-up questions by default, with option to show more

``tsx
// From ChatInterface.tsx - Follow-up question rendering
{hasFollowUpQuestions && followUpQuestions && (
  <div className={styles.examples}>
    {followUpQuestions.slice(0, followUpQuestionsToShow).map((question, index) => (
      <button
        key={index}
        onClick={() => handleExampleClick(question)}
        className={styles.chip}
        aria-label={`Ask: ${question}`}
      >
        {question}
      </button>
    ))}
    {followUpQuestions.length > followUpQuestionsToShow && (
      <button
        onClick={() => setShowMoreFollowUpQuestions(!showMoreFollowUpQuestions)}
        className={styles.chip}
        aria-label={showMoreFollowUpQuestions ? "Show less follow up questions" : "Show more follow up questions"}
      >
        {showMoreFollowUpQuestions ? "Show Less" : "Show More"}
      </button>
    )}
  </div>
)}
```

## 🧪 6. Simulated Interactions

Here are 5 simulated user-AI interactions to demonstrate how the system works:

### Scenario 1: Product Recommendation

**User:** "What are the best moisturizers for dry skin?"

**AI:** 
For dry skin, I recommend these moisturizers that provide deep hydration:

1. **CeraVe Moisturizing Cream** - $19.99
Rich in ceramides and hyaluronic acid to restore the skin barrier

2. **La Roche-Posay Toleriane Double Repair Face Moisturizer** - $27.00
A lightweight formula with prebiotics for sensitive skin

3. **Origins Mega-Mushroom Relief & Resilience Serum** - $49.00
A calming serum with mushrooms that helps soothe dry, irritated skin

**Follow-up Questions:**
1. "Would you like more details about any of these moisturizers?"
2. "Are you looking for something specific for day or night use?"

### Scenario 2: Comparative Inquiry

**User:** "How do I choose between serum and moisturizer?"

**AI:** 
Serums and moisturizers serve different purposes in a skincare routine:

**Serums** are lightweight formulas with active ingredients that target specific concerns like aging, pigmentation, or acne. They're applied after cleansing and toning, before moisturizer.

**Moisturizers** hydrate and protect the skin barrier. They come in various textures from light lotions to rich creams and should be applied as the final step in your routine.

For optimal results, consider using both: a serum to address specific concerns and a moisturizer to lock in moisture.

**Follow-up Questions:**
1. "Would you like recommendations for a complete skincare routine?"
2. "Are you looking for products suitable for your specific skin type?"

### Scenario 3: Complex Query

**User:** "What sunscreen should I use under makeup?"

**AI:** 
For sunscreen under makeup, look for lightweight, non-greasy formulas that absorb quickly:

1. **EltaMD UV Clear Broad-Spectrum SPF 46** - $39.00
A sheer, lightweight formula with niacinamide that works well under makeup and is ideal for sensitive skin

2. **Supergoop! Unseen Sunscreen SPF 40** - $34.00
An invisible, weightless, oil-free sunscreen with a matte finish that won't pill under makeup

3. **La Roche-Posay Anthelios Mineral Sunscreen SPF 50** - $37.99
A mineral-based option with a transparent finish that's gentle on sensitive skin

**Follow-up Questions:**
1. "Would you like tips on applying sunscreen correctly under makeup?"
2. "Are you looking for a specific formulation (mineral vs chemical)?"

### Scenario 4: Multi-Step Request

**User:** "I need a gift for someone with oily skin. What should I get?"

**AI:** 
For oily skin, focus on products that control shine without over-drying:

1. **Kiehl's Oil Eliminator Facial Cleanser** - $25.00
A refreshing cleanser with salicylic acid to gently exfoliate and remove excess oil

2. **Clinique Clarifying Lotion 2** - $22.50
A mild toner that helps remove residual impurities and prep skin for treatment

3. **Origins Zero Oil Oil-Free Mattifier** - $39.00
A lightweight moisturizer that controls shine while minimizing pores

**Follow-up Questions:**
1. "Would you like to add a travel-sized sample set to try first?"
2. "Are you interested in skincare tools that help apply products effectively?"

### Scenario 5: Ingredient Inquiry

**User:** "Do any of these eye creams contain retinol?"

**AI:** 
You asked about eye creams for dark circles—let’s check if any contain retinol!

1. **Neutrogena Rapid Wrinkle Repair Eye Cream** - $19.99
Contains retinol SA, which helps reduce fine lines and wrinkles

2. **RoC Retinol Correxion Eye Cream** - $14.99
Uses pure retinol to visibly smooth crow's feet and brighten under-eye area

3. **The Ordinary Caffeine Solution 5% + EGCG** - $10.00
While not containing retinol, this caffeine solution helps reduce puffiness and dark circles

**Follow-up Questions:**
1. "Any other ingredients you'd like to know about?"
2. "Want specific brands or formulations?"

## 🎨 7. User Interface Design

### 🧱 Component Structure

The chat interface is composed of several key components:

1. **ChatInterface**: Main container component with all UI elements
2. **ChatMessage**: Displays individual messages with proper formatting
3. **ProductCard**: Renders single product recommendations
4. **ProductCarousel**: Displays multiple product recommendations in a scrollable format
5. **InputArea**: Handles user input and submission

### 🎨 Styling Approach

The styling uses Tailwind CSS with module-specific classes in ChatInterface.module.css:

``css
/* From ChatInterface.module.css */
.widget {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  width: 360px;
  max-width: 100%;
  transition: all 0.3s ease;
}

.toggle {
  background-color: #fbcfe8;
  border: none;
  padding: 10px;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.container {
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 500px;
  width: 100%;
}

.header {
  background-color: #a21caf; /* Tailwind fuchsia-700 */
  color: white;
  padding: 1rem;
  font-weight: bold;
  font-size: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.messageBubble {
  background-color: #f1f5f9; /* Tailwind gray-200 */
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.user-message {
  background-color: #bfdbfe; /* Tailwind blue-200 */
  align-self: flex-end;
}

.bot-message {
  background-color: #f1f5f9; /* Tailwind gray-200 */
  align-self: flex-start;
}

.inputArea {
  display: flex;
  padding: 1rem;
  border-top: 1px solid #e2e8f0; /* Tailwind gray-200 */
  background-color: #f8fafc; /* Tailwind gray-50 */
}

.input {
  flex-grow: 1;
  padding: 0.75rem;
  border: 1px solid #cbd5e1; /* Tailwind gray-300 */
  border-radius: 0.375rem;
  margin-right: 0.5rem;
  font-size: 1rem;
}

.sendBtn {
  background-color: #a21caf; /* Tailwind fuchsia-700 */
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
}

.footer {
  text-align: center;
  padding: 0.5rem;
  font-size: 0.75rem;
  color: #94a3b8; /* Tailwind gray-500 */
}

.productCard {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: transform 0.2s ease;
}

.productCard:hover {
  transform: translateY(-4px);
}

.productImage {
  aspect-ratio: 1 / 1;
  position: relative;
}

.productInfo {
  padding: 1rem;
}

.productTitle {
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.productDescription {
  font-size: 0.85rem;
  color: #4b5563; /* Tailwind gray-700 */
}

.productPrice {
  font-size: 1rem;
  color: #2563eb; /* Tailwind blue-600 */
  font-weight: 500;
  margin: 0.75rem 0;
}

.addToCartButton {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
}

.viewProductPink {
  background-color: #fbcfe8; /* Tailwind pink-200 */
  color: #a21caf; /* Tailwind fuchsia-700 */
  margin-right: 0.5rem;
}

.outOfStock {
  color: #ef4444; /* Tailwind red-500 */
  font-weight: 600;
  margin-top: 0.5rem;
}

.lowStock {
  color: #f59e0b; /* Tailwind amber-500 */
  font-weight: 600;
  margin-top: 0.5rem;
}
```

### 🌈 Visual Enhancements

- Hover effect changes the card's Y position
- Price is displayed in distinctive blue
- Out of stock items show in red
- Low stock items show in amber
- Buttons have subtle hover effects
- Pro Tip section has unique styling for emphasis

## ⚙️ 8. Backend Integration

### 🧠 Data Flow

The chat interface integrates with backend systems through these steps:

1. User submits a query through the chat interface
2. The query is sent to `/api/chat` endpoint
3. The system checks Redis cache for previous responses to similar queries
4. If no cache hit, Gemini LLM analyzes the query to determine intent
5. Vector search is performed with Upstash Vector if product recommendations are needed
6. Shopify API enriches vector search results with detailed product information
7. Final response is returned to the frontend with appropriate formatting
8. The interaction is stored in Redis for future reference and caching

``mermaid
graph TD
    A[User Query] --> B[Gemini LLM Analysis]
    B --> C{Cache Check}
    C -->|Hit| D[Redis Cache Response]
    C -->|Miss| E[Vector Search]
    E --> F[Product Results]
    F --> G[Response Generation]
    G --> H[Redis Knowledge Base Update]
    H --> I[Chat Interface Display]
    I --> J[Product Card Rendering]
    J --> K[Follow-up Question Generation]
```

### 📦 Product Data Structure

The product data used in responses follows this structure:

```json
{
  "textForBM25": "Jane Iredale ColorLuxe Hydrating Cream Lipstick, BLUSH Rich-yet-weightless...",
  "title": "Jane Iredale ColorLuxe Hydrating Cream Lipstick, BLUSH",
  "handle": "jane-iredale-colorluxe-hydrating-cream-lipstick-blush",
  "vendor": "jane iredale",
  "productType": "", // Often empty or generic like "Personal Care"
  "tags": ["beauty", "skincare"], // Often generic, may not contain specific attributes
  "price": "34.00", // Prices are now assumed to be in USD
  "imageUrl": "https://...",
  "productUrl": "/products/...",
  "variantId": "gid://shopify/ProductVariant/48182142828749"
}
```

### 🧩 Key Backend Components

1. **Gemini LLM Processing** (`lib/llm.ts`)
   - Generates search keywords using LLM
   - Processes user queries into structured responses
   - Handles product matching logic

```typescript
// From llm.ts - Query preprocessing
function preprocessQuery(query: string, chatHistory: ChatHistory): QueryMetadata {
  const normalizedQuery = query.trim().toLowerCase();
  const isProductQuery = /(lipstick|moisturizer|serum|sunscreen|mascara|cleanser|toner|shampoo|conditioner|lotion|mask|treatment|oil|balm|cream|gel|powder|spray|set|combo)/i.test(normalizedQuery);
  const complexity = normalizedQuery.split(' ').length > 5 || /and|for|under|between/i.test(normalizedQuery) ? 5 : 3;
  const isFictional = isPotentiallyFictional(normalizedQuery);
  const isClarification = isFollowUpClarification(normalizedQuery, chatHistory);
  
  // ... rest of preprocessing logic
}
```

2. **Vector Search** (`lib/upstash-vector-reference.ts`)
   - Handles semantic search using Upstash Vector
   - Returns product metadata for potential matches

3. **Redis Caching** (`lib/redis.ts`)
   - Caches frequent queries for faster response
   - Maintains conversation history for context-aware recommendations
   - Stores knowledge base entries for common questions

```typescript
// From redis.ts - Caching functions
export async function cacheResponse(userId: string, query: string, response: ChatApiResponse): Promise<void> {
  const normalizedQuery = normalizeQuery(query);
  const cacheKey = `${RESPONSE_CACHE_PREFIX}${userId}:${normalizedQuery}`;
  const keywords = extractKeywords(query);
  const cached: CachedResponse = {
    query: normalizedQuery,
    response,
    keywords,
    timestamp: Date.now(),
  };

  try {
    const ttl = response.cache_ttl_override || RESPONSE_TTL;
    await redisClient.setex(cacheKey, ttl, JSON.stringify(cached));
    logger.info({ cacheKey }, 'Cached response.');
  } catch (error) {
    logger.error({ error, cacheKey }, 'Failed to cache response.');
  }
}
```

4. **Chat API Endpoint** (`app/api/chat/route.ts`)
   - Main entry point for chat interactions
   - Orchestrates the entire chat workflow

```typescript
// From route.ts - Main chat API endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { query?: string; userId?: string; limit?: string | number; beforeId?: string };
    const { query: rawQuery, userId, limit = 10, beforeId } = body;

    // Handle requests for older history or initial load
    if (beforeId !== undefined || (!rawQuery && beforeId === undefined)) {
      const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
      logger.info(`Fetching chat history for user ${userId} with limit ${parsedLimit} and beforeId ${beforeId}`);
      const parsedBeforeId = beforeId ? parseInt(beforeId, 10) : undefined;
      const history = await getChatHistory(userId, parsedLimit, parsedBeforeId);
      return NextResponse.json({ history });
    }

    // ... rest of chat API logic
  } catch (error) {
    logger.error(`Internal server error: ${error}`);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

## 🧩 8. Complete Chat Flow

To help understand how all chat-related components work together, here's a complete implementation flow:

``mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant LLM
    participant Redis
    participant VectorDB
    participant Shopify

    User->>Frontend: Types query or clicks example
    Frontend->>API: Sends query with userId and conversation history
    API->>Redis: Checks for cached response
    Redis-->>API: No cache hit
    API->>LLM: Sends query for analysis
    LLM-->>API: Returns structured response with intent and keywords
    API->>VectorDB: Performs vector search if product query
    VectorDB-->>API: Returns product matches if applicable
    API->>Shopify: Enriches results with detailed product info if needed
    Shopify-->>API: Returns product details
    API->>Redis: Caches response and updates knowledge base
    API-->>Frontend: Returns formatted response with advice and products
    Frontend->>User: Displays response with appropriate formatting
    User->>Frontend: Scrolls to load older messages or clicks follow-up
    Frontend->>API: Requests additional history or sends new query
```

## 🎯 9. Enhanced Query Capabilities

The system now supports additional query types for users:

### Tracking Number Queries
- Users can ask about their order tracking numbers
- System uses `llmResult.is_tracking_query` flag
- Matches tracking numbers using regex patterns
- Fetches order details from Shopify Admin API

### Site Content Queries
- Users can request site-wide information including:
  - Blog posts
  - Help documents
  - Policies
  - FAQs
  - Knowledge base articles
- Utilizes `is_site_content_query` flag
- Searches content repository
- Returns formatted results with links

### Promotional Queries
- Users can ask about current promotions
- Supports queries for:
  - Active promo codes
  - Discounted products
  - Sales events
- Uses `is_promotion_query` flag
- Fetches active promotions from Redis cache
- Includes expiration dates and terms

## 🔍 10. Updated Search Logic

``typescript
// app/api/chat/route.ts
if (llmResult.is_tracking_query) {
  // Handle tracking number queries
  const trackingInfo = await fetchTrackingDetails(llmResult.tracking_number);
  responseBody.tracking_info = trackingInfo;
}

if (llmResult.is_site_content_query) {
  // Handle site content queries
  const contentResults = await searchSiteContent(llmResult.search_keywords);
  responseBody.content_results = contentResults;
}

if (llmResult.is_promotion_query) {
  // Handle promotional queries
  const promotions = await getActivePromotions();
  responseBody.promotions = promotions;
}
```

## 🧪 11. Testing Considerations (Additional)

- Test tracking number queries with valid/invalid formats
- Verify site content retrieval across categories
- Validate promotional information accuracy
- Ensure proper error handling for each query type
- Test response formatting for different result types

## 📚 12. Further Reading

- [Google Gemini API Documentation](https://ai.google.dev/)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Upstash Vector Documentation](https://docs.upstash.com/vector)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React TypeScript Best Practices](https://react-typescript-cheatsheet.netlify.app/)
- [Accessible Carousel Design](https://inclusive-components.design/carousels/)
- [Gemini Prompt Engineering Guide](https://ai.google.dev/guides/prompt-engineering)
- [Redis Data Structures](https://redis.io/docs/data-types/)
