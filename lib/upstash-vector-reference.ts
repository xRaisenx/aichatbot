// lib/upstash-vector-reference.ts

/**
 * Upstash Vector SDK Examples for Planet Beauty Project
 *
 * This document provides examples of how to use the Upstash Vector SDK
 * tailored to the Planet Beauty project's data structure.
 *
 * Project's Product Metadata Structure (from lib/types.ts):
 *
 * export interface ProductVectorMetadata {
 *   id?: string; // Shopify product GID or similar unique ID
 *   handle: string; // Product handle for URL
 *   title: string; // Product title
 *   price: string; // Product price (e.g., "25.99")
 *   imageUrl: string | null; // URL of the product image
 *   productUrl: string; // URL to the product page
 *   variantId?: string; // Specific variant ID
 *   vendor?: string | null; // Brand or vendor (e.g., "Planet Beauty Organics")
 *   productType?: string | null; // Category (e.g., "lipstick", "serum", "cleanser")
 *   tags?: string[]; // Shopify tags (e.g., ["vegan", "cruelty-free", "dry-skin", "organic"])
 *   usageInstructions?: string; // How to use the product
 *   textForBM25?: string; // Combined text for BM25/hybrid search (title, description, tags)
 *   // [key: string]: unknown; // Allows for additional arbitrary properties
 * }
 */

import { Index } from "@upstash/vector";

// Define the Metadata type based on our project's structure
type ProductMetadata = {
  id?: string;
  handle: string;
  title: string;
  price: string; // Stored as string, e.g., "25.99"
  imageUrl: string | null;
  productUrl: string;
  variantId?: string;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[];
  usageInstructions?: string;
  textForBM25?: string;
  // Add other known optional fields if necessary for strong typing
  // For example, if you often filter by a specific numeric attribute, ensure it's typed
  // numeric_price?: number; // If you decide to store a numeric version for filtering
};

const index = new Index<ProductMetadata>({
  url: process.env.UPSTASH_VECTOR_REST_URL!, // Ensure these are set in your environment
  token: process.env.UPSTASH_VECTOR_TOKEN!,
});

// --- Upsert Operations ---

// Example Product Data
const product1Vector = [0.1, 0.2, 0.3, /* ... more embedding values ... */ ];
const product1Metadata: ProductMetadata = {
  id: 'gid://shopify/Product/1234567890',
  handle: 'vegan-glow-lipstick-ruby-red',
  title: 'Vegan Glow Lipstick - Ruby Red',
  price: '22.50',
  imageUrl: 'https://cdn.shopify.com/s/files/1/0000/0001/products/vegan-lipstick-ruby.jpg',
  productUrl: 'https://planet-beauty.com/products/vegan-glow-lipstick-ruby-red',
  variantId: 'gid://shopify/ProductVariant/9876543210',
  vendor: 'Planet Beauty Organics',
  productType: 'Lipstick',
  tags: ['vegan', 'cruelty-free', 'organic', 'lipstick'],
  textForBM25: 'Vegan Glow Lipstick - Ruby Red. A vibrant, long-lasting vegan lipstick made with organic ingredients. cruelty-free organic lipstick red',
};

const product2SparseVector = {
  indices: [10, 25, 100],
  values: [0.5, 0.8, 0.3],
};
const product2Metadata: ProductMetadata = {
  id: 'gid://shopify/Product/2345678901',
  handle: 'hydrating-serum-dry-skin',
  title: 'Hydrating Serum for Dry Skin',
  price: '35.00',
  imageUrl: 'https://cdn.shopify.com/s/files/1/0000/0001/products/hydrating-serum.jpg',
  productUrl: 'https://planet-beauty.com/products/hydrating-serum-dry-skin',
  vendor: 'AquaPure Labs',
  productType: 'Serum',
  tags: ['hydrating', 'dry-skin', 'serum', 'hyaluronic-acid'],
  textForBM25: 'Hydrating Serum for Dry Skin. Deeply moisturizes and revitalizes dry skin with hyaluronic acid. serum dry-skin hydrating',
};

