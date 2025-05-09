import { NextResponse } from 'next/server';
import { POST } from '../app/api/chat/route';

// Mock lib/redis
jest.mock("../lib/redis", () => ({
  getEphemeralUserChatHistory: jest.fn().mockResolvedValue(null),
  setEphemeralUserChatHistory: jest.fn().mockResolvedValue(undefined),
  redisClient: {
    connect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    // Add other methods if needed
  },
  vectorIndex: {
    query: jest.fn().mockResolvedValue([]),
  },
  UPSTASH_VECTOR_INDEX_NAME: 'mock_index_name',
}));

// Set environment variables
process.env.UPSTASH_REDIS_REST_URL = 'https://verified-whale-32144.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'AX2QAAIjcDEyNDQxMjMwMTc0MGQ0YjA2YTA1Y2MxNDVmZDMzNTBhYnAxMA';

// Mock Redis
jest.mock("@upstash/redis", () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    evalsha: jest.fn().mockResolvedValue([1, 10, 9]), // Simulate rate-limiting success initially
    pipeline: jest.fn(() => ({
      exec: jest.fn().mockResolvedValue([]),
    })),
  };

  // Ensure Redis.fromEnv() is also mocked
  const RedisMock = jest.fn(() => mockRedis);
  RedisMock.fromEnv = jest.fn(() => mockRedis);

  return {
    Redis: RedisMock,
  };
});

// Mock Ratelimit
jest.mock("@upstash/ratelimit", () => {
  const mockRatelimitInstance = {
    limit: jest.fn(), // We will configure this per test
  };

  const RatelimitMock = jest.fn(() => mockRatelimitInstance);
  // Define slidingWindow as a static method
  RatelimitMock.slidingWindow = jest.fn((limit, timeInterval) => ({
    limit,
    timeInterval,
    // Return a dummy object that matches what the Ratelimit constructor expects for the limiter option
  }));

  return {
    Ratelimit: RatelimitMock,
  };
});

// Mock other dependencies that might be used in the POST handler
jest.mock("@upstash/vector", () => ({
  Index: jest.fn(() => ({
    query: jest.fn().mockResolvedValue([]), // Simulate empty results
  })),
}));

jest.mock("@google/generative-ai", () => {
  // Mock for the embedding model's embedContent method
  const mockEmbedContent = jest.fn().mockResolvedValue({
    embedding: {
      values: Array(768).fill(0.1), // Mocked 768-dimension vector
    },
  });

  // Mock for the chat model's generateContent method
  const mockGenerateContent = jest.fn().mockResolvedValue({
    response: {
      text: () => JSON.stringify({
        ai_understanding: "Mocked user intent understanding.",
        search_keywords: "mocked product keyword",
        advice: "Mocked AI advice.",
        requested_product_count: 1,
        product_types: ["mocked_type"],
        usage_instructions: "Mocked usage instructions.",
        price_filter: null,
        sort_by_price: false,
        vendor: "",
        attributes: ["mocked_attribute"]
      }),
    },
  });

  const mockGetGenerativeModel = jest.fn(({ model }) => { // Destructure 'model' argument
    if (model === "models/embedding-001") {
      return {
        embedContent: mockEmbedContent, // Return object with embedContent for embedding model
      };
    }
    // Default to chat model mock
    return {
      generateContent: mockGenerateContent,
    };
  });

  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: mockGetGenerativeModel,
    })),
    // Mock HarmCategory and HarmBlockThreshold as they are imported by lib/gemini.ts
    HarmCategory: {
      HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
      HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    },
    HarmBlockThreshold: {
      BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
    },
  };
});

describe("Chat API Rate Limiting", () => {
  beforeEach(() => {
    // Clear all mocks before each test, including mockRatelimitInstance.limit
    jest.clearAllMocks();
    
    // Reset call count for ratelimit.limit if it's managed by a closure in the mock (not strictly necessary with mockResolvedValueOnce chain)
    // If the mockRatelimitInstance.limit is redefined per test, this is fine.
  });

  it("should return 429 status code when rate limit is exceeded", async () => {
    const req = {
      ip: "127.0.0.1", // Ensure IP is provided as it's often used as identifier
      headers: {
        get: (headerName) => {
          if (headerName === "x-user-id") return "test-user-exceed";
          if (headerName === "x-forwarded-for") return "127.0.0.1"; // Common header for IP
          return null;
        },
      },
      json: async () => ({
        query: "test query",
        history: [],
      }),
    };

    // Get the mock instance and configure its limit method for this test
    const { Ratelimit } = require('@upstash/ratelimit');
    const ratelimitInstance = Ratelimit(); // This gets the singleton mockRatelimitInstance

    // Configure limit to succeed a few times then fail
    // Simulate 10 allowed requests
    for (let i = 0; i < 10; i++) {
        ratelimitInstance.limit.mockResolvedValueOnce({ success: true, limit: 10, remaining: 10 - (i + 1), reset: Date.now() + 10000 });
    }
    // Subsequent calls will fail
    ratelimitInstance.limit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: Date.now() + 10000 });
    
    let response;
    let exceeded = false;
    // Call 11 times to ensure the 11th call (and subsequent) exceeds the limit
    for (let i = 0; i < 11; i++) { 
      response = await POST(req);
      if (response instanceof NextResponse && response.status === 429) {
        exceeded = true;
        break;
      }
    }

    expect(exceeded).toBe(true);
    // Ensure limit was called enough times
    expect(ratelimitInstance.limit).toHaveBeenCalledTimes(11); 
  });

  it("should return 200 status code when rate limit is not exceeded", async () => {
    const req = {
      ip: "127.0.0.2", // Different IP for different user/test case
      headers: {
        get: (headerName) => {
          if (headerName === "x-user-id") return "test-user-success";
          if (headerName === "x-forwarded-for") return "127.0.0.2";
          return null;
        },
      },
      json: async () => ({
        query: "test query",
        history: [],
      }),
    };

    const { Ratelimit } = require('@upstash/ratelimit');
    const ratelimitInstance = Ratelimit();
    ratelimitInstance.limit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: Date.now() + 10000 });

    const response = await POST(req);
    
    // Check if the response is an error before asserting status 200
    if (response instanceof NextResponse) {
        expect(response.status).toBe(200);
    } else {
        // If POST returns something else (e.g. direct JSON on error not caught as NextResponse)
        // this will fail, indicating an issue in POST or the mock.
        // For now, assume POST always returns NextResponse or throws.
        const body = await response.json(); // Assuming it's a Response object
        expect(body.message).toBe("Mocked AI response"); 
    }
    expect(ratelimitInstance.limit).toHaveBeenCalledTimes(1);
  });
});
