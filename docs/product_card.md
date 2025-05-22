# 📦 Product Card Implementation Documentation

This document provides a comprehensive overview of how product cards are implemented in the Planet Beauty AI Chatbot, including their structure, display logic, and responsive behavior.

## 🧱 1. Product Card Structure

The product card is a reusable component that displays key information about a product in an attractive, consistent format. It is implemented using:

- **Component**: `components/ProductCard.tsx`
- **Styling**: `styles/ChatInterface.module.css` (shared with chat interface)
- **Data Source**: Product data from Upstash Vector or Shopify API

### ✨ Key Features

- Responsive design that adapts to different screen sizes
- Consistent visual hierarchy for product information
- Clear call-to-action ("View Product" and "Add to Cart" buttons)
- Accessibility-focused markup
- Visual indicators for stock status (available/sold out)

## 🛠️ 2. Implementation Details

### 📁 File Structure
```
├── components/
│   ├── ProductCard.tsx - Main component
│   └── ProductCarousel.tsx - Carousel implementation
├── styles/
│   └── ChatInterface.module.css - Shared styling for chat and product cards
└── lib/
    └── types.ts - Type definitions
```

### 🧩 Props

The ProductCard component accepts the following props:

```typescript
// From ProductCard.tsx
interface ProductCardProps {
  title: string;
  description: string;
  price: number; // Price as numeric value, formatted as string in UI
  image: string | null; // Image URL or null for placeholder
  landing_page: string; // Product page URL
  matches?: string; // Reason why this product matches the query
  onAddToCart?: (productId: string, productTitle: string) => void; // Optional add to cart function
  productId?: string; // Optional product ID (Shopify variant ID)
  availableForSale?: boolean; // Whether product is available for sale
  quantityAvailable?: number; // Quantity remaining if low stock
}
```

## 🖼️ 3. Single Product Display

When only one product is returned, it is displayed as a single product card with full width. This provides maximum visibility for the recommendation.

### 📸 Example
![Single product card](/images/product-card-single.png)

### 🧑‍💻 Code Snippet

``tsx
// In ChatMessage.tsx when displaying a single product
if (products.length === 1) {
  return (
    <div className="single-product-container">
      <ProductCard 
        title={products[0].title}
        description={products[0].description}
        price={products[0].price}
        image={products[0].image}
        landing_page={products[0].landing_page}
        matches={products[0].matches}
        onAddToCart={handleAddToCart}
        productId={products[0].variantId}
        availableForSale={products[0].availableForSale}
        quantityAvailable={products[0].quantityAvailable}
      />
    </div>
  );
}
```

## 🎡 4. Multiple Products Carousel

When two or more products are returned, they are displayed in a horizontal carousel that allows side-scrolling. This provides a compact yet informative way to show multiple recommendations.

### 📸 Example
![Product carousel](/images/product-carousel.png)

### 🧰 Technology Used
- **Embla Carousel**: A lightweight, accessible carousel library
- **useEmblaCarousel**: Custom hook for carousel functionality with autoplay

### 🧑‍💻 Code Snippet

``tsx
// From ProductCarousel.tsx
import { ProductCardResponse } from '@/lib/types';
import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
import React from 'react';
import { ProductCard } from './ProductCard';

interface ProductCarouselProps {
  products: ProductCardResponse[];
  onAddToCart: (variantId: string, productTitle: string) => Promise<void>;
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({ products, onAddToCart }) => {
  const [viewportRef] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 3000 })]);

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="embla" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <div className="embla__viewport" ref={viewportRef}>
        <div className="embla__container" style={{ display: 'flex' }}>
          {products.map((product, index) => (
            <div className="embla__slide" key={index} style={{ minWidth: '280px', padding: '0 10px' }}>
              <ProductCard
                title={product.title}
                description={product.description}
                price={product.price}
                image={product.image}
                landing_page={product.landing_page}
                matches={product.matches}
                onAddToCart={onAddToCart}
                productId={product.variantId}
                availableForSale={product.availableForSale}
                quantityAvailable={product.quantityAvailable}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

### 🔁 Carousel Logic

1. The carousel is initialized with `{ loop: true }` to enable infinite scrolling
2. Autoplay is configured with a 3-second delay between slides
3. Each product is rendered as a slide in the carousel with minimum width of 280px
4. Slides have padding for spacing between cards
5. The carousel container has overflow hidden to create the scrolling effect

## 🧩 5. Complete Product Card Flow

To help understand how product cards are generated and displayed, here's a complete implementation flow:

``mermaid
sequenceDiagram
    participant API
    participant LLM
    participant VectorDB
    participant Shopify
    participant Redis
    participant Frontend
    participant User

    API->>LLM: Sends user query for analysis
    LLM-->>API: Returns structured response with search keywords
    API->>VectorDB: Performs vector search using keywords
    VectorDB-->>API: Returns product matches from database
    API->>Shopify: Enriches results with detailed product info
    Shopify-->>API: Returns product details (price, availability, etc.)
    API->>Redis: Caches response for future use
    API-->>Frontend: Returns formatted response with product data
    Frontend->>User: Renders product card or carousel based on results
```

