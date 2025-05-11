// Environment variables are now set in jest.setup.cjs
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { POST } from '../../../../app/api/chat/route';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load fixtures using fs
const geminiResponsesFixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../fixtures/gemini-responses.json'), 'utf-8'));
const vectorSearchResultsFixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../fixtures/vector-search-results.json'), 'utf-8'));
const shopifyProductsFixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../fixtures/shopify-products.json'), 'utf-8'));
const mockRatelimitLimit = jest.fn();
const mockVectorQuery = jest.fn();
const mockGenerateContent = jest.fn();
const mockLruCacheGet = jest.fn();
const mockLruCacheSet = jest.fn();
const mockFetchAdminShopifyProducts = jest.fn(); // For shopify-admin
const pinoMockInstances = {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    fatal: jest.fn(), trace: jest.fn(), silent: jest.fn(), child: jest.fn().mockReturnThis(),
};
// --- Module Mocks ---
jest.mock('pino', () => ({ __esModule: true, default: jest.fn(() => pinoMockInstances) }));
jest.mock('@upstash/redis', () => ({ __esModule: true, Redis: jest.fn() }));
jest.mock('@upstash/ratelimit', () => ({ __esModule: true, Ratelimit: jest.fn(() => ({ limit: mockRatelimitLimit })) }));
jest.mock('@upstash/vector', () => ({ __esModule: true, Index: jest.fn(() => ({ query: mockVectorQuery })) }));
jest.mock('@google/generative-ai', () => ({
    __esModule: true,
    GoogleGenerativeAI: jest.fn(() => ({ getGenerativeModel: jest.fn(() => ({ generateContent: mockGenerateContent })) })),
    HarmCategory: {}, HarmBlockThreshold: {},
}));
// In-memory stub for lib/redis
let redisStore = {};
const mockLibRedisGet = jest.fn(async (userId) => {
    const data = redisStore[`user:${userId}:chatHistory`];
    return data ? JSON.parse(data) : null;
});
const mockLibRedisSet = jest.fn(async (userId, history) => {
    redisStore[`user:${userId}:chatHistory`] = JSON.stringify(history);
});
jest.mock('../../../../lib/redis', () => ({
    __esModule: true,
    getEphemeralUserChatHistory: mockLibRedisGet,
    setEphemeralUserChatHistory: mockLibRedisSet,
}));
// Mock for lib/shopify-admin
jest.mock('../../../../lib/shopify-admin', () => ({
    __esModule: true,
    fetchAdminShopifyProducts: mockFetchAdminShopifyProducts,
}));
// In-memory stub for lru-cache
let lruStore = {};
jest.mock('lru-cache', () => ({
    __esModule: true,
    LRUCache: jest.fn(() => ({
        get: mockLruCacheGet,
        set: mockLruCacheSet,
        delete: jest.fn((key) => delete lruStore[key]),
        clear: jest.fn(() => { lruStore = {}; }),
    })),
}));
describe('/api/chat POST handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        redisStore = {};
        lruStore = {};
        // @ts-expect-error TS still struggles with mockResolvedValue on direct jest.fn() instances here
        mockRatelimitLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9 });
        mockLibRedisGet.mockImplementation(async (userId) => {
            const data = redisStore[`user:${userId}:chatHistory`];
            return data ? JSON.parse(data) : null;
        });
        mockLibRedisSet.mockImplementation(async (userId, history) => {
            redisStore[`user:${userId}:chatHistory`] = JSON.stringify(history);
        });
        mockLruCacheGet.mockReturnValue(null);
        mockGenerateContent.mockImplementation(async (promptArgs) => {
            let queryText = '';
            if (typeof promptArgs === 'string') {
                const match = promptArgs.match(/User Query: "([^"]*)"/);
                if (match && match[1]) {
                    queryText = match[1].toLowerCase();
                }
            }
            const fixtureResponse = geminiResponsesFixture[queryText] ||
                geminiResponsesFixture["hello"];
            return { response: { text: () => JSON.stringify(fixtureResponse) } };
        });
        mockVectorQuery.mockImplementation(async (queryArgs) => {
            const keywords = queryArgs.data || "default";
            return vectorSearchResultsFixture[keywords.toLowerCase()] ||
                vectorSearchResultsFixture["default"] ||
                [];
        });
        // @ts-expect-error
        mockFetchAdminShopifyProducts.mockResolvedValue({
            products: shopifyProductsFixture,
            pageInfo: { hasNextPage: false, endCursor: null },
        });
    });
    it('should return 429 if rate limit is exceeded', async () => {
        // @ts-expect-error
        mockRatelimitLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: Date.now() + 10000 });
        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'x-forwarded-for': '123.123.123.123' },
            body: JSON.stringify({ query: 'hello' }),
        });
        const response = await POST(req);
        expect(response.status).toBe(429);
    });
    it('should return 400 if request body is not valid JSON', async () => {
        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'x-forwarded-for': '123.123.123.123' },
            body: "{invalid json",
        });
        const response = await POST(req);
        expect(response.status).toBe(400);
    });
    it('should return 400 if query is missing or empty', async () => {
        const reqEmpty = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'x-forwarded-for': '123.123.123.123' },
            body: JSON.stringify({ query: '  ' }),
        });
        const responseEmpty = await POST(reqEmpty);
        expect(responseEmpty.status).toBe(400);
        const reqMissing = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'x-forwarded-for': '123.123.123.123' },
            body: JSON.stringify({}),
        });
        const responseMissing = await POST(reqMissing);
        expect(responseMissing.status).toBe(400);
    });
    it('should process a simple greeting query using fixtures', async () => {
        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'x-user-id': 'test-user-greeting' },
            body: JSON.stringify({ query: 'hello' }),
        });
        const response = await POST(req);
        expect(response.status).toBe(200);
        const body = await response.json();
        const expectedGeminiResponse = geminiResponsesFixture['hello'];
        expect(body.ai_understanding).toBe(expectedGeminiResponse.ai_understanding);
        expect(body.advice).toContain("Hi! How can I assist you today?");
        expect(body.product_card).toBeUndefined();
    });
    it('should process a product query using fixtures and return a product card', async () => {
        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'x-user-id': 'test-user-product' },
            body: JSON.stringify({ query: 'i need a vegan lipstick' }),
        });
        const response = await POST(req);
        expect(response.status).toBe(200);
        const body = await response.json();
        const expectedGeminiResponse = geminiResponsesFixture['i need a vegan lipstick'];
        const expectedVectorProduct = vectorSearchResultsFixture['vegan lipstick'][0].metadata;
        expect(body.ai_understanding).toBe(expectedGeminiResponse.ai_understanding);
        expect(body.advice).toContain("Looking for vegan lipsticks!");
        expect(body.product_card).toBeDefined();
        expect(body.product_card.title).toBe(expectedVectorProduct.title);
        expect(body.product_card.price).toBe(expectedVectorProduct.price);
    });
    it('should correctly use and update chat history (stubbed)', async () => {
        const userId = 'history-user';
        const initialHistory = [{ role: 'user', text: 'Previous query' }, { role: 'bot', text: 'Previous answer' }];
        redisStore[`user:${userId}:chatHistory`] = JSON.stringify(initialHistory);
        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'x-user-id': userId },
            body: JSON.stringify({ query: 'hello', history: [] }),
        });
        await POST(req);
        const updatedHistoryString = redisStore[`user:${userId}:chatHistory`];
        expect(updatedHistoryString).toBeDefined();
        const updatedHistory = JSON.parse(updatedHistoryString);
        expect(updatedHistory.length).toBe(initialHistory.length + 2);
        expect(updatedHistory[updatedHistory.length - 2].text).toBe('hello');
        expect(updatedHistory[updatedHistory.length - 1].role).toBe('bot');
    });
    it('should fallback to Shopify GraphQL when Upstash Vector query fails', async () => {
        // @ts-expect-error
        mockVectorQuery.mockRejectedValue(new Error("Upstash Vector simulated error"));
        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'x-user-id': 'test-user-fallback' },
            body: JSON.stringify({ query: 'i need a vegan lipstick' }),
        });
        const response = await POST(req);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(mockVectorQuery).toHaveBeenCalled();
        expect(mockFetchAdminShopifyProducts).toHaveBeenCalled();
        expect(body.product_card).toBeDefined();
        const expectedShopifyProduct = shopifyProductsFixture[0];
        expect(body.product_card.title).toBe(expectedShopifyProduct.title);
        expect(body.advice).toContain("(Note: Searching products via alternative method due to a temporary issue with primary search.)");
    });
    it('should handle "follow-up clarification" intent correctly via validateGeminiResponse', async () => {
        const userId = 'test-user-clarification';
        const initialHistory = [
            { role: 'user', text: 'Show me a moisturizer' },
            { role: 'bot', text: 'Here is a great moisturizer: Product X...' }
        ];
        redisStore[`user:${userId}:chatHistory`] = JSON.stringify(initialHistory);
        // Mock Gemini to initially (and perhaps incorrectly) think it's a product query
        // but correctly identify the intent as follow-up clarification.
        const mockClarificationResponse = {
            ai_understanding: "follow-up clarification",
            search_keywords: "moisturizer kit", // Gemini might still produce keywords
            advice: "You were asking about Product X. It is not part of a kit.",
            requested_product_count: 1,
            product_types: ["moisturizer"],
            is_product_query: true, // Let's say Gemini initially thinks this might lead to a product
        };
        mockGenerateContent.mockImplementationOnce(() => Promise.resolve({
            response: { text: () => JSON.stringify(mockClarificationResponse) }
        }));
        mockVectorQuery.mockClear(); // Ensure vector query is not called
        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'x-user-id': userId },
            body: JSON.stringify({ query: 'Is Product X part of a kit?' }),
        });
        const response = await POST(req);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ai_understanding).toBe("follow-up clarification");
        // validateGeminiResponse should have corrected is_product_query to false
        expect(mockVectorQuery).not.toHaveBeenCalled();
        expect(body.product_card).toBeUndefined();
        expect(body.advice).toBe("You were asking about Product X. It is not part of a kit."); // Assuming filterNegativePhrasing doesn't alter this specific positive advice
    });
    it('should handle "memory query" intent correctly via validateGeminiResponse', async () => {
        const userId = 'test-user-memory';
        const initialHistory = [
            { role: 'user', text: 'I need a serum' },
            { role: 'bot', text: 'Okay, looking for serums...' }
        ];
        redisStore[`user:${userId}:chatHistory`] = JSON.stringify(initialHistory);
        const mockMemoryResponse = {
            ai_understanding: "memory query",
            search_keywords: "",
            advice: "We were talking about serums.",
            requested_product_count: 0,
            product_types: [],
            is_product_query: false,
        };
        mockGenerateContent.mockImplementationOnce(() => Promise.resolve({
            response: { text: () => JSON.stringify(mockMemoryResponse) }
        }));
        mockVectorQuery.mockClear();
        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'x-user-id': userId },
            body: JSON.stringify({ query: 'What were we discussing?' }),
        });
        const response = await POST(req);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ai_understanding).toBe("memory query");
        expect(mockVectorQuery).not.toHaveBeenCalled();
        expect(body.product_card).toBeUndefined();
        expect(body.advice).toBe("We were talking about serums.");
    });
    it('should preserve "conversational follow-up" intent if not a simple greeting', async () => {
        const userId = 'test-user-conv-followup';
        const mockConvFollowupResponse = {
            ai_understanding: "conversational follow-up",
            search_keywords: "",
            advice: "Sure, what else is on your mind?",
            requested_product_count: 0,
            product_types: [],
            is_product_query: false,
        };
        mockGenerateContent.mockImplementationOnce(() => Promise.resolve({
            response: { text: () => JSON.stringify(mockConvFollowupResponse) }
        }));
        mockVectorQuery.mockClear();
        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            headers: { 'x-user-id': userId },
            body: JSON.stringify({ query: 'Okay cool' }), // Not a simple greeting
        });
        const response = await POST(req);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.ai_understanding).toBe("conversational follow-up");
        expect(mockVectorQuery).not.toHaveBeenCalled();
        expect(body.product_card).toBeUndefined();
        expect(body.advice).toBe("Sure, what else is on your mind?");
    });
    describe('performShopifyGraphQLQuery (via POST handler fallback)', () => {
        it('should construct a comprehensive Shopify query filter and call fetchAdminShopifyProducts', async () => {
            const userId = 'test-user-graphql-complex';
            // Simulate Upstash Vector failure to trigger GraphQL fallback
            // @ts-expect-error
            mockVectorQuery.mockRejectedValue(new Error("Simulated Vector Error"));
            const complexGeminiResult = {
                ai_understanding: "product query for combo",
                search_keywords: "brightening serum combo",
                advice: "Looking for a brightening serum combo.",
                requested_product_count: 2,
                product_types: ["serum", "moisturizer"],
                usage_instructions: "Use daily.",
                price_filter: null,
                sort_by_price: false,
                vendor: "AwesomeBrand",
                attributes: ["vegan", "hydrating"],
                is_product_query: true,
            };
            // Mock generateContent to return this specific geminiResult
            // The general mock implementation might not pick up "brightening serum combo" from fixtures
            mockGenerateContent.mockImplementationOnce(() => Promise.resolve({
                response: { text: () => JSON.stringify(complexGeminiResult) }
            }));
            // Mock shopify-admin to return some products
            const mockShopifyResponse = {
                products: [
                    {
                        id: 'gid://shopify/Product/123', handle: 'bright-serum', title: 'Brightening Serum by AwesomeBrand',
                        priceRange: { minVariantPrice: { amount: '25.00' } }, images: { edges: [{ node: { url: 'url1.jpg' } }] },
                        onlineStoreUrl: '/products/bright-serum', variants: { edges: [{ node: { id: 'gid://shopify/ProductVariant/123v' } }] },
                        vendor: 'AwesomeBrand', productType: 'Serum', tags: ['vegan', 'hydrating', 'serum'], descriptionHtml: 'A great serum'
                    },
                    {
                        id: 'gid://shopify/Product/456', handle: 'hydro-moist', title: 'Hydrating Moisturizer by AwesomeBrand',
                        priceRange: { minVariantPrice: { amount: '30.00' } }, images: { edges: [{ node: { url: 'url2.jpg' } }] },
                        onlineStoreUrl: '/products/hydro-moist', variants: { edges: [{ node: { id: 'gid://shopify/ProductVariant/456v' } }] },
                        vendor: 'AwesomeBrand', productType: 'Moisturizer', tags: ['vegan', 'hydrating', 'moisturizer'], descriptionHtml: 'A great moisturizer'
                    }
                ],
                pageInfo: { hasNextPage: false, endCursor: null }
            };
            // @ts-expect-error
            mockFetchAdminShopifyProducts.mockResolvedValueOnce(mockShopifyResponse);
            const req = new NextRequest('http://localhost/api/chat', {
                method: 'POST',
                headers: { 'x-user-id': userId },
                body: JSON.stringify({ query: 'brightening serum combo from AwesomeBrand for vegan and hydrating' }),
            });
            const response = await POST(req);
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(mockVectorQuery).toHaveBeenCalledTimes(1); // It should be called once and fail
            expect(mockFetchAdminShopifyProducts).toHaveBeenCalledTimes(1);
            // Assert the constructed Shopify query filter
            // This is the most complex part to assert precisely due to its dynamic nature
            // Example expected parts: status:active, vendor:"AwesomeBrand", (tag:"vegan" AND tag:"hydrating")
            // ((title:*brightening* OR title:*serum* OR title:*combo*) OR (product_type:*serum* OR title:*serum*) OR (product_type:*moisturizer* OR title:*moisturizer*) OR (title:*set* OR title:*kit* OR title:*bundle*))
            // OR ((tag:set OR tag:kit OR tag:combo OR tag:bundle))
            const expectedShopifyFilterParts = [
                'status:active',
                'vendor:"AwesomeBrand"',
                '(tag:"vegan" AND tag:"hydrating")',
                'title:*brightening*',
                'title:*serum*',
                'title:*combo*',
                'product_type:*serum*',
                'product_type:*moisturizer*',
                'tag:set', // or kit, combo, bundle
            ];
            const actualFilterArg = mockFetchAdminShopifyProducts.mock.calls[0][2]; // Third argument is the filter string
            for (const part of expectedShopifyFilterParts) {
                expect(actualFilterArg).toContain(part);
            }
            expect(body.complementary_products).toBeDefined();
            if (body.complementary_products) { // Type guard
                expect(body.complementary_products.length).toBe(2);
                expect(body.complementary_products[0].title).toBe('Brightening Serum by AwesomeBrand');
                expect(body.complementary_products[1].title).toBe('Hydrating Moisturizer by AwesomeBrand');
            }
            expect(body.advice).toContain("(Note: Searching products via alternative method due to a temporary issue with primary search.)");
        });
    });
});