// Upsert to dense index (most common for semantic search)
async function upsertDense() {
  await index.upsert([{
    id: product1Metadata.id!,
    vector: product1Vector,
    metadata: product1Metadata
  }]);
  console.log('Upserted dense vector for:', product1Metadata.title);
}

// Upsert to sparse index (useful for keyword-based BM25 style search)
// Note: Ensure your Upstash Vector index is configured for sparse or hybrid search.
async function upsertSparse() {
  await index.upsert([{
    id: product2Metadata.id!,
    sparseVector: product2SparseVector,
    metadata: product2Metadata
  }]);
  console.log('Upserted sparse vector for:', product2Metadata.title);
}

// Upsert to hybrid index (combines dense and sparse)
async function upsertHybrid() {
  await index.upsert([{
    id: 'gid://shopify/Product/3456789012',
    vector: [0.4, 0.5, 0.6, /* ... */],
    sparseVector: { indices: [5, 15, 50], values: [0.9, 0.7, 0.6] },
    metadata: {
      id: 'gid://shopify/Product/3456789012',
      handle: 'sunscreen-spf50-sensitive',
      title: 'Mineral Sunscreen SPF50 - Sensitive Skin',
      price: '28.99',
      imageUrl: 'https://cdn.shopify.com/s/files/1/0000/0001/products/sunscreen-sensitive.jpg',
      productUrl: 'https://planet-beauty.com/products/sunscreen-spf50-sensitive',
      vendor: 'SunSafe',
      productType: 'Sunscreen',
      tags: ['spf50', 'sensitive-skin', 'mineral', 'sunscreen'],
      textForBM25: 'Mineral Sunscreen SPF50 - Sensitive Skin. Gentle, effective sun protection. mineral sunscreen sensitive spf50',
    }
  }]);
  console.log('Upserted hybrid vector for: Mineral Sunscreen SPF50');
}

// Upsert data as plain text (Upstash Vector will generate embeddings if configured)
// The 'data' field should ideally be the `textForBM25` or similar descriptive text.
async function upsertPlainText() {
  await index.upsert([{
    id: 'gid://shopify/Product/4567890123',
    data: product2Metadata.textForBM25!, // Use the pre-formatted text
    metadata: product2Metadata // Still provide the full metadata
  }]);
  console.log('Upserted plain text for:', product2Metadata.title);
}

// Upsert data alongside your pre-computed embedding
async function upsertDataWithEmbedding() {
  // If providing a pre-computed vector, do not also provide 'data' for the same item
  // for the SDK to embed. 'upsertPlainText' covers the 'data'-only scenario.
  await index.upsert([{
    id: 'gid://shopify/Product/5678901234',
    // data: product1Metadata.textForBM25!, // Remove 'data' if 'vector' is present
    vector: product1Vector,
    metadata: product1Metadata
  }]);
  console.log('Upserted item with pre-computed vector for:', product1Metadata.title);
}


// --- Query Operations ---

// Example query embedding for "vegan red lipstick"
const queryEmbedding = [0.12, 0.22, 0.35, /* ... query embedding values ... */];

async function queryByVector() {
  const resultsByVector = await index.query<ProductMetadata>({
    vector: queryEmbedding,
    includeVectors: true,
    includeMetadata: true,
    topK: 3,
    filter: "productType = 'Lipstick' AND 'vegan' IN tags"
  });

  console.log('\nQuery by Vector Results:');
  resultsByVector.forEach(result => {
    console.log(`  Title: ${result.metadata?.title}, Score: ${result.score}`);
  });
}

async function queryByNaturalLanguage() {
  const resultsByData = await index.query<ProductMetadata>({
    data: "Looking for a hydrating serum for dry skin",
    topK: 2,
    includeMetadata: true,
    filter: "vendor = 'AquaPure Labs'"
  });

  console.log('\nQuery by Natural Language Data Results:');
  resultsByData.forEach(result => {
    console.log(`  Title: ${result.metadata?.title}, Price: ${result.metadata?.price}`);
  });
}

