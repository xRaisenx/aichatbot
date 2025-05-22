// components/ProductCarousel.tsx
'use client';

import { ProductCardResponse } from '@/lib/types';
// --- INSTALL THESE PACKAGES ---
// npm install embla-carousel embla-carousel-react embla-carousel-autoplay @types/embla-carousel-react @types/embla-carousel-autoplay
import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
// --- END INSTALL INSTRUCTIONS ---
import React from 'react';
import { ProductCard } from './ProductCard'; // Import ProductCard

interface ProductCarouselProps {
  products: ProductCardResponse[];
  // --- UPDATED PROP TYPE ---
  onAddToCart: (variantId: string, productTitle: string) => Promise<void>; // Match the async signature from ChatInterface
  // --- END UPDATED PROP TYPE ---
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({ products, onAddToCart }) => {
  // Autoplay plugin instance
  const autoplayOptions = { delay: 3000, stopOnInteraction: false, stopOnMouseEnter: true }; // Added options
  const autoplay = React.useRef(Autoplay(autoplayOptions));

  // Embla Carousel hook
  const [viewportRef, embla] = useEmblaCarousel({ loop: true }, [autoplay.current]); // Use ref for plugin

  // Optional: Pause/resume autoplay on mount/unmount or visibility changes
  React.useEffect(() => {
    if (!embla) return;
    // Add event listeners if needed, e.g., embla.on('pointerDown', autoplay.current.stop)
    // For now, just ensure plugin is active
  }, [embla]);


  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="embla" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <div className="embla__viewport" ref={viewportRef}>
        <div className="embla__container" style={{ display: 'flex' }}>
          {products.map((product, index) => (
            // Pass onAddToCart and productId to ProductCard
            <div className="embla__slide" key={index} style={{ minWidth: '280px', padding: '0 10px' }}>
              <ProductCard
                title={product.title}
                description={product.description}
                price={product.price}
                image={product.image}
                landing_page={product.landing_page}
                matches={product.matches}
                // --- UPDATED PROP PASSING ---
                onAddToCart={onAddToCart} // Pass the prop down (it's already the correct async type)
                productId={product.variantId} // Pass the variantId as productId
                // --- END UPDATED PROP PASSING ---
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

export { ProductCarousel }; // Export the component