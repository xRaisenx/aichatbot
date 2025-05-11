require('dotenv').config();

// jest.config.cjs
const config = {
  testEnvironment: 'node', // Changed to 'node' for backend tests primarily
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  // 'transform' and 'extensionsToTreatAsEsm' will be set by the preset
  preset: 'ts-jest/presets/default-esm',
  transformIgnorePatterns: [
    // Default from ts-jest/presets/default-esm is '/node_modules/', 
    // but we might need to allow transforming some ESM deps.
    // Added ioredis-mock as it's used in manual mocks and might need transformation.
    '/node_modules/(?!(@upstash/vector|@upstash/redis|@upstash/ratelimit|@google/generative-ai|next|ioredis-mock|node-fetch)/)', 
  ],
  moduleNameMapper: {
    '^@lib/(.*)$': '<rootDir>/lib/$1',
    '^app/(.*)$': '<rootDir>/app/$1',
    // Force Jest to use our manual mock for next/server
    '^next/server$': '<rootDir>/__mocks__/next/server.ts',
    // ts-jest ESM preset might require mapping for .js extensions if importing .ts from .js
    // For example, if a .js file tries to import a .ts file as './foo.js', this helps resolve it.
    // '^(\\.{1,2}/.*)\\.js$': '$1', // This line is often needed with ESM presets.
  },
};

module.exports = config;
