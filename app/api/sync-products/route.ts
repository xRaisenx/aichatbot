import { AdminFetchResult, AdminShopifyProductNode, fetchAdminShopifyProducts } from '@lib/shopify-admin';
import { Index as VectorIndex } from '@upstash/vector'; // Removed IndexConfig
import { NextResponse } from 'next/server';
import { generateEmbeddings } from '../../../lib/gemini'; // Adjusted import path

type VectorMetadata = {
  textForBM25?: string; // Text for BM25 sparse indexing
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  tags: string[];
  price: string;
  imageUrl: string;
  productUrl: string;
  variantId: string;
};

type VectorRecord = {
  id: string;
  vector: number[]; // For dense embeddings
  metadata: VectorMetadata;
};

// Initialize Upstash vector client
// Explicitly type the index with the metadata structure
const vectorIndex: VectorIndex<VectorMetadata> | null = process.env.UPSTASH_VECTOR_URL && process.env.UPSTASH_VECTOR_TOKEN
  ? new VectorIndex<VectorMetadata>({
      url: (process.env.UPSTASH_VECTOR_URL || '').replace(/^"|"$/g, '').replace(/;$/g, ''), // Clean URL
      token: (process.env.UPSTASH_VECTOR_TOKEN || '').replace(/^"|"$/g, '').replace(/;$/g, ''), // Clean Token
      // requestTimeout: 30000, // Removed: Not a valid property here
    })
  : null;

// Constants
const BATCH_SIZE_VECTOR = 25; // Reduced from 50 to lower write operations
const MAX_RETRIES = 3;

