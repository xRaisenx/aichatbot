// components/ProductComparison.tsx
'use client';

import { ProductCardResponse } from '../lib/types';

interface ProductComparisonProps {
  products: ProductCardResponse[];
}

export function ProductComparison({ products }: ProductComparisonProps) {
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="product-comparison-container border-t border-border-light dark:border-border-dark pt-4 mt-4">
      <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">Product Comparison</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Compare key features of selected products.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {products.map((product, index) => (
          <div key={index} className="border border-gray-200 dark:border-gray-700 p-4 rounded-lg bg-white dark:bg-gray-800">
            <h4 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{product.title}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{product.description}</p>
            <p className="text-md font-bold text-pink-600 dark:text-pink-400">${product.price.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}