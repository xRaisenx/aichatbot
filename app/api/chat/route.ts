import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { Ratelimit } from "@upstash/ratelimit";
import { generateEmbeddings } from '../../../lib/gemini'; // Import for query embedding
// Redis import might be partially or fully replaced by lib/redis.ts usage for chat history
import { Redis } from "@upstash/redis"; // Keep for Ratelimit if it needs its own instance type
import { Index, QueryResult } from '@upstash/vector';
import { NextRequest, NextResponse } from 'next/server';
import { setTimeout } from 'timers/promises'; // Import for async timeout
import { getEphemeralUserChatHistory, setEphemeralUserChatHistory } from '../../../lib/redis'; // Chat history functions using node-redis client

/**
 * @fileoverview API route handler for the chat endpoint (/api/chat).
 * Handles user chat queries, interacts with AI (Gemini), performs vector search
 * for products, manages chat history, and implements rate limiting.
 */

// --- Rate Limiter Initialization ---
/**
 * Rate limiter instance using Upstash Ratelimit.
 * Limits requests based on IP address or user ID using a sliding window algorithm.
 * Configured via environment variables UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 */
const ratelimit = new Ratelimit({
  redis: new Redis({
    url: (process.env.UPSTASH_REDIS_REST_URL || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
    token: (process.env.UPSTASH_REDIS_REST_TOKEN || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
  }),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  prefix: "@upstash/ratelimit",
});

// --- Initialize External Clients & Caches ---

/** Name of the Upstash Vector index used for product search. */
const UPSTASH_VECTOR_INDEX_NAME = 'idx:products_vss';

/** In-memory cache for recent chat histories to reduce Redis lookups. Maps userId to chat history. */
const chatHistoryCache = new Map<string, Array<{ role: 'user' | 'bot' | 'model'; text?: string }>>();

/** Upstash Vector client instance. Initialized using environment variables. */
let vectorIndex: Index<ProductVectorMetadata> | null = null; // Explicitly type with ProductVectorMetadata
// const VECTOR_TIMEOUT_MS = 15000; // Timeout configuration removed as it's not directly supported here

// Attempt to initialize Vector client using UPSTASH_VECTOR_URL and UPSTASH_VECTOR_TOKEN
if (process.env.UPSTASH_VECTOR_URL && process.env.UPSTASH_VECTOR_TOKEN) {
    try {
        vectorIndex = new Index<ProductVectorMetadata>({ // Add type argument
            url: (process.env.UPSTASH_VECTOR_URL || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
            token: (process.env.UPSTASH_VECTOR_TOKEN || '').replace(/^"|"$/g, '').replace(/;$/g, ''),
            // requestTimeout: VECTOR_TIMEOUT_MS, // Removed: Not a valid property in IndexConfig
        });
        console.log(`Upstash Vector client initialized with UPSTASH_VECTOR_URL.`);
    } catch (error) {
        console.error('Failed to initialize Vector with UPSTASH_VECTOR_URL:', error);
    }
} else {
    console.error('Missing Upstash Vector credentials (UPSTASH_VECTOR_URL or UPSTASH_VECTOR_TOKEN).');
}

/** Google Generative AI client instance. */
let genAI: GoogleGenerativeAI | null = null;
/** Specific Gemini model instance (e.g., 'gemini-1.5-flash-latest'). */
let geminiModel: GenerativeModel | null = null;
// Initialize Gemini client if API key is provided
if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not found in .env.local. Skipping Gemini initialization.');
} else {
    try {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
        console.log('Google Gemini client initialized.');
    } catch (error) {
        console.error('Failed to initialize Google Gemini client:', error);
    }
}

// --- Type Definitions ---

/**
 * Interface representing the metadata structure stored alongside product vectors
 * in the Upstash Vector index.
 */
interface ProductVectorMetadata {
    textForBM25?: string; // Added for hybrid search
    id: string;
    handle: string;
    title: string;
    price: string;
    imageUrl: string | null;
    productUrl: string;
    variantId?: string;
    vendor?: string | null;
    productType?: string | null;
    tags?: string;
    usageInstructions?: string;
    [key: string]: unknown; // Allows for additional arbitrary properties
}

/**
 * Interface for the structured response representing a single product card
 * to be displayed in the chat interface.
 */
export interface ProductCardResponse {
    title: string;
    description: string;
    price: string;
    image: string | null;
    landing_page: string;
    variantId: string; // Shopify variant ID for Add-to-Cart functionality
}

/**
 * Interface defining the overall structure of the JSON response sent back
 * by the chat API endpoint.
 */
interface ChatApiResponse {
    ai_understanding: string;
    product_card?: ProductCardResponse;
    advice: string;
    product_comparison?: ProductCardResponse[];
    complementary_products?: ProductCardResponse[];
    history: Array<{ role: 'user' | 'bot' | 'model'; text?: string }>; // Updated chat history
}

// --- Dynamic Keyword Mappings (Built at Startup) ---

/**
 * Interface for storing dynamically generated keyword mappings derived from product data.
 * Used to improve search relevance based on product types and synonyms.
 */
interface KeywordMappings {
    typeToKeywords: Record<string, string>;
    synonyms: Record<string, string[]>;
    defaultComboTypes: string[];
}

let keywordMappings: KeywordMappings = {
    typeToKeywords: {},
    synonyms: {},
    defaultComboTypes: [],
};

function isProductVectorMetadata(metadata: unknown): metadata is ProductVectorMetadata {
    if (!metadata || typeof metadata !== 'object') {
        return false;
    }

    const m: MetadataWithOptionalProperties = metadata as MetadataWithOptionalProperties;

    return (
        typeof m.id === 'string' &&
        typeof m.handle === 'string' &&
        typeof m.title === 'string' &&
        typeof m.price === 'string' &&
        (m.imageUrl === null || typeof m.imageUrl === 'string') &&
        typeof m.productUrl === 'string'
    );
}

interface MetadataWithOptionalProperties {
    id?: unknown;
    handle?: unknown;
    title: string;
    price: string;
    imageUrl: string | null;
    productUrl: string;
}

async function buildDynamicMappings(): Promise<void> {
    if (!vectorIndex) {
        console.warn('Cannot build dynamic mappings: Vector client not initialized.');
        return;
    }

    try {
        const results = await vectorIndex.query({
            data: 'all products',
            topK: 1000,
            includeMetadata: true,
        });

        if (!results || results.length === 0) {
            console.warn('No products found for dynamic mappings.');
            return;
        }

        const typeToKeywords: Record<string, string> = {};
        const synonyms: Record<string, string[]> = {};
        const productTypes = new Set<string>();
        const allTags = new Set<string>();

        for (const result of results) {
            if (!result.metadata || !isProductVectorMetadata(result.metadata)) {
                continue;
            }
            const { productType, tags, title } = result.metadata;

            // Normalize productType
            const normalizedType = productType
                ? (productType as string).split('>').pop()?.trim().toLowerCase() || ''
                : '';
            if (normalizedType) {
                productTypes.add(normalizedType);
                // Map type to keywords (use title or tags for context)
                const keywords = [
                    normalizedType,
                    ...(tags ? tags.split(',').map(t => t.trim().toLowerCase()) : []),
                    ...(title ? title.toLowerCase().split(' ').slice(0, 3) : []),
                ].join(' ');
                typeToKeywords[normalizedType] = keywords;

                // Build synonyms from tags and title
                const tagList = tags ? tags.split(',').map(t => t.trim().toLowerCase()) : [];
                synonyms[normalizedType] = [...new Set([
                    ...(synonyms[normalizedType] || []),
                    ...tagList,
                    ...(title ? title.toLowerCase().split(' ').filter(word => word.length > 3) : []),
                ])];
            }

            // Collect tags
            if (tags) {
                tags.split(',').map(t => t.trim().toLowerCase()).forEach(t => allTags.add(t));
            }
        }

        // Default combo types (most common product types)
        const defaultComboTypes = Array.from(productTypes).slice(0, 3);

        keywordMappings = {
            typeToKeywords,
            synonyms,
            defaultComboTypes,
        };

        console.log('Dynamic mappings built:', {
            typeCount: Object.keys(typeToKeywords).length,
            synonymCount: Object.keys(synonyms).length,
            defaultComboTypes,
        });
    } catch (error) {
        console.error('Failed to build dynamic mappings:', error);
    }
}

// Initialize mappings at startup
buildDynamicMappings().catch(err => console.error('Dynamic mappings initialization failed:', err));

function parsePrice(priceStr: string): number {
    const cleaned = priceStr.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
}

export async function POST(req: NextRequest) {
    console.log('Chat API: /api/chat endpoint hit.');
    let searchNote = '';
    // The local 'redis' instance for chat history is no longer needed here,
    // as getEphemeralUserChatHistory and setEphemeralUserChatHistory use the client from lib/redis.ts

    try {
        const identifier = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? "anonymous";
        // Add debug logs to inspect rate-limiting behavior
        const { success, limit, remaining } = await ratelimit.limit(identifier);
        console.log(`Rate limit check: success=${success}, limit=${limit}, remaining=${remaining}`);

        if (!success) {
            return new NextResponse("Too Many Requests", {
            status: 429,
            headers: {
                'X-RateLimit-Limit': String(limit),
                'X-RateLimit-Remaining': String(remaining),
            }
            });
        }

        let body;
        try {
            body = await req.json();
        } catch (error) {
            console.error('Failed to parse request body:', error);
            return NextResponse.json({ error: 'Failed to parse request body' }, { status: 400 });
        }
        const { query, history: clientHistory = [] } = body as {
            query: string;
            history: Array<{ role: 'user' | 'bot' | 'model'; text?: string }>;
        };

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            console.error('Invalid query provided');
            return NextResponse.json({ error: 'Invalid query provided' }, { status: 400 });
        }
        const trimmedQuery = query.trim();
        console.log(`Processing query: "${trimmedQuery}"`);

        const userId = req.headers.get('x-user-id') || "anonymous";
        let history: Array<{ role: 'user' | 'bot' | 'model'; text?: string }>;
        const memoryCachedHistory = chatHistoryCache.get(userId);

        if (memoryCachedHistory) {
            history = memoryCachedHistory;
            console.log('Chat history retrieved from in-memory cache.');
        } else {
            const redisHistory = await getEphemeralUserChatHistory(userId);
            if (redisHistory && Array.isArray(redisHistory)) {
                history = redisHistory;
                console.log('Chat history retrieved from Redis via getEphemeralUserChatHistory.');
                if (history.length > 0) chatHistoryCache.set(userId, history); // Populate in-memory cache
            } else {
                history = clientHistory; // clientHistory defaults to [] from request body destructuring
                if (redisHistory) { // If redisHistory was truthy but not a valid array
                     console.warn('Invalid history format from getEphemeralUserChatHistory; using client/request history.');
                } else { // redisHistory was null/undefined
                     console.log('No chat history in Redis via getEphemeralUserChatHistory; using client/request history.');
                }
            }
        }
        // Ensure history is definitely an array
        if (!Array.isArray(history)) {
            history = [];
        }

        const geminiHistory = history
            .filter(msg => msg.text && msg.text.trim().length > 0)
            .map(msg => ({
                role: (msg.role === 'bot' || msg.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
                content: msg.text as string,
            }));

        // --- Stage 1: Get AI Understanding, Advice, Search Keywords, and Combo Info ---
        let geminiResult: {
            ai_understanding: string;
            search_keywords: string;
            advice: string;
            requested_product_count: number;
            product_types: string[];
            usage_instructions?: string;
            price_filter?: number | null;
            sort_by_price?: boolean;
            vendor?: string;
            attributes?: string[];
            product_tags?: string;
            is_product_query: boolean; // Added for explicit intent
        } = {
            ai_understanding: 'Unable to interpret query intent.',
            search_keywords: '',
            advice: 'Sorry, I had trouble understanding your request.',
            requested_product_count: 1,
            product_types: [],
            price_filter: null,
            sort_by_price: false,
            vendor: '',
            is_product_query: false, // Default to false
        };

        // --- Timeout Wrapper for Promises ---
        const GEMINI_TIMEOUT_MS = 10000; // 10 seconds timeout for Gemini call
        const timeoutSignal = Symbol('timeout'); // Unique symbol for timeout rejection

        async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
            const timeoutPromise = setTimeout(ms, timeoutSignal).then(() => {
                throw new Error(`Operation timed out after ${ms}ms`);
            });
            return Promise.race([promise, timeoutPromise]) as Promise<T>;
        }

        if (geminiModel) {
            console.log('Calling Gemini for understanding...');
            const understandingPrompt = `Analyze the user query and chat history for a beauty store. Provide:
            1. "ai_understanding": A brief summary of the user's intent.
            2. "search_keywords": Space-separated keywords for product search. If not a product query OR if it's a simple greeting, return empty string.
            3. "advice": A conversational response. 
               - If "is_product_query" is true, provide advice related to the products or query.
               - If "is_product_query" is false AND the User Query is a simple greeting (e.g., "Hello", "Hi"), respond with a friendly, concise greeting (e.g., "Hello! How can I help you today?").
               - Otherwise, provide general conversational advice or answer the question.
            4. "requested_product_count": Number of products requested. Set to 4 for "top 4 cheapest", length of product_types for combos, 10 for generic lists, or 1 otherwise. If not a product query or if it's a simple greeting, set to 0.
            5. "product_types": Array of product types (e.g., ["lipstick"], ["cleanser", "moisturizer"]). Use normalized types. If not a product query or if it's a simple greeting, return empty array.
            6. "usage_instructions": Detailed instructions for using products. If not a product query or if it's a simple greeting, return empty string or a very brief, relevant non-product tip if appropriate.
            7. "price_filter": Maximum price in USD (e.g., 20 for "under $20") or null if unspecified.
            8. "sort_by_price": Boolean, true if query includes "cheapest".
            9. "vendor": Brand name if specified, or empty string if none.
            10. "attributes": An array of product attributes (e.g., ["vegan", "cruelty-free"]).
            11. "is_product_query": Boolean. True if the LATEST user query explicitly asks for product suggestions, recommendations, or to find/show products. False for general questions, advice not directly tied to finding a specific product, or conversational follow-ups/greetings that don't ask for more products.
            Format the output as a JSON string.

            User Query: "${trimmedQuery}"
            Chat History: ${JSON.stringify(geminiHistory.slice(-6))}`;
            // Product Tags: ${geminiResult.product_tags || 'No tags found'} // Removed as product_tags are not available at this stage

            try {
                console.log(`Attempting Gemini call with ${GEMINI_TIMEOUT_MS}ms timeout...`);
                const geminiPromise = geminiModel.generateContent(understandingPrompt);
                const result = await withTimeout(geminiPromise, GEMINI_TIMEOUT_MS);
                console.log('Gemini call completed within timeout.');

                const textResponse = result.response.text().trim();
                let jsonString = textResponse;

                const jsonMatch = jsonString.match(/```(?:json)?\n([\s\S]*?)```/i);
                if (jsonMatch && jsonMatch[1]) {
                    jsonString = jsonMatch[1].trim();
                } else {
                    const jsonObjMatch = jsonString.match(/{[\s\S]*}/);
                    if (jsonObjMatch) {
                        jsonString = jsonObjMatch[0];
                    }
                }

                try {
                    const parsed = JSON.parse(jsonString);
                    if (
                        typeof parsed.ai_understanding === 'string' &&
                        typeof parsed.search_keywords === 'string' &&
                        typeof parsed.advice === 'string' &&
                        typeof parsed.requested_product_count === 'number' &&
                        Array.isArray(parsed.product_types) &&
                        (parsed.usage_instructions === undefined || typeof parsed.usage_instructions === 'string') &&
                        (parsed.price_filter === null || typeof parsed.price_filter === 'number') &&
                        typeof parsed.sort_by_price === 'boolean' &&
                        typeof parsed.vendor === 'string' &&
                        typeof parsed.is_product_query === 'boolean' // Added check for is_product_query
                    ) {
                        geminiResult = parsed;
                        // Adjust requested_product_count
                        if (geminiResult.product_types.length > 0) {
                            geminiResult.requested_product_count = geminiResult.product_types.length;
                        } else if (trimmedQuery.toLowerCase().includes('set') || trimmedQuery.toLowerCase().includes('combo')) {
                            geminiResult.product_types = keywordMappings.defaultComboTypes.length > 0
                                ? keywordMappings.defaultComboTypes
                                : ['cleanser', 'moisturizer', 'treatment'];
                            geminiResult.requested_product_count = geminiResult.product_types.length;
                        } else if (trimmedQuery.toLowerCase().includes('top 4 cheapest')) {
                            geminiResult.requested_product_count = 4;
                        } else if (trimmedQuery.toLowerCase().includes('list')) {
                            geminiResult.requested_product_count = Math.min(geminiResult.requested_product_count || 10, 10);
                        }
                        console.log('Successfully parsed Gemini JSON:', geminiResult);
                    } else {
                        console.warn('Invalid Gemini response structure:', parsed);
                    }
                } catch (parseError) {
                    console.error('Failed to parse Gemini response:', parseError, '\nRaw response:', textResponse);
                }
            } catch (llmError: unknown) { // Catch any error, including timeout
                if (llmError instanceof Error && llmError.message?.includes('timed out')) {
                    console.error(`Gemini call timed out after ${GEMINI_TIMEOUT_MS}ms.`);
                    // Keep default geminiResult values on timeout
                } else {
                    console.error('Error calling Gemini:', llmError);
                }
            }
        } else {
            console.warn('Gemini client not initialized.');
        }

        // --- Stage 2: Vector Search ---
        let finalProductCards: ProductCardResponse[] = [];
        const SIMILARITY_THRESHOLD = 0.03;
        const requestedCount = Math.max(1, geminiResult.requested_product_count || 1);
        const topK = Math.max(requestedCount * 2, 10);

        const performVectorQuery = async (
            searchText: string,
            k: number,
            filter?: { productType?: string; tags?: string; vendor?: string }
        ): Promise<QueryResult<ProductVectorMetadata>[] | null> => {
            if (!vectorIndex) {
                console.warn('Vector client not initialized.');
                return null;
            }

            if (!searchText || searchText.trim().length === 0) {
                console.log('No search text provided.');
                return null;
            }

            try {
                console.log(`Querying vector index '${UPSTASH_VECTOR_INDEX_NAME}' with text: "${searchText.substring(0, 70)}...", topK: ${k}`);

                // Generate dense vector for the query text
                const queryVector = await generateEmbeddings(searchText);
                let results: QueryResult<ProductVectorMetadata>[];

                if (queryVector && queryVector.length === 768) {
                    console.log('Performing HYBRID search (dense vector + sparse/BM25).');
                    // Restored 'data: searchText' for hybrid query and suppress potential TS error
                    // @ts-expect-error - SDK types might conflict when providing both vector and data for hybrid query
                    results = await vectorIndex.query({ 
                        vector: queryVector,
                        data: searchText, // Restored for hybrid search
                        topK: k,
                        includeMetadata: true,
                    }) as QueryResult<ProductVectorMetadata>[]; // Kept assertion on result
                } else {
                    console.warn('Failed to generate query vector or vector is not 768-dim. Falling back to SPARSE search (BM25 only).');
                    // Fixed syntax error: Restored closing parenthesis before 'as'
                    results = (await vectorIndex.query({ 
                        data: searchText, // Fallback to sparse search
                        topK: k,
                        includeMetadata: true,
                    })) as QueryResult<ProductVectorMetadata>[];
                }

                if (!results || results.length === 0) {
                    console.log(' -> No results found.');
                    return null;
                }

                console.log(` -> Found ${results.length} matches. Top match ID: ${results[0].id}, Score: ${results[0].score.toFixed(4)}`);

                let filteredResults = results.filter(result => {
                    if (!result.metadata || !isProductVectorMetadata(result.metadata)) {
                        console.warn(' -> Invalid metadata:', result.metadata);
                        return false;
                    }

                    const metadata = result.metadata;
                    let typeMatch = true;
                    const tagMatch = true;
                    let vendorMatch = true;
                    let priceMatch = true;
                    let attributeMatch = true;

                    // Check product type
                    if (filter?.productType) {
                        const productTypeLower = filter.productType.toLowerCase();
                        const metadataProductType = (metadata.productType ?? '').split('>').pop()?.trim().toLowerCase() || '';
                        typeMatch = metadataProductType.includes(productTypeLower);
                    }

                    // Extract tags from metadata
                    const metadataTagsLower = (metadata.tags ?? '').toLowerCase();

                    // Check tags and title for attributes
                    if (geminiResult.attributes && geminiResult.attributes.length > 0) {
                        const attributesLower = geminiResult.attributes.map(attr => attr.toLowerCase());
                        attributeMatch = attributesLower.every(attr => {
                            return metadataTagsLower.includes(attr);
                        });
                    }

                    // Check vendor
                    if (filter?.vendor) {
                        const vendorLower = filter.vendor.toLowerCase();
                        const metadataVendor = (metadata.vendor ?? '').toLowerCase();
                        vendorMatch = metadataVendor === vendorLower;
                    }

                   // Check price
                    if (geminiResult.price_filter != null) {
                        const price = parsePrice(metadata.price);
                        priceMatch = price <= geminiResult.price_filter;
                    } else if (geminiResult.attributes?.includes('under $20')) {
                        const price = parsePrice(metadata.price);
                        priceMatch = price <= 20;
                    }

                    // Add product tags to geminiResult
                    geminiResult.product_tags = metadataTagsLower;

                    return typeMatch && tagMatch && vendorMatch && priceMatch && attributeMatch;
                });

                if (geminiResult.sort_by_price) {
                    filteredResults = filteredResults
                        .filter(result => result.metadata != null)
                        .sort((a: QueryResult<ProductVectorMetadata>, b: QueryResult<ProductVectorMetadata>) => parsePrice((a.metadata as ProductVectorMetadata).price) - parsePrice((b.metadata as ProductVectorMetadata).price));
                }

                console.log(` -> After filtering: ${filteredResults.length} valid results.`);
                return filteredResults.length > 0 ? filteredResults : null;

            } catch (error) {
                console.error('Upstash Vector Query Error:', error);
                searchNote = '\n(Note: There was an issue searching for products.)';
                return null;
            }
        };

        let topMatches: QueryResult<ProductVectorMetadata>[] = [];
        let searchStageUsed = 'None';

        // Handle combo or multi-product requests
        if (geminiResult.product_types && geminiResult.product_types.length > 0) {
            console.log('Handling request for types:', geminiResult.product_types);
            const usedProductIds = new Set<string>();
            for (const productType of geminiResult.product_types) {
                const searchKeywords = keywordMappings.typeToKeywords[productType.toLowerCase()] ||
                    geminiResult.search_keywords ||
                    trimmedQuery;

                let results = await performVectorQuery(searchKeywords, topK, {
                    productType,
                    tags: productType,
                    vendor: geminiResult.vendor,
                });
                if (!results || results.length === 0) {
                    console.log(`No matches for productType or tag "${productType}". Trying broader search...`);
                    results = await performVectorQuery(searchKeywords, topK, {
                        tags: productType,
                        vendor: geminiResult.vendor,
                    });
                }
                if (!results || results.length === 0) {
                    console.log(`No matches for "${productType}". Trying generic search...`);
                    results = await performVectorQuery(productType, topK, {
                        vendor: geminiResult.vendor,
                    });
                }
                if (results && results.length > 0) {
                    const newResults = results.filter(r => !usedProductIds.has(String(r.id)));
                    topMatches.push(...newResults.slice(0, geminiResult.sort_by_price ? 4 : 1));
                    newResults.forEach(r => usedProductIds.add(String(r.id)));
                } else {
                    console.log(`No matches found for "${productType}".`);
                }
            }
            searchStageUsed = 'Multi-Type Query';
        } else {
            if (geminiResult.search_keywords && geminiResult.search_keywords.trim().length > 0) {
                console.log('Attempting search with AI keywords...');
                const results = await performVectorQuery(geminiResult.search_keywords, topK, {
                    vendor: geminiResult.vendor,
                });
                if (results) {
                    topMatches = results;
                    searchStageUsed = 'AI Keywords';
                }
            }

            if (topMatches.length < requestedCount || !topMatches.some(m => m.score >= SIMILARITY_THRESHOLD)) {
                const logReason =
                    topMatches.length === 0
                        ? 'Keyword search yielded no results'
                        : `Not enough matches (${topMatches.length}/${requestedCount}) or no scores above ${SIMILARITY_THRESHOLD}`;
                console.log(`${logReason}. Attempting direct query...`);

                const directResults = await performVectorQuery(trimmedQuery, topK, {
                    vendor: geminiResult.vendor,
                });
                if (directResults) {
                    topMatches = directResults;
                    searchStageUsed = 'Direct Query';
                }
            }
        }

        // Fallback for no matches or low scores
        if (topMatches.length === 0 || !topMatches.some(m => m.score >= SIMILARITY_THRESHOLD)) {
            console.log(`No matches above threshold (${SIMILARITY_THRESHOLD}). Attempting fallback search...`);
            const fallbackKeywords = geminiResult.product_types.join(' ') || geminiResult.search_keywords || 'beauty products';
            const fallbackResults = await performVectorQuery(fallbackKeywords, topK, {
                vendor: geminiResult.vendor,
            });
            if (fallbackResults) {
                topMatches = fallbackResults;
                searchStageUsed = 'Fallback Related Products';
                searchNote =
                    '\n(Sorry, we couldn\'t find exact matches for your request, but here are some related products you might like.)';
            }
        }

        // Process matches
        if (topMatches.length > 0) {
            let validMatches = topMatches
                .filter(m => m.metadata && isProductVectorMetadata(m.metadata))
                .slice(0, requestedCount);

            if (geminiResult.sort_by_price) {
                validMatches = validMatches
                    .filter(m => m.metadata != null)
                    .sort((a: QueryResult<ProductVectorMetadata>, b: QueryResult<ProductVectorMetadata>) => parsePrice((a.metadata as ProductVectorMetadata).price) - parsePrice((b.metadata as ProductVectorMetadata).price));
            }

            if (validMatches.length > 0 && searchStageUsed !== 'Fallback Related Products') {
                finalProductCards = validMatches
                    .filter(m => m.score >= SIMILARITY_THRESHOLD)
                    .map(match => {
                        const productData = match.metadata!;
                        console.log(
                            `Match Selected (using ${searchStageUsed}): "${productData.title}", Score: ${match.score.toFixed(4)}, Price: ${productData.price}`
                        );
                        return {
                            title: productData.title,
                            description: 'Found product related to your query.',
                            price: productData.price,
                            image: productData.imageUrl,
                            landing_page: productData.productUrl,
                            variantId: productData.variantId || productData.id,
                            tags: productData.tags || '',
                        };
                    });
                if (finalProductCards.length > 0) {
                    searchNote = '';
                }
            }

            if (finalProductCards.length === 0) {
                finalProductCards = validMatches.map(match => {
                    const productData = match.metadata!;
                    console.log(`Fallback Match Selected: "${productData.title}", Score: ${match.score.toFixed(4)}, Price: ${productData.price}`);
                    return {
                        title: productData.title,
                        description: 'Related product suggestion.',
                        price: productData.price,
                        image: productData.imageUrl,
                        landing_page: productData.productUrl,
                        variantId: productData.variantId || productData.id,
                        tags: productData.tags || '',
                    };
                });
            }
        } else {
            console.log(`No matching products found after ${searchStageUsed}.`);
            searchNote = '\n(I couldn\'t find specific products matching your request.)';
        }

        // --- Construct Final Response ---
        const defaultUsageInstructions = geminiResult.usage_instructions ||
            'For skincare products: \n1. Cleanse your face with a gentle cleanser and pat dry.\n2. Apply a small amount of the product to affected areas, once or twice daily as directed.\n3. Follow with a non-comedogenic moisturizer.\n4. Use sunscreen during the day.\nFor makeup like lipstick: Apply evenly to lips, reapply as needed.\nAlways patch test new products and consult a specialist if irritation occurs.';

        let finalAdvice = geminiResult.advice;
        // const simpleGreetings = ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening", "thanks", "thank you"];
        // const isSimpleConversationTurn = simpleGreetings.some(phrase => trimmedQuery.toLowerCase().includes(phrase)) && trimmedQuery.split(' ').length <= 3;

        if (geminiResult.is_product_query === true) {
            // Only append default instructions and search note if it's a product query
            finalAdvice = `${geminiResult.advice || ''}\n\n${defaultUsageInstructions}${searchNote}`;
        } else {
            // For all non-product queries (greetings, thanks, general chat), use only AI's direct advice
            finalAdvice = geminiResult.advice;
        }

        const finalResponse: ChatApiResponse = {
            ai_understanding: geminiResult.ai_understanding,
            product_card: finalProductCards.length === 1 ? finalProductCards[0] : undefined,
            advice: finalAdvice.trim(), // Ensure advice is trimmed
            complementary_products: finalProductCards.length > 1 ? finalProductCards : undefined,
            history: history, // Include the updated history in the response
        };

        // Update history with new interaction
        history.push({ role: 'user', text: trimmedQuery });
        history.push({ role: 'bot', text: finalResponse.advice });

        // Limit history length
        const maxHistory = parseInt(process.env.MAX_CHAT_HISTORY || '10', 10);
        if (history.length > maxHistory) {
            history = history.slice(-maxHistory);
        }

        // Store updated history
        // userId is already defined from earlier
        await setEphemeralUserChatHistory(userId, history); // Uses default 24h TTL
        chatHistoryCache.set(userId, history);
        console.log('Chat history stored via setEphemeralUserChatHistory and in-memory cache.');

        console.log('Sending final response:', JSON.stringify(finalResponse, null, 2));
        return NextResponse.json(finalResponse);
    } catch (error) {
        console.error('Chat API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorResponse: ChatApiResponse = {
            ai_understanding: 'An error occurred.',
            advice: `Sorry, I encountered a problem processing your request. (Ref: ${errorMessage.substring(0, 100)})`,
            history: [],
        };
        console.log('Sending error response:', JSON.stringify(errorResponse, null, 2));
        return NextResponse.json(errorResponse, { status: 500 });
    }
}