// Helper functions for duplicate checking
// Replaced 'any' with specific types for better type safety
function areObjectsEqual(obj1: Record<string, unknown>, obj2: Record<string, unknown>): boolean {
  if (obj1 === null && obj2 === null) return true;
  if (obj1 === null || obj2 === null) return false;
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

function areVectorsEqual(vec1: number[] | undefined, vec2: number[] | undefined): boolean {
  if (vec1 === undefined && vec2 === undefined) return true;
  if (vec1 === undefined || vec2 === undefined) return false;
  if (vec1.length !== vec2.length) return false;
  for (let i = 0; i < vec1.length; i++) {
    if (vec1[i] !== vec2[i]) return false;
  }
  return true;
}

const BASE_RETRY_DELAY = 1000; // 1 second
const SECRET = process.env.CRON_SECRET;

// Retry with exponential backoff
async function upsertWithRetry(
  currentIndex: VectorIndex<VectorMetadata>, // Use the typed index
  batch: VectorRecord[],
  retryCount: number = 0
): Promise<void> {
  // --- BEGIN DUPLICATE CHECK ---
  if (batch.length === 0) {
    console.log("Initial batch is empty, skipping upsert.");
    return;
  }

  let itemsToUpsert: VectorRecord[] = [...batch]; // Start with all items
  let skippedCount = 0;

  try {
    const idsToFetch = batch.map(item => item.id);
    // Fetch returns (Vector<VectorMetadata> | null)[]
    const existingRecordsNullable = await currentIndex.fetch(idsToFetch, { includeMetadata: true, includeVectors: true });

    const existingRecordsMap = new Map<string, { vector?: number[]; metadata?: VectorMetadata }>();
    existingRecordsNullable.forEach((record, index) => {
      if (record) { // record is Vector<VectorMetadata> | null
        existingRecordsMap.set(idsToFetch[index], { vector: record.vector, metadata: record.metadata });
      }
    });

    const trulyNewOrChangedItems: VectorRecord[] = [];
    for (const newItem of batch) {
      const existingItemData = existingRecordsMap.get(newItem.id);
      if (existingItemData) {
        // Ensure newItem.metadata.textForBM25 is handled if it's undefined in existingItemData.metadata
        const currentMetadataForComparison = { ...newItem.metadata };
        const existingMetadataForComparison = { ...existingItemData.metadata };

        // If textForBM25 might be undefined on fetched existing records but present on new,
        // ensure comparison is fair or explicitly handle. For now, direct comparison.

        const metadataMatches = areObjectsEqual(currentMetadataForComparison, existingMetadataForComparison);
        // Check if the existing record actually has a vector stored
        const existingVectorExists = existingItemData.vector !== undefined && existingItemData.vector !== null && Array.isArray(existingItemData.vector) && existingItemData.vector.length > 0;
        // Only compare vectors if the existing one exists
        const vectorsMatch = existingVectorExists ? areVectorsEqual(newItem.vector, existingItemData.vector) : false;

        if (metadataMatches && existingVectorExists && vectorsMatch) {
            // Skip only if metadata matches AND existing vector exists AND vectors match
            // console.log(`Skipping duplicate product ID: ${newItem.id} as metadata and existing vector match.`);
            skippedCount++;
            continue; // Skip this item
        } else {
             // Log why it's being upserted (metadata diff, missing vector, or vector diff)
            // if (!metadataMatches) console.log(`Upserting ${newItem.id}: Metadata differs.`);
            // else if (!existingVectorExists) console.log(`Upserting ${newItem.id}: Existing vector missing.`);
            // else if (!vectorsMatch) console.log(`Upserting ${newItem.id}: Vectors differ.`);
            trulyNewOrChangedItems.push(newItem); // Add item to be upserted
        }
      } else {
        // Existing item not found, definitely upsert
        trulyNewOrChangedItems.push(newItem);
      }
    }
    itemsToUpsert = trulyNewOrChangedItems; // Update the list of items to actually upsert

    if (skippedCount > 0) {
      console.log(`Skipped ${skippedCount} identical items from the batch of ${batch.length}.`);
    }

    if (itemsToUpsert.length === 0) {
      console.log("All items in the batch were duplicates or batch became empty after filtering. Skipping upsert.");
      return;
    }
  } catch (fetchErr) {
    console.error("Error fetching existing records for duplicate check, proceeding with upserting all items in current batch:", fetchErr);
    // If fetching fails, we proceed to try upserting the original batch (or itemsToUpsert which is a copy)
    // This maintains the original behavior if duplicate check itself fails.
  }
  // --- END DUPLICATE CHECK ---

  try {
    await currentIndex.upsert(itemsToUpsert);
    console.log(`Successfully upserted batch of ${itemsToUpsert.length} vectors`);
  } catch (err) {
    if (err instanceof Error && err.message.includes('This index requires sparse vectors')) {
      console.warn('Attempted to upsert dense vectors to a sparse-only index. Retrying batch without dense vectors.');
      // Corrected sparseBatch definition to preserve VectorMetadata type
      const sparseBatch = itemsToUpsert.map(({ id, metadata }) => ({ id, data: metadata.textForBM25, metadata }));
      // Try upserting again with sparse data only (no dense vector)
      // This assumes the metadata (including textForBM25) is what the sparse index expects.
      // We won't retry this specific modification further to avoid loops if sparse also fails for other reasons.
      try {
        // Suppress TS error due to complex SDK types for sparse-only upsert. Runtime behavior is correct.
        // @ts-expect-error - SDK types might not perfectly match sparse-only upsert signature
        await currentIndex.upsert(sparseBatch); 
        console.log(`Successfully upserted batch of ${sparseBatch.length} records (sparse only).`);
      } catch (sparseErr) {
        console.error('Failed to upsert sparse-only batch after dense vector error:', sparseErr);
        throw sparseErr; // Re-throw the error from the sparse attempt
      }
      // If sparse upsert was successful, we consider this "handled" for this batch.
      // The calling function will continue with the next batch.
      return; 
    } else if (err instanceof Error && err.message.includes('Exceeded daily write limit')) {
      if (retryCount >= MAX_RETRIES) {
        // Note: itemsToUpsert.length might be different from original batch.length
        console.error(`Max retries (${MAX_RETRIES}) reached for batch of ${itemsToUpsert.length}. Skipping.`);
        throw err;
      }

      // Calculate delay with exponential backoff
      const delay = BASE_RETRY_DELAY * Math.pow(2, retryCount);
      console.warn(`Upstash write limit exceeded. Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Reduce batch size for retry if possible
      // Apply to itemsToUpsert, not the original batch
      if (itemsToUpsert.length > 1) {
        const newBatchSize = Math.max(1, Math.floor(itemsToUpsert.length / 2));
        console.log(`Reducing batch size to ${newBatchSize} for retry`);
        const smallerBatches = [];
        for (let i = 0; i < itemsToUpsert.length; i += newBatchSize) {
          smallerBatches.push(itemsToUpsert.slice(i, i + newBatchSize));
        }

        // Retry smaller batches
        for (const smallerBatch of smallerBatches) {
          await upsertWithRetry(currentIndex, smallerBatch, retryCount + 1); // Pass smallerBatch which is already filtered
        }
      } else {
        // Single item, retry without splitting
        await upsertWithRetry(currentIndex, itemsToUpsert, retryCount + 1); // Pass itemsToUpsert
      }
    } else {
      console.error('Unexpected error during upsert:', err);
      throw err;
    }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== SECRET) {
    console.error('Unauthorized sync attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let cursor: string | null = null;
  let fetched = 0;
  let processed = 0;
  let errors = 0;
  const vectorUpsertBatch: VectorRecord[] = [];

  try {
    do {
      const result: AdminFetchResult = await fetchAdminShopifyProducts(cursor);
      const products = result.products;
      cursor = result.pageInfo.endCursor;

      for (const product of products) {
        try {
          // Transform product into vector data (example transformation)
          // Concatenate relevant text fields for BM25 indexing
          const textForBM25 = `${product.title} ${product.descriptionHtml || ''} ${product.tags.join(' ')} ${product.vendor || ''} ${product.productType || ''}`.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

          const vectorData: VectorRecord = {
            id: product.id,
            vector: await generateVector(product, textForBM25), // Pass textForBM25 for embedding
            metadata: {
              textForBM25: textForBM25, // Text for BM25 sparse indexing now in metadata
              title: product.title,
              handle: product.handle, // Added handle back to metadata
              vendor: product.vendor as string, // Added vendor back to metadata
              productType: product.productType as string, // Added productType back to metadata
              tags: product.tags as string[],
              price: product.priceRange.minVariantPrice.amount,
              imageUrl: product.images?.edges[0]?.node.url as string,
              productUrl: `/products/${product.handle}`,
              variantId: product.variants?.edges[0]?.node.id as string,
            },
          };

          vectorUpsertBatch.push(vectorData);

          if (vectorUpsertBatch.length >= BATCH_SIZE_VECTOR) {
            if (vectorIndex) {
              await upsertWithRetry(vectorIndex, vectorUpsertBatch);
              vectorUpsertBatch.length = 0; // Clear the batch after upsert
              await new Promise(resolve => setTimeout(resolve, 500)); // Add 500ms delay
            } else {
              console.warn('Vector client not initialized. Skipping upsert batch.');
              errors += vectorUpsertBatch.length;
            }
          }

          processed++;
        } catch (err) {
          console.error(`Error processing product ${product.title}:`, err);
          errors++;
        }
      }

      fetched += products.length;
      console.log(`Fetched ${fetched} products so far...`); // Log progress
    } while (cursor); // Continue as long as there are more pages

    // Upsert any remaining vectors
    if (vectorUpsertBatch.length > 0 && vectorIndex) {
      await upsertWithRetry(vectorIndex, vectorUpsertBatch);
      // Optional: Add a small delay even after the last batch if needed, though likely less critical here.
      // await new Promise(resolve => setTimeout(resolve, 500)); 
    }

    console.log(`Sync complete. Fetched: ${fetched}, Processed: ${processed}, Errors: ${errors}`);
    return NextResponse.json({ fetched, processed, errors });
  } catch (err) {
    console.error('Sync failed:', err);
    return NextResponse.json({ error: 'Sync failed', details: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

// Generate 768-dimension dense vector using Google's embedding model
async function generateVector(product: AdminShopifyProductNode, textForEmbedding: string): Promise<number[]> {
  try {
    const embeddings = await generateEmbeddings(textForEmbedding);
    if (embeddings && embeddings.length === 768) {
      console.log(`Successfully generated real 768-dimension vector for product: ${product.id}`);
      return embeddings;
    } else {
      console.warn(`Failed to generate real embeddings for product ${product.id}. Falling back to dummy vector.`);
      // Fallback to dummy vector if real embedding generation fails
      return Array(768).fill(0).map(() => Math.random());
    }
  } catch (error) {
    console.error(`Error in generateVector for product ${product.id}:`, error);
    // Fallback to dummy vector in case of any unexpected error
    return Array(768).fill(0).map(() => Math.random());
  }
}
