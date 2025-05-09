// __mocks__/next/server.js

// Mock class/constructor for NextResponse
const NextResponse = jest.fn(function(body, init) {
  this.body = body; // Store the raw body
  this.status = init && init.status !== undefined ? init.status : 200;
  this.headers = init && init.headers ? init.headers : new Map(); // Or a simple object
  this.ok = this.status >= 200 && this.status < 300;

  // .json() method on the instance
  this.json = jest.fn(async () => {
    // If the body passed to the constructor was intended to be JSON,
    // and NextResponse.json() was used, it might already be an object.
    // Otherwise, if it's a string, try to parse it.
    if (typeof this.body === 'string') {
      try {
        return JSON.parse(this.body);
      } catch (e) {
        // If not a JSON string, return as is or handle error
        return this.body;
      }
    }
    return this.body; // If body is already an object (e.g., from NextResponse.json)
  });

  // The constructor in JS implicitly returns `this` if not returning another object.
  // This ensures `new NextResponse()` produces an object that is an "instance" of this mock.
});

// Static method mock for NextResponse.json()
NextResponse.json = jest.fn((body, init = {}) => {
  // Create an instance using the mocked constructor.
  // Pass the body as is; the instance's .json() method will handle it.
  // However, for NextResponse.json(), the body is the actual JSON payload.
  const instance = new NextResponse(body, init); // Pass body directly

  // For instances specifically created by NextResponse.json,
  // the .json() method should resolve to the `body` argument directly.
  instance.json = jest.fn(async () => body);

  return instance;
});

module.exports = {
  NextResponse,
  // Add other exports from next/server if needed by other tests
};
