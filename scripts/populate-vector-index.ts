// scripts/populate-vector-index.ts
import { config } from 'dotenv';
config(); // Load .env variables

import { Index } from '@upstash/vector';
import pino from 'pino';
import { ProductVectorMetadata } from '../lib/types';

export const logger = pino({ level: 'info' });

export const vectorIndex = new Index<ProductVectorMetadata>({
  url: process.env.UPSTASH_VECTOR_REST_URL || '',
  token: process.env.UPSTASH_VECTOR_REST_TOKEN || '',
});

// Sample products to match simulate-chat.ts test cases
export const sampleProducts: ProductVectorMetadata[] = [
  {
    id: 'prod_001',
    variantId: 'var_001',
    title: 'Hydrating Serum',
    price: 45.99,
    productUrl: 'https://shop.planetbeauty.com/products/hydrating-serum',
    imageUrl: 'https://shop.planetbeauty.com/images/hydrating-serum.jpg',
    textForBM25: 'Hydrating serum for dry skin, infused with hyaluronic acid, vegan, cruelty-free.',
    tags: ['serum', 'dry skin', 'vegan', 'cruelty-free', 'hyaluronic acid'],
  },
  {
    id: 'prod_002',
    variantId: 'var_002',
    title: 'Vegan Lipstick',
    price: 22.50,
    productUrl: 'https://shop.planetbeauty.com/products/vegan-lipstick',
    imageUrl: 'https://shop.planetbeauty.com/images/vegan-lipstick.jpg',
    textForBM25: 'Vegan lipstick, cruelty-free, long-lasting color for all skin tones.',
    tags: ['lipstick', 'vegan', 'cruelty-free'],
  },
  {
    id: 'prod_003',
    variantId: 'var_003',
    title: 'SPF 50 Sunscreen',
    price: 29.99,
    productUrl: 'https://shop.planetbeauty.com/products/spf-50-sunscreen',
    imageUrl: 'https://shop.planetbeauty.com/images/spf-50-sunscreen.jpg',
    textForBM25: 'SPF 50 sunscreen, broad-spectrum protection, suitable for dry skin.',
    tags: ['sunscreen', 'dry skin', 'spf 50'],
  },
  {
    id: 'prod_004',
    variantId: 'var_004',
    title: 'Brightening Eye Cream',
    price: 35.00,
    productUrl: 'https://shop.planetbeauty.com/products/brightening-eye-cream',
    imageUrl: 'https://shop.planetbeauty.com/images/brightening-eye-cream.jpg',
    textForBM25: 'Eye cream for dark circles, with vitamin C, vegan, cruelty-free.',
    tags: ['eye cream', 'dark circles', 'vegan', 'cruelty-free', 'vitamin c'],
  },
  {
    id: 'prod_005',
    variantId: 'var_005',
    title: 'Gentle Cleanser',
    price: 19.99,
    productUrl: 'https://shop.planetbeauty.com/products/gentle-cleanser',
    imageUrl: 'https://shop.planetbeauty.com/images/gentle-cleanser.jpg',
    textForBM25: 'Gentle cleanser for oily skin, non-comedogenic, vegan.',
    tags: ['cleanser', 'oily skin', 'vegan'],
  },
  {
    id: 'prod_006',
    variantId: 'var_006',
    title: 'Hydrating Moisturizer',
    price: 25.00,
    productUrl: 'https://shop.planetbeauty.com/products/hydrating-moisturizer',
    imageUrl: 'https://shop.planetbeauty.com/images/hydrating-moisturizer.jpg',
    textForBM25: 'Hydrating moisturizer for dry skin, with aloe vera, cruelty-free.',
    tags: ['moisturizer', 'dry skin', 'cruelty-free', 'aloe vera'],
  },
  {
    id: 'prod_007',
    variantId: 'var_007',
    title: 'Balancing Toner',
    price: 18.50,
    productUrl: 'https://shop.planetbeauty.com/products/balancing-toner',
    imageUrl: 'https://shop.planetbeauty.com/images/balancing-toner.jpg',
    textForBM25: 'Balancing toner for oily skin, with witch hazel, vegan.',
    tags: ['toner', 'oily skin', 'vegan', 'witch hazel'],
  },
  {
    id: 'prod_008',
    variantId: 'var_008',
    title: 'Dry Skin Skincare Set',
    price: 89.99,
    productUrl: 'https://shop.planetbeauty.com/products/dry-skin-skincare-set',
    imageUrl: 'https://shop.planetbeauty.com/images/dry-skin-skincare-set.jpg',
    textForBM25: 'Skincare set for dry skin, includes cleanser, serum, moisturizer, vegan, cruelty-free.',
    tags: ['set', 'dry skin', 'cleanser', 'serum', 'moisturizer', 'vegan', 'cruelty-free'],
  },
  {
    id: 'prod_009',
    variantId: 'var_009',
    title: 'Caudalie Vinoperfect Dark Circle Brightening Eye Cream with Niacinamide',
    price: 55.00,
    productUrl: 'https://shop.planetbeauty.com/products/caudalie-vinoperfect-eye-cream',
    imageUrl: 'https://shop.planetbeauty.com/images/caudalie-vinoperfect-eye-cream.jpg',
    textForBM25: 'Eye cream for dark circles, with niacinamide, vegan, cruelty-free.',
    tags: ['eye cream', 'dark circles', 'vegan', 'cruelty-free', 'niacinamide'],
  },
  {
    id: 'prod_010',
    variantId: 'var_010',
    title: 'COOLA Suncare Classic Body Organic Sunscreen Lotion SPF 50 - Guava',
    price: 28.00,
    productUrl: 'https://shop.planetbeauty.com/products/coola-sunscreen-spf50',
    imageUrl: 'https://shop.planetbeauty.com/images/coola-sunscreen-spf50.jpg',
    textForBM25: 'Sunscreen SPF 50, organic, suitable for all skin types, cruelty-free.',
    tags: ['sunscreen', 'spf 50', 'cruelty-free'],
  },
];

export async function populateVectorIndex() {
  logger.info('Starting vector index population...');

  try {
    // Clear existing index
    await vectorIndex.reset();
    logger.info('Cleared existing vector index.');

    // Upsert sample products
    for (const product of sampleProducts) {
      const upsertId = product.variantId || product.id || `fallback_${product.title.replace(/\s+/g, '_')}`;
      await vectorIndex.upsert({
        id: upsertId,
        data: `${product.title} ${product.textForBM25}`,
        metadata: product,
      });
      logger.info({ productId: product.id, title: product.title, upsertId }, 'Upserted product to vector index.');
    }

    logger.info({ count: sampleProducts.length }, 'Successfully populated vector index.');
  } catch (error) {
    logger.error({ error }, 'Failed to populate vector index.');
    throw error;
  }
}

async function main() {
  try {
    await populateVectorIndex();
    console.log('Vector index population completed.');
    process.exit(0);
  } catch (error) {
    console.error('Vector index population failed:', error);
    process.exit(1);
  }
}

main();
