const fetch = require('node-fetch');
global.fetch = fetch;
global.Response = fetch.Response;
global.Headers = fetch.Headers;
global.Request = fetch.Request; // Overwrite the existing simple Request mock

// Set dummy env vars for tests with valid URL formats
process.env.UPSTASH_VECTOR_REST_URL = 'https://dummy-vector-url.example.com';
process.env.UPSTASH_VECTOR_TOKEN = 'dummy-vector-token-setup';
process.env.GEMINI_API_KEY = 'dummy-gemini-key-setup';
process.env.UPSTASH_REDIS_REST_URL = 'https://dummy-redis-url.example.com';
process.env.UPSTASH_REDIS_REST_TOKEN = 'dummy-redis-token-setup';
process.env.MAX_CHAT_HISTORY = '10';
process.env.SHOPIFY_STORE_NAME = 'josedevai.myshopify.com';
process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'dummy-admin-token-setup';
// Add any other environment variables required by the application during tests

// Polyfill for the Request object in Jest environment
// global.Request = class Request { // This is now handled by node-fetch
//   constructor(url) {
//     this.url = url;
//     // Add other properties/methods if needed by tests
//   }
// };
