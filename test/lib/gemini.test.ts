import { describe, it, expect, beforeAll } from '@jest/globals';
import { 
  callGeminiForUnderstanding, 
  generateEmbeddings,
  type GeminiUnderstandingResponse 
} from '../../lib/gemini';

let runIntegrationTests = true;

beforeAll(() => {
  if (!process.env.GEMINI_API_KEY) {
    runIntegrationTests = false;
    console.warn('GEMINI_API_KEY not set. Skipping Gemini integration tests.');
  }
});

const conditionalDescribe = runIntegrationTests ? describe : describe.skip;

conditionalDescribe('lib/gemini.ts (Integration Tests)', () => {
  // jest.setTimeout(15000); // Uncomment if tests time out

  describe('callGeminiForUnderstanding', () => {
    it('should handle a non-product related query', async () => {
      const query = "What are your store hours?";
      const history: any[] = [];
      const result = await callGeminiForUnderstanding(query, history);

      expect(result).not.toBeNull();
      if (result) {
        expect(typeof result.ai_understanding).toBe('string');
        expect(result.ai_understanding.length).toBeGreaterThan(0);
        expect(typeof result.advice).toBe('string');
        expect(result.advice.length).toBeGreaterThan(0);
        expect(typeof result.search_keywords).toBe('string');
        expect(result.is_product_query).toBe(false);
      }
    }, 15000);

    it('should handle a product related query', async () => {
      const query = "I need a good moisturizer for dry skin.";
      const history: any[] = [];
      const result = await callGeminiForUnderstanding(query, history);

      expect(result).not.toBeNull();
      if (result) {
        expect(typeof result.ai_understanding).toBe('string');
        expect(result.ai_understanding.length).toBeGreaterThan(0);
        expect(typeof result.advice).toBe('string');
        expect(result.advice.length).toBeGreaterThan(0);
        expect(typeof result.search_keywords).toBe('string');
        expect(result.search_keywords.length).toBeGreaterThan(0);
        expect(result.is_product_query).toBe(true);
      }
    }, 15000);

    it('should return null for an empty query string', async () => {
      const query = "";
      const history: any[] = [];
      const result = await callGeminiForUnderstanding(query, history);
      expect(result).toBeNull();
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for a given text', async () => {
      const text = "Hello, world!";
      const result = await generateEmbeddings(text);

      expect(result).not.toBeNull();
      if (result) {
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(768);
        result.forEach(value => expect(typeof value).toBe('number'));
      }
    }, 10000);

    it('should return null for an empty text string', async () => {
      const text = "";
      const result = await generateEmbeddings(text);
      expect(result).toBeNull();
    });
  });
});

// If integration tests are skipped, add a placeholder test to satisfy Jest
if (!runIntegrationTests) {
  describe('lib/gemini.ts (Skipped)', () => {
    it('skips integration tests because GEMINI_API_KEY is not set', () => {
      expect(true).toBe(true);
    });
  });
}
