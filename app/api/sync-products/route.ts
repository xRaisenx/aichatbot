import { AdminFetchResult, fetchAdminShopifyProducts } from '@lib/shopify-admin'; // Removed AdminShopifyProductNode
import { Index as VectorIndex } from '@upstash/vector'; 
import { NextResponse } from 'next/server';
// generateEmbeddings is no longer needed for sparse-only
// import { generateEmbeddings } from '../../../lib/gemini'; 

type VectorMetadata = {
  textForBM25: string; // Text for BM25 sparse indexing - making this non-optional as it's key for sparse
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

// Updated for sparse-only: 'data' field for BM25 text, 'vector' field removed.
type SparseVectorRecord = {
  id: string;
  data: string; // For BM25 text
  metadata: VectorMetadata;
};

// Initialize Upstash vector client
// Explicitly type the index with the metadata structure
const vectorIndex: VectorIndex<VectorMetadata> | null = process.env.UPSTASH_VECTOR_URL && process.env.UPSTASH_VECTOR_TOKEN
  ? new VectorIndex<VectorMetadata>({
      url: (process.env.UPSTASH_VECTOR_URL || '').replace(/^"|"$/g, '').replace(/;$/g, ''), 
      token: (process.env.UPSTASH_VECTOR_TOKEN || '').replace(/^"|"$/g, '').replace(/;$/g, ''), 
    })
  : null;

// Constants
const BATCH_SIZE_VECTOR = 25; 
const MAX_RETRIES = 3;

// Helper functions for duplicate checking
function areObjectsEqual(obj1: Record<string, unknown>, obj2: Record<string, unknown>): boolean {
  if (obj1 === null && obj2 === null) return true;
  if (obj1 === null || obj2 === null) return false;
  // Ensure consistent key order for comparison, especially for metadata.textForBM25
  const sortedObj1 = JSON.stringify(Object.keys(obj1).sort().reduce((acc, key) => { acc[key] = obj1[key]; return acc; }, {} as Record<string, unknown>));
  const sortedObj2 = JSON.stringify(Object.keys(obj2).sort().reduce((acc, key) => { acc[key] = obj2[key]; return acc; }, {} as Record<string, unknown>));
  return sortedObj1 === sortedObj2;
}

// areVectorsEqual is no longer needed for sparse-only

const BASE_RETRY_DELAY = 1000; // 1 second
const SECRET = process.env.CRON_SECRET;

// Retry with exponential backoff for sparse vectors
async function upsertWithRetry(
  currentIndex: VectorIndex<VectorMetadata>, 
  batch: SparseVectorRecord[], // Use SparseVectorRecord
  retryCount: number = 0
): Promise<void> {
  if (batch.length === 0) {
    console.log("Initial batch is empty, skipping upsert.");
    return;
  }

  let itemsToUpsert: SparseVectorRecord[] = [...batch]; 
  let skippedCount = 0;

  try {
    const idsToFetch = batch.map(item => item.id);
    // Fetch existing records (only metadata needed for sparse duplicate check)
    const existingRecordsNullable = await currentIndex.fetch(idsToFetch, { includeMetadata: true });

    const existingRecordsMap = new Map<string, { metadata?: VectorMetadata }>();
    existingRecordsNullable.forEach((record, index) => {
      if (record && record.metadata) { 
        existingRecordsMap.set(idsToFetch[index], { metadata: record.metadata });
      }
    });

    const trulyNewOrChangedItems: SparseVectorRecord[] = [];
    for (const newItem of batch) {
      const existingItemData = existingRecordsMap.get(newItem.id);
      if (existingItemData && existingItemData.metadata) {
        // Compare metadata, which now includes textForBM25 (via newItem.data being mapped to metadata.textForBM25)
        const metadataMatches = areObjectsEqual(newItem.metadata, existingItemData.metadata);

        if (metadataMatches) {
            skippedCount++;
            continue; 
        } else {
            trulyNewOrChangedItems.push(newItem); 
        }
      } else {
        trulyNewOrChangedItems.push(newItem);
      }
    }
    itemsToUpsert = trulyNewOrChangedItems; 

    if (skippedCount > 0) {
      console.log(`Skipped ${skippedCount} identical items (based on metadata) from the batch of ${batch.length}.`);
    }

    if (itemsToUpsert.length === 0) {
      console.log("All items in the batch were duplicates or batch became empty after filtering. Skipping upsert.");
      return;
    }
  } catch (fetchErr) {
    console.error("Error fetching existing records for duplicate check, proceeding with upserting all items in current batch:", fetchErr);
  }

  try {
    // Upsert sparse vectors: Upstash SDK expects { id: string, data: string, metadata: object }
    await currentIndex.upsert(itemsToUpsert);
    console.log(`Successfully upserted batch of ${itemsToUpsert.length} sparse records`);
  } catch (err) {
    // Removed the specific check for 'This index requires sparse vectors' as we are now intentionally sending sparse.
    if (err instanceof Error && err.message.includes('Exceeded daily write limit')) {
      if (retryCount >= MAX_RETRIES) {
        console.error(`Max retries (${MAX_RETRIES}) reached for batch of ${itemsToUpsert.length}. Skipping.`);
        throw err;
      }

      const delay = BASE_RETRY_DELAY * Math.pow(2, retryCount);
      console.warn(`Upstash write limit exceeded. Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      if (itemsToUpsert.length > 1) {
        const newBatchSize = Math.max(1, Math.floor(itemsToUpsert.length / 2));
        console.log(`Reducing batch size to ${newBatchSize} for retry`);
        const smallerBatches = [];
        for (let i = 0; i < itemsToUpsert.length; i += newBatchSize) {
          smallerBatches.push(itemsToUpsert.slice(i, i + newBatchSize));
        }
        for (const smallerBatch of smallerBatches) {
          await upsertWithRetry(currentIndex, smallerBatch, retryCount + 1); 
        }
      } else {
        await upsertWithRetry(currentIndex, itemsToUpsert, retryCount + 1); 
      }
    } else {
      console.error('Unexpected error during sparse upsert:', err);
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
  const vectorUpsertBatch: SparseVectorRecord[] = []; // Use SparseVectorRecord

  try {
    do {
      const result: AdminFetchResult = await fetchAdminShopifyProducts(cursor);
      const products = result.products;
      cursor = result.pageInfo.endCursor;

      for (const product of products) {
        try {
          const productType = product.productType ? product.productType.split('>').pop()?.trim() : '';
          const tags = product.tags ? product.tags.map(tag => tag.trim()).join(', ') : '';
          const textForBM25 = `${product.title} ${product.descriptionHtml || ''} ${tags} ${product.vendor || ''} ${productType || ''}`.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

          // Prepare sparse vector data
          const sparseVectorData: SparseVectorRecord = {
            id: product.id,
            data: textForBM25, // This is the text content for BM25
            metadata: {
              textForBM25: textForBM25, // Store it in metadata as well for potential duplicate checks or other uses
              title: product.title,
              handle: product.handle,
              vendor: product.vendor || '',
              productType: productType || '',
              tags: product.tags ? product.tags.map(tag => tag.trim()) : [],
              price: product.priceRange.minVariantPrice.amount,
              imageUrl: product.images?.edges[0]?.node.url || '',
              productUrl: product.onlineStoreUrl || `/products/${product.handle}`, // Prefer onlineStoreUrl if available
              variantId: product.variants?.edges[0]?.node.id || product.id, // Fallback to product.id if no variant
            },
          };

          vectorUpsertBatch.push(sparseVectorData);

          if (vectorUpsertBatch.length >= BATCH_SIZE_VECTOR) {
            if (vectorIndex) {
              await upsertWithRetry(vectorIndex, vectorUpsertBatch);
              vectorUpsertBatch.length = 0; 
              await new Promise(resolve => setTimeout(resolve, 500)); 
            } else {
              console.warn('Vector client not initialized. Skipping upsert batch.');
              errors += vectorUpsertBatch.length; // Count as errors if not upserted
            }
          }
          processed++;
        } catch (err) {
          console.error(`Error processing product ${product.title}:`, err);
          errors++;
        }
      }
      fetched += products.length;
      console.log(`Fetched ${fetched} products so far...`); 
    } while (cursor); 

    if (vectorUpsertBatch.length > 0 && vectorIndex) {
      await upsertWithRetry(vectorIndex, vectorUpsertBatch);
    }

    console.log(`Sync complete. Fetched: ${fetched}, Processed: ${processed}, Errors: ${errors}`);
    return NextResponse.json({ fetched, processed, errors });
  } catch (err) {
    console.error('Sync failed:', err);
    return NextResponse.json({ error: 'Sync failed', details: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

// generateVector function is no longer needed for sparse-only
// async function generateVector(product: AdminShopifyProductNode, textForEmbedding: string): Promise<number[]> {
//   try {
//     const embeddings = await generateEmbeddings(textForEmbedding);
//     if (embeddings && embeddings.length === 768) {
//       console.log(`Successfully generated real 768-dimension vector for product: ${product.id}`);
//       return embeddings;
//     } else {
//       console.warn(`Failed to generate real embeddings for product ${product.id}. Falling back to dummy vector.`);
//       return Array(768).fill(0).map(() => Math.random());
//     }
//   } catch (error) {
//     console.error(`Error in generateVector for product ${product.id}:`, error);
//     return Array(768).fill(0).map(() => Math.random());
//   }
// }