async function queryWithDataFieldInResponse() {
  const resultsWithDataField = await index.query<ProductMetadata>({
    vector: queryEmbedding,
    includeData: true,
    topK: 1,
    includeMetadata: true,
  });
  console.log('\nQuery with Data Field in Response:');
  if (resultsWithDataField[0]) {
    console.log(`  Data (textForBM25): ${resultsWithDataField[0].data}`);
    console.log(`  Title: ${resultsWithDataField[0].metadata?.title}`);
  }
}


// --- Update Operation ---
async function updateProduct() {
  await index.upsert({
    id: product1Metadata.id!,
    vector: product1Vector, // Re-include the vector when updating metadata
    metadata: {
      ...product1Metadata, // Spread existing metadata
      price: '20.99',      // Update the price
      tags: [...(product1Metadata.tags || []), 'new-arrival'], // Add a new tag
    }
  });
  console.log('\nUpdated product:', product1Metadata.title);
}

// --- Delete Operations ---
async function deleteProducts() {
  if (product1Metadata.id) await index.delete(product1Metadata.id);
  if (product2Metadata.id) await index.delete([product2Metadata.id, 'gid://shopify/Product/3456789012']);
  console.log('\nDeleted products.');
}

// --- Fetch Operations ---
async function fetchProductRecords() {
  if (!product1Metadata.id || !product2Metadata.id) return;
  const fetchedRecords = await index.fetch([product1Metadata.id, product2Metadata.id], {
    includeMetadata: true,
  });
  console.log('\nFetched Records:');
  fetchedRecords.forEach(record => {
    if (record) console.log(`  Title: ${record.metadata?.title}`);
  });

  const fetchedRecordsWithData = await index.fetch([product1Metadata.id], {
    includeData: true,
    includeMetadata: true,
  });
  console.log('\nFetched Record with Data Field:');
  if (fetchedRecordsWithData[0]) {
    console.log(`  Data (textForBM25): ${fetchedRecordsWithData[0].data}`);
  }
}

// --- Range Operation ---
async function fetchRangeOfProducts() {
  const rangeResults = await index.range<ProductMetadata>({
    cursor: 0,
    limit: 5,
    includeVectors: true,
    includeMetadata: true,
  });
  console.log(`\nFetched ${rangeResults.vectors.length} products by range. Next cursor: ${rangeResults.nextCursor}`);
}

// --- Index Information & Management ---
async function getIndexInfo() {
  const indexInfo = await index.info();
  console.log('\nIndex Info:', indexInfo);
}

async function getRandomProduct() {
  // const randomProduct = await index.random<ProductMetadata>(); // .random() may not exist on Index type
  // console.log('\nRandom Product from Index:', randomProduct?.metadata?.title);
  console.log('\ngetRandomProduct: index.random() method appears to be unavailable in this SDK version or was used incorrectly.');
}

// --- Namespaces ---
async function manageNamespaces() {
  const beautyProductsNamespace = index.namespace("planet-beauty-products");

  await beautyProductsNamespace.upsert([{
    id: product1Metadata.id!,
    vector: product1Vector,
    metadata: product1Metadata
  }]);
  console.log('\nUpserted to namespace "planet-beauty-products":', product1Metadata.title);

  const namespaceResults = await beautyProductsNamespace.query<ProductMetadata>({
    vector: queryEmbedding,
    includeMetadata: true,
    topK: 2,
    filter: "productType = 'Lipstick'"
  });
  console.log('\nQuery from "planet-beauty-products" namespace:');
  if (namespaceResults[0]) console.log(`  Title: ${namespaceResults[0].metadata?.title}`);

  if (product1Metadata.id) await beautyProductsNamespace.delete(product1Metadata.id);
  console.log('Deleted from "planet-beauty-products" namespace:', product1Metadata.title);

  const namespaces = await index.listNamespaces();
  console.log('\nAvailable Namespaces:', namespaces);

  // Example: Deleting a namespace (use with caution)
  // try {
  //   await index.deleteNamespace("namespace-to-be-deleted");
  //   console.log('Successfully deleted namespace "namespace-to-be-deleted"');
  // } catch (error) {
  //   console.error('Error deleting namespace "namespace-to-be-deleted":', error);
  // }
}


