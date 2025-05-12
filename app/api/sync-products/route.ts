import { AdminFetchResult, fetchAdminShopifyProducts } from '@lib/shopify-admin';
import { Index as VectorIndex } from '@upstash/vector';
import { NextResponse } from 'next/server';

type VectorMetadata = {
  textForBM25: string;
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  tags: string[];
  price: number; // Store as number (representing cents)
  imageUrl: string;
  productUrl: string;
  variantId: string;
};

type SparseVectorRecord = {
  id: string;
  data: string;
  metadata: VectorMetadata;
};

const vectorIndex: VectorIndex<VectorMetadata> | null = process.env.UPSTASH_VECTOR_REST_URL && process.env.UPSTASH_VECTOR_REST_TOKEN
  ? new VectorIndex<VectorMetadata>({
      url: (process.env.UPSTASH_VECTOR_REST_URL || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
      token: (process.env.UPSTASH_VECTOR_REST_TOKEN || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
    })
  : null;

const BATCH_SIZE_VECTOR = 25;
const MAX_RETRIES = 3;

function areObjectsEqual(obj1: Record<string, unknown>, obj2: Record<string, unknown>): boolean {
  if (obj1 === null && obj2 === null) return true;
  if (obj1 === null || obj2 === null) return false;
  const sortedObj1 = JSON.stringify(Object.keys(obj1).sort().reduce((acc, key) => { acc[key] = obj1[key]; return acc; }, {} as Record<string, unknown>));
  const sortedObj2 = JSON.stringify(Object.keys(obj2).sort().reduce((acc, key) => { acc[key] = obj2[key]; return acc; }, {} as Record<string, unknown>));
  return sortedObj1 === sortedObj2;
}

const BASE_RETRY_DELAY = 1000;
const SECRET = process.env.CRON_SECRET;

async function upsertWithRetry(
  currentIndex: VectorIndex<VectorMetadata>,
  batch: SparseVectorRecord[],
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
    await currentIndex.upsert(itemsToUpsert);
    console.log(`Successfully upserted batch of ${itemsToUpsert.length} sparse records`);
  } catch (err) {
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

async function fetchExchangeRate(from: string, to: string): Promise<number> {
  try {
    const res = await fetch(`https://api.exchangerate.host/convert?from=${from}&to=${to}`);
    const data = await res.json();
    if (data && data.info && data.info.rate) {
      return data.info.rate;
    }
    throw new Error('Invalid exchange rate response');
  } catch (err) {
    console.error('Failed to fetch exchange rate:', err);
    return 1; // fallback: no conversion
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
  const vectorUpsertBatch: SparseVectorRecord[] = [];

  let exchangeRate = 1;
  let storeCurrency = 'USD';
  try {
    const firstResult: AdminFetchResult = await fetchAdminShopifyProducts(null);
    if (firstResult.products.length > 0) {
      storeCurrency = firstResult.products[0].priceRange.minVariantPrice.currencyCode || 'USD';
    }
    if (storeCurrency !== 'USD') {
      exchangeRate = await fetchExchangeRate(storeCurrency, 'USD');
      console.log(`Exchange rate ${storeCurrency}->USD:`, exchangeRate);
    }
  } catch (err) {
    console.error('Error determining store currency or exchange rate:', err);
  }

  try {
    do {
      const result: AdminFetchResult = await fetchAdminShopifyProducts(cursor);
      const products = result.products;
      cursor = result.pageInfo.endCursor;

      for (const product of products) {
        try {
          const productType = product.productType ? product.productType.split('>').pop()?.trim() : '';
          const tags = product.tags ? product.tags.map(tag => tag.trim()) : []; // Keep tags as an array
          const textForBM25 = `${product.title} ${product.descriptionHtml || ''} ${tags.join(' ') || ''} ${product.vendor || ''} ${productType || ''}`.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); // Join tags for textForBM25

          // Treat price from Shopify API as an integer representing cents (or smallest unit)
          const priceFromShopify = parseInt(product.priceRange.minVariantPrice.amount, 10);

          // Apply exchange rate if necessary, keeping it as cents
          const priceToStore: number = storeCurrency === 'USD' ? priceFromShopify : Math.round(priceFromShopify * exchangeRate);


          const sparseVectorData: SparseVectorRecord = {
            id: product.id,
            data: textForBM25,
            metadata: {
              textForBM25: textForBM25,
              title: product.title,
              handle: product.handle,
              vendor: product.vendor || '',
              productType: productType || '',
              tags: tags, // Store tags as an array
              price: priceToStore, // Store the price in cents
              imageUrl: product.images?.edges[0]?.node.url || '',
              productUrl: product.onlineStoreUrl || `/products/${product.handle}`,
              variantId: product.variants?.edges[0]?.node.id || product.id,
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