## 🧪 6. Testing Considerations (Expanded)

- Test product card rendering with all possible states (in stock, out of stock, low stock)
- Verify proper styling for different product types
- Ensure accessibility features work correctly
- Validate responsive behavior at different screen sizes
- Test with missing images and ensure fallback works
- Check price formatting in different currencies
- Verify add-to-cart functionality works correctly
- Test product card display with empty or invalid data
- Ensure links open in new tabs as expected
- Validate hover effects enhance user experience
- Test keyboard navigation for accessibility
- Verify screen reader compatibility
- Check that product information is properly truncated
- Test with extreme product title lengths
- Ensure proper handling of long descriptions

## 🎨 7. Styling Details

### 🧱 Shared CSS Modules

The product card uses shared styling from `ChatInterface.module.css`:

``css
/* From ChatInterface.module.css */
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

## ⚙️ 8. Backend Integration

### 🧠 Data Flow

The product card functionality integrates with backend systems through these steps:

1. User asks for product recommendations in the chat interface
2. Gemini LLM analyzes the query and generates search keywords
3. The system searches Upstash Vector using these keywords
4. Matching products are retrieved from the vector database
5. Product data is enhanced with details from Shopify API
6. Final results are returned to the frontend for display as product cards

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
```

### 📦 Product Data Structure

The product data used in product cards follows this structure:

``json
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
   - Generates search keywords based on user queries
   - Creates structured responses with product data
   - Handles product matching logic

```typescript
// Example Gemini response handling in llm.ts
const botResponseData = await response.json();
console.log('API response:', botResponseData);

// Aggregate products for carousel
const products: ProductCardResponse[] = [];
if (botResponseData.product_card) products.push(botResponseData.product_card);
if (botResponseData.complementary_products) products.push(...botResponseData.complementary_products);
```

2. **Vector Search** (`lib/upstash-vector-reference.ts`)
   - Handles semantic search using Upstash Vector
   - Returns product metadata for potential matches

3. **Shopify Integration** (`lib/shopify.ts`)
   - Enhances vector search results with detailed product information
   - Acts as a fallback when vector search returns no results
   - Handles adding products to cart via Shopify

```typescript
// Example Shopify add to cart functionality
export async function addToCart(cartId: string | null, variantId: string, quantity: number) {
  try {
    const response = await fetch('/api/shopify/add-to-cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartId, variantId, quantity }),
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to add to cart:', error);
    throw error;
  }
}
```

4. **Redis Caching** (`lib/redis.ts`)
   - Caches frequent product queries for faster response
   - Stores session history for context-aware recommendations
   - Maintains a dynamic knowledge base for common questions

```typescript
// Example Redis caching for product responses
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

### 🔁 Synchronization Process

Products are synchronized from Shopify to Upstash Vector through a scheduled process:

1. The sync process runs periodically via `app/api/sync-products/route.ts`
2. It retrieves product data from Shopify Admin API
3. The data is transformed into a format suitable for vector search
4. Products are upserted into the Upstash Vector index

``mermaid
graph LR
    A[Shopify Admin API] --> B[Product Data Extraction]
    B --> C[Data Transformation]
    C --> D[Vector Embedding Generation]
    D --> E[Upstash Vector Index Upsert]
```

This synchronization ensures that product cards always display up-to-date information from the Shopify store.

## 📚 7. Further Reading

- [Next.js Image Optimization](https://nextjs.org/docs/basic-features/image-optimization)
- [Embla Carousel Documentation](https://www.embla-carousel.com/)
- [CSS Modules Specification](https://github.com/css-modules/css-modules)
- [Accessible Carousel Design](https://inclusive-components.design/carousels/)