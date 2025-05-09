// @jest-environment node
import { fetchAdminShopifyProducts, AdminShopifyProductNode } from '@lib/shopify-admin';
import { Index as VectorIndex } from '@upstash/vector';
import { NextResponse } from 'next/server';

// Mock modules at the top level
jest.mock('@lib/shopify-admin', () => ({
  fetchAdminShopifyProducts: jest.fn(),
}));

jest.mock('@upstash/vector', () => {
  const mockUpsert = jest.fn();
  const MockIndex = jest.fn().mockImplementation(() => ({
    upsert: mockUpsert,
  }));
  // Export mockUpsert via a non-standard property for access in tests
  (MockIndex as any).__mockUpsert = mockUpsert;
  return { Index: MockIndex };
});

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({
      status: options?.status || 200,
      json: async () => data,
      headers: new Map(),
      ok: (options?.status || 200) >= 200 && (options?.status || 200) < 300,
    })),
  },
}));

// Helper to access mocked functions
const mockedFetchAdminShopifyProducts = fetchAdminShopifyProducts as jest.Mock;
// Access the mock upsert function attached to the mocked constructor
const mockUpsertFn = (VectorIndex as any).__mockUpsert as jest.Mock;

// Helper to create mock product data
const createMockProduct = (id: string, title: string): Partial<AdminShopifyProductNode> => ({
  id,
  title,
  handle: `handle-${id}`,
  vendor: `Vendor ${id}`,
  productType: `Type ${id}`,
  tags: [`tag-${id}`],
  priceRange: {
    minVariantPrice: { amount: `${id}.00`, currencyCode: 'USD' },
    maxVariantPrice: { amount: `${id}.50`, currencyCode: 'USD' },
  },
  images: { edges: [{ node: { url: `image-${id}.jpg` } }] },
  variants: { edges: [{ node: { id: `variant-${id}`, priceV2: { amount: `${id}.00`, currencyCode: 'USD' } } }] },
});