// --- Metadata Filtering Examples for Planet Beauty ---
async function runMetadataFilteringExamples() {
  console.log('\n--- Metadata Filtering Examples ---');
  // Example 1: Find products from a specific vendor and product type
  const filterEx1 = await index.query<ProductMetadata>({
    vector: queryEmbedding,
    filter: "vendor = 'Planet Beauty Organics' AND productType = 'Serum'",
    topK: 5,
    includeMetadata: true,
  });
  console.log("\nFilter Ex1 (Vendor 'Planet Beauty Organics' AND Type 'Serum'):");
  filterEx1.forEach(r => console.log(`  ${r.metadata?.title}`));

  // Example 2: Find products with a specific tag
  const filterEx2 = await index.query<ProductMetadata>({
    vector: queryEmbedding,
    filter: "'vegan' IN tags",
    topK: 5,
    includeMetadata: true,
  });
  console.log("\nFilter Ex2 ('vegan' IN tags):");
  filterEx2.forEach(r => console.log(`  ${r.metadata?.title}`));

  // Example 3: Find products that are NOT of a certain type and have a specific tag
  const filterEx3 = await index.query<ProductMetadata>({
    vector: queryEmbedding,
    filter: "productType != 'Cleanser' AND 'organic' IN tags",
    topK: 5,
    includeMetadata: true,
  });
  console.log("\nFilter Ex3 (Type != 'Cleanser' AND 'organic' IN tags):");
  filterEx3.forEach(r => console.log(`  ${r.metadata?.title}`));

  // Example 4: Complex query with multiple conditions
  const filterEx4 = await index.query<ProductMetadata>({
    vector: queryEmbedding,
    filter: "(vendor = 'AquaPure Labs' OR vendor = 'Planet Beauty Organics') AND 'hydrating' IN tags AND productType = 'Serum'",
    topK: 3,
    includeMetadata: true,
  });
  console.log("\nFilter Ex4 (Complex: Vendor OR Vendor AND Tag AND Type):");
  filterEx4.forEach(r => console.log(`  ${r.metadata?.title}`));

  // Example 5: Filtering on price (string exact match)
  const filterEx5 = await index.query<ProductMetadata>({
    vector: queryEmbedding,
    filter: "price = '22.50' AND 'vegan' IN tags",
    topK: 3,
    includeMetadata: true,
  });
  console.log("\nFilter Ex5 (Price = '22.50' AND 'vegan' IN tags):");
  filterEx5.forEach(r => console.log(`  ${r.metadata?.title}`));
}

// Main function to run examples (optional, for testing this file directly)
async function main() {
  // You would typically call these functions based on your application's needs.
  // For this reference file, we might not call them automatically to prevent
  // actual DB operations unless explicitly intended.

  // Example calls (uncomment to test, ensure DB is set up and .env loaded):
  // await upsertDense();
  // await upsertSparse();
  // await queryByVector();
  // await queryByNaturalLanguage();
  // await getIndexInfo();
  // await getRandomProduct(); // Commented out as .random() may not exist
  // await runMetadataFilteringExamples();
  // await manageNamespaces(); // This will perform writes and deletes
  console.log("Upstash Vector reference script loaded. Uncomment main() calls to run examples.");
}

// main().catch(console.error); // Uncomment to run main when executing this file

// For more advanced filtering syntax, refer to the official Upstash Vector documentation:
// https://upstash.com/docs/vector/features/filtering
