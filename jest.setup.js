const fetch = require('node-fetch');
global.fetch = fetch;
global.Response = fetch.Response;
global.Headers = fetch.Headers;
global.Request = fetch.Request; // Overwrite the existing simple Request mock

// Polyfill for the Request object in Jest environment
// global.Request = class Request { // This is now handled by node-fetch
//   constructor(url) {
//     this.url = url;
//     // Add other properties/methods if needed by tests
//   }
// };
