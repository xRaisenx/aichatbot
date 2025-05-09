import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid'; // For generating unique session IDs

dotenv.config();

const CHAT_API_URL = 'http://localhost:3000/api/chat'; // Adjust if needed

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatResponse = {
  response: string;
  history: ChatMessage[];
  // Add other expected fields if necessary
};

async function runChatSimulation() {
  console.log('Starting chat simulation...');

  const sessionId = uuidv4(); // Generate a unique session ID for this simulation
  let chatHistory: ChatMessage[] = [];

  const messagesToSimulate = [
    "Hi there!",
    "Tell me about popular skincare products.",
    "Which one is good for dry skin?",
    "Thanks!",
  ];

  for (const message of messagesToSimulate) {
    console.log(`\nUser: ${message}`);

    try {
      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: message,
          history: chatHistory,
          sessionId: sessionId, // Include session ID
        }),
      });

      console.log(`Chat API Response Status: ${response.status}`);
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Chat simulation failed with status ${response.status}: ${errorBody}`);
        break; // Stop simulation on error
      }

      // It seems ChatResponse from the simulate-chat.ts is not matching the actual API response.
      // The API returns ChatApiResponse which has `advice` not `response`.
      // For now, let's cast to `any` to avoid type errors during this step,
      // and then log the actual structure to confirm.
      const responseBody = await response.json() as any; 
      // console.log(`Assistant: ${responseBody.response}`); // Original line, likely to fail
      console.log(`Assistant: ${responseBody.advice || responseBody.response}`); // Try advice, fallback to response


      // Update chat history for the next message
      // Ensure the history structure matches what the API sends back.
      // The API sends history as: Array<{ role: 'user' | 'bot' | 'model'; text?: string }>
      // The simulate-chat.ts ChatMessage is: { role: 'user' | 'assistant'; content: string; }
      // This mismatch needs to be addressed if history is to be correctly maintained.
      // For now, let's assume the API's history format is what we should use.
      chatHistory = responseBody.history || [];

      // Optional delay between messages
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error('Error during chat simulation:', error);
      break; // Stop simulation on error
    }
  }

  console.log('\nChat simulation finished.');
}

runChatSimulation();
