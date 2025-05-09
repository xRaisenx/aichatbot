// test/gemini.test.js
import { callGeminiForUnderstanding } from '../lib/gemini';

describe('callGeminiForUnderstanding', () => {
  it('should return a valid GeminiUnderstandingResponse for a valid query', async () => {
    const query = 'I need a product to fix my acne pores';
    const history = [];
    const response = await callGeminiForUnderstanding(query, history);
    expect(response).toBeDefined();
    expect(typeof response.ai_understanding).toBe('string');
    expect(typeof response.advice).toBe('string');
    expect(typeof response.search_keywords).toBe('string');
    expect(typeof response.is_product_query).toBe('boolean');
  });

  it('should return null for an invalid query', async () => {
    const query = '';
    const history = [];
    const response = await callGeminiForUnderstanding(query, history);
    expect(response).toBeNull();
  });
});
