// lib/llm.ts
import { ChatHistory } from './types'; // Import from new types file

// Hypothetical xAI Gemini API client (replace with actual implementation if using a specific SDK)
// This is a simplified example. A real SDK would handle retries, streaming, etc.
class HypotheticalLLMAPIClient {
  private apiKey: string;

  constructor({ apiKey }: { apiKey: string }) {
    this.apiKey = apiKey;
  }

  async chat({ model, messages, response_format }: { model: string; messages: Array<{role: string, content: string}>; response_format: { type: string } }) {
    // This is a placeholder URL and request structure.
    // Replace with the actual API endpoint and request format for your chosen LLM.
    const response = await fetch('https://api.example-llm.com/v1/chat/completions', { // Placeholder URL
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        response_format: response_format, // Or 'tool_calls' or other specific format
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`LLM API request failed with status ${response.status}: ${errorBody}`);
      throw new Error(`LLM API request failed with status ${response.status}`);
    }
    return response.json();
  }
}

/**
 * Generates a response from the LLM based on the prompt, chat history, and user query.
 * @param systemPrompt The system prompt defining the AI's role and task.
 * @param chatHistory The existing chat history.
 * @param userQuery The latest user query.
 * @returns A stringified JSON object representing the LLM's structured response.
 */
export async function generateLLMResponse(
  systemPrompt: string,
  chatHistory: ChatHistory,
  userQuery: string
): Promise<string> {
  if (!process.env.XAI_API_KEY && !process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) { // Check for common API key names
    console.error('No LLM API key found in environment variables (e.g., XAI_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY). LLM calls will fail.');
    return JSON.stringify({
      is_product_query: false,
      advice: 'AI assistant is currently unavailable due to a configuration issue (missing API key).',
      ai_understanding: 'error - missing LLM API key',
      search_keywords: '',
      product_types: [],
      requested_product_count: 0,
      usage_instructions: '',
      price_filter: null,
      sort_by_price: false,
      vendor: '',
      attributes: [],
    });
  }
  // Use a generic API key name or prioritize one if multiple are set.
  const apiKey = process.env.XAI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  const client = new HypotheticalLLMAPIClient({ apiKey: apiKey! });

  const messagesForLLM = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map(msg => ({
      role: msg.role === 'bot' || msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.text || msg.content || '',
    })),
    { role: 'user', content: userQuery },
  ];

  try {
    // Replace 'Hypothetical-Model-Name' with the actual model you intend to use.
    const llmApiResponse = await client.chat({
      model: 'Hypothetical-Model-Name', 
      messages: messagesForLLM,
      response_format: { type: 'json_object' },
    });

    // Adapt this part based on the actual structure of the LLM API response
    if (llmApiResponse.choices && llmApiResponse.choices[0] && llmApiResponse.choices[0].message && llmApiResponse.choices[0].message.content) {
      // Assuming the content is already a stringified JSON or the LLM guarantees JSON string output
      // If the LLM returns a JSON object directly, you might not need to parse it here,
      // but ensure the function's return type (Promise<string>) is honored.
      let content = llmApiResponse.choices[0].message.content;
      if (typeof content === 'object') {
        content = JSON.stringify(content); // Ensure it's a string if the API returns an object
      }
      // Validate if it's a valid JSON string before returning
      try {
        JSON.parse(content);
        return content;
      } catch (e) {
        console.error('LLM response content is not valid JSON:', content, e);
        throw new Error('LLM response content is not valid JSON.');
      }
    } else {
      console.error('Unexpected LLM API response structure:', llmApiResponse);
      throw new Error('Invalid LLM API response structure');
    }
  } catch (error) {
    console.error('Error calling LLM API:', error);
    return JSON.stringify({
      is_product_query: false,
      advice: 'Sorry, I encountered an issue while trying to understand your request. Please try again.',
      ai_understanding: 'error - LLM API call failed',
      search_keywords: '',
      product_types: [],
      requested_product_count: 0,
      usage_instructions: '',
      price_filter: null,
      sort_by_price: false,
      vendor: '',
      attributes: [],
    });
  }
}
