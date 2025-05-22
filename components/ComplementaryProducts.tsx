// components/ComplementaryProducts.tsx
'use client';

import { ProductCardResponse } from '../lib/types'; // Import the interface
// Removed import of ProductCard as it's now used inside ProductCarousel
import { ProductCarousel } from './ProductCarousel'; // Import the new ProductCarousel component

interface ComplementaryProductsProps {
  products: ProductCardResponse[];
  onAddToCart: (variantId: string, productTitle: string) => Promise<void>; // Added onAddToCart prop
}

export function ComplementaryProducts({ products, onAddToCart }: ComplementaryProductsProps) {
  if (!products || products.length === 0) {
    return null; // Don't render if no complementary products
  }

  // If there's only one complementary product, maybe render it directly?
  // Or always use the carousel for consistency with multiple products.
  // Let's use the carousel if there's at least one product in the list.

  return (
    <div className="complementary-products-container border-t border-border-light dark:border-border-dark pt-3 mt-3">
      <h3 className="text-lg font-semibold mb-2">Suggested Products</h3>
      {/* Render the ProductCarousel with the products */}
      <ProductCarousel products={products} onAddToCart={onAddToCart} />
    </div>
  );
}