describe('Sync Products API', () => {
  let originalVectorURL: string | undefined;
  let originalVectorToken: string | undefined;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Set necessary environment variables
    process.env.CRON_SECRET = 'test-secret';
    originalVectorURL = process.env.UPSTASH_VECTOR_URL; // Store original
    originalVectorToken = process.env.UPSTASH_VECTOR_TOKEN; // Store original
    process.env.UPSTASH_VECTOR_URL = 'mock-vector-url'; // Set mock value
    process.env.UPSTASH_VECTOR_TOKEN = 'mock-vector-token'; // Set mock value
    // Set default mock implementations
    mockUpsertFn.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore environment variables
    process.env.UPSTASH_VECTOR_URL = originalVectorURL;
    process.env.UPSTASH_VECTOR_TOKEN = originalVectorToken;
    // Reset modules if needed (especially if env vars affect module initialization)
    // jest.resetModules(); // Consider if needed, can slow down tests
  });

  it('should return 401 for unauthorized access', async () => {
    // Dynamically import GET inside the test
    const { GET } = await import('app/api/sync-products/route');
    const request = { url: 'http://localhost:3000/api/sync-products?secret=wrong-secret' };
    const response = await GET(request as any);

    expect(mockedFetchAdminShopifyProducts).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('should return successful sync with no errors', async () => {
    // Dynamically import GET inside the test
    const { GET } = await import('app/api/sync-products/route');
    mockedFetchAdminShopifyProducts.mockResolvedValue({
      products: [createMockProduct('1', 'Product 1')],
      pageInfo: { endCursor: null },
    });

    const request = { url: 'http://localhost:3000/api/sync-products?secret=test-secret' };
    const response = await GET(request as any);

    expect(mockedFetchAdminShopifyProducts).toHaveBeenCalledTimes(1);
    expect(mockUpsertFn).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ fetched: 1, processed: 1, errors: 0 });
  });

  it('should handle errors when fetching products from Shopify Admin', async () => {
    // Dynamically import GET inside the test
    const { GET } = await import('app/api/sync-products/route');
    mockedFetchAdminShopifyProducts.mockRejectedValue(new Error('Shopify Admin API Error'));

    const request = { url: 'http://localhost:3000/api/sync-products?secret=test-secret' };
    const response = await GET(request as any);

    expect(mockedFetchAdminShopifyProducts).toHaveBeenCalledTimes(1);
    expect(mockUpsertFn).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Sync failed', details: 'Shopify Admin API Error' });
  });

  // Increase timeout for this specific test due to retry delays
  it('should handle exceeding Upstash write limits after maximum retries', async () => {
    // Dynamically import GET inside the test
    const { GET } = await import('app/api/sync-products/route');
    mockedFetchAdminShopifyProducts.mockResolvedValue({
      products: [createMockProduct('1', 'Product 1')],
      pageInfo: { endCursor: null },
    });
    mockUpsertFn.mockRejectedValue(new Error('Exceeded daily write limit'));

    const request = { url: 'http://localhost:3000/api/sync-products?secret=test-secret' };
    const response = await GET(request as any);

    expect(mockedFetchAdminShopifyProducts).toHaveBeenCalledTimes(1);
    expect(mockUpsertFn).toHaveBeenCalledTimes(4); // Initial call + 3 retries
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Sync failed',
      details: 'Exceeded daily write limit',
    });
  }, 10000); // Set timeout to 10 seconds

  it('should handle multiple products and pagination', async () => {
    // Dynamically import GET inside the test
    const { GET } = await import('app/api/sync-products/route');
    mockedFetchAdminShopifyProducts
      .mockResolvedValueOnce({
        products: [createMockProduct('1', 'Product 1'), createMockProduct('2', 'Product 2')],
        pageInfo: { endCursor: 'cursor1' },
      })
      .mockResolvedValueOnce({
        products: [createMockProduct('3', 'Product 3')],
        pageInfo: { endCursor: null },
      });

    const request = { url: 'http://localhost:3000/api/sync-products?secret=test-secret' };
    const response = await GET(request as any);

    expect(mockedFetchAdminShopifyProducts).toHaveBeenCalledTimes(2);
    expect(mockUpsertFn).toHaveBeenCalledTimes(1); // Assuming BATCH_SIZE_VECTOR >= 3
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ fetched: 3, processed: 3, errors: 0 });
  });

  it('should verify VectorMetadata construction', async () => {
    // Dynamically import GET inside the test
    const { GET } = await import('app/api/sync-products/route');
    const mockProductData = createMockProduct('prod123', 'Test Product');
    mockedFetchAdminShopifyProducts.mockResolvedValue({
      products: [mockProductData],
      pageInfo: { endCursor: null },
    });

    const request = { url: 'http://localhost:3000/api/sync-products?secret=test-secret' };
    await GET(request as any);

    expect(mockUpsertFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'prod123',
          vector: expect.any(Array),
          metadata: {
            title: 'Test Product',
            textForBM25: 'Test Product tag-prod123 Vendor prod123 Type prod123', // Added this line
            handle: 'handle-prod123',
            vendor: 'Vendor prod123',
            productType: 'Type prod123',
            tags: ['tag-prod123'],
            price: 'prod123.00',
            imageUrl: 'image-prod123.jpg',
            productUrl: '/products/handle-prod123',
            variantId: 'variant-prod123',
          },
        }),
      ]),
    );
  });

  // Note: Test for uninitialized vectorIndex is omitted as per resolve_mock.md recommendation

  it('should fetch one product and push correctly structured data to Upstash Vector for hybrid search', async () => {
    // Dynamically import GET inside the test
    const { GET } = await import('app/api/sync-products/route');
    const mockProduct = createMockProduct('hybrid-test-1', 'Hybrid Test Product');
    // Add descriptionHtml for more complete textForBM25
    (mockProduct as AdminShopifyProductNode).descriptionHtml = 'This is a <b>test description</b> for hybrid search.';
    
    mockedFetchAdminShopifyProducts.mockResolvedValue({
      products: [mockProduct as AdminShopifyProductNode],
      pageInfo: { endCursor: null },
    });

    const request = { url: 'http://localhost:3000/api/sync-products?secret=test-secret' };
    await GET(request as any);

    expect(mockedFetchAdminShopifyProducts).toHaveBeenCalledTimes(1);
    expect(mockUpsertFn).toHaveBeenCalledTimes(1);

    // Construct the expected textForBM25 based on the logic in the route
    const expectedTextForBM25 = `${mockProduct.title} This is a test description for hybrid search. ${mockProduct.tags ? mockProduct.tags.join(' ') : ''} ${mockProduct.vendor} ${mockProduct.productType}`.replace(/\s+/g, ' ').trim();

    expect(mockUpsertFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'hybrid-test-1',
          vector: expect.any(Array), // We expect a 768-dim array, but just checking for Array is fine here
          metadata: {
            textForBM25: expectedTextForBM25,
            title: 'Hybrid Test Product',
            handle: 'handle-hybrid-test-1',
            vendor: 'Vendor hybrid-test-1',
            productType: 'Type hybrid-test-1',
            tags: ['tag-hybrid-test-1'],
            price: 'hybrid-test-1.00',
            imageUrl: 'image-hybrid-test-1.jpg',
            productUrl: '/products/handle-hybrid-test-1',
            variantId: 'variant-hybrid-test-1',
          },
        }),
      ]),
    );
    
    // Optionally, check the dimension of the vector if possible and critical
    const callArgs = mockUpsertFn.mock.calls[0][0]; // Get the first argument of the first call
    const vectorInCall = callArgs[0].vector;
    expect(vectorInCall.length).toBe(768); // Verify 768 dimensions
  });
});
