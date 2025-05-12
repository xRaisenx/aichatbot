import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import pino from 'pino';
import type { GenerateSuggestedQuestionsRequest, ChatMessage } from '@/lib/types'; // Added import

const logger = pino();

<<<<<<< HEAD
const MODEL_NAME = "gemini-1.5-flash";
=======
const MODEL_NAME = "gemini-1.5-flash"; // Reverted to known valid model
>>>>>>> 64a827b9f867e23e5563b1f13d65920ff791ff11
const API_KEY = process.env.GEMINI_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

const generationConfig = {
<<<<<<< HEAD
  temperature: 0.9,
=======
  temperature: 0.9, // Adjusted for high creativity within valid range
>>>>>>> 64a827b9f867e23e5563b1f13d65920ff791ff11
  topK: 1,
  topP: 0.80, // User's requested topP
  maxOutputTokens: 2048,
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

function formatConversationHistory(history: ChatMessage[]): string {
  return history.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content || msg.text}`).join('\n');
}

function getInitialQuestionsPrompt(): string {
  return `
    You are an AI assistant for a beauty products e-commerce site called Planet Beauty.
    Your task is to generate exactly 4 diverse and engaging sample questions that a new user might ask.
    These questions should cover a range of common user intents, such as:
    - Seeking product recommendations for specific skin types or concerns (e.g., "best moisturizer for dry skin", "products for acne").
    - Asking about product attributes (e.g., "vegan lipsticks", "sulfate-free shampoo").
    - Inquiring about product categories or sets (e.g., "skincare sets", "organic hair care").
    - Requesting general beauty advice or tips.
    - Price-related queries (e.g., "lipsticks under $20").

    Please ensure the questions are concise, user-friendly, and sound natural.
    Return ONLY a valid JSON array of 4 strings, where each string is a question.
    Example format:
    ["What's a good serum for anti-aging?", "Show me cruelty-free foundations.", "Any recommendations for oily skin cleansers?", "What are popular gift sets?"]
  `;
}

function getContextualQuestionsPrompt(conversationHistoryText: string): string {
  return `
    You are an AI assistant for a beauty products e-commerce site called Planet Beauty.
    Analyze the following recent conversation history:
    --- START OF CONVERSATION HISTORY ---
    ${conversationHistoryText}
    --- END OF CONVERSATION HISTORY ---

    Based on this conversation, generate exactly 3 distinct, relevant, and concise follow-up questions that the user might ask next to continue the conversation productively or explore related topics.
    The questions should be natural and encourage further interaction.
    Avoid questions that have already been clearly answered or are too generic if the context is specific.

    Return ONLY a valid JSON array of 3 strings, where each string is a question.
    Example format:
    ["Can you tell me more about its ingredients?", "Are there other shades available?", "What's the return policy for this item?"]
  `;
}

export async function POST(req: NextRequest) {
  logger.info('API endpoint /api/chat/generate-suggested-questions hit (POST)');

  if (!API_KEY) {
    logger.error('GEMINI_API_KEY is not set.');
    return NextResponse.json({ error: 'API key not configured for AI question generation.' }, { status: 500 });
  }

  let requestBody: GenerateSuggestedQuestionsRequest = {};
  try {
    // Check if request body exists before trying to parse it
     if (req.body) {
        const rawBody = await req.text();
        if (rawBody) {
            requestBody = JSON.parse(rawBody);
        }
    }
  } catch (error) {
    logger.warn({ err: error }, 'Could not parse request body for suggested questions, proceeding with defaults.');
    // Default to initial if body is malformed or empty
    requestBody = { type: 'initial' };
  }
  
  const type = requestBody.type || 'initial';
  const conversationHistory = requestBody.conversation_history;

  let prompt: string;
  let expectedQuestionCount: number;
  let fallbackQuestions: string[];

  if (type === 'contextual' && conversationHistory && conversationHistory.length > 0) {
    logger.info({ conversationHistory }, 'Generating contextual suggested questions');
    const historyText = formatConversationHistory(conversationHistory);
    prompt = getContextualQuestionsPrompt(historyText);
    expectedQuestionCount = 3;
    fallbackQuestions = [
      "What other products do you recommend?",
      "Tell me more about the first product.",
      "Are there any special offers currently?"
    ];
  } else {
    logger.info('Generating initial suggested questions');
    prompt = getInitialQuestionsPrompt();
    expectedQuestionCount = 4;
    fallbackQuestions = [
      "What’s the best moisturizer for dry skin?",
      "Can you recommend a sulfate-free shampoo?",
      "Show me vegan lipsticks under $20.",
      "Are there any products for sensitive skin?"
    ];
  }

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    });

    const responseText = result.response.text();
    logger.info({ responseTextFromLLM: responseText, type }, `Raw response from LLM for ${type} suggested questions`);

    let questions: string[] = [];
    try {
      const cleanedText = responseText.replace(/^```json\s*|```\s*$/g, '').trim();
      questions = JSON.parse(cleanedText);
<<<<<<< HEAD
      if (!Array.isArray(questions) || questions.length !== expectedQuestionCount || !questions.every(q => typeof q === 'string')) {
        logger.error({ parsedQuestions: questions, expectedCount: expectedQuestionCount, type }, `LLM response for ${type} suggested questions was not a valid array of ${expectedQuestionCount} strings.`);
        throw new Error(`Invalid format for ${type} suggested questions from LLM.`);
      }
    } catch (parseError) {
      logger.error({ parseError, responseText, type }, `Failed to parse LLM response for ${type} suggested questions into JSON array.`);
      questions = fallbackQuestions; // Use type-specific fallback
=======
      if (!Array.isArray(questions) || questions.length !== 4 || !questions.every(q => typeof q === 'string')) { // Check for 4 questions
        logger.error({ parsedQuestions: questions }, "LLM response for suggested questions was not a valid array of 4 strings.");
        throw new Error("Invalid format for suggested questions from LLM.");
      }
    } catch (parseError) {
      logger.error({ parseError, responseText }, "Failed to parse LLM response for suggested questions into JSON array.");
      // Fallback if parsing fails or format is incorrect - 4 questions
      questions = [
        "What’s the best moisturizer for dry skin?",
        "Can you recommend a sulfate-free shampoo?",
        "Show me vegan lipsticks under $20.",
        "Are there any products for sensitive skin?"
      ];
>>>>>>> 64a827b9f867e23e5563b1f13d65920ff791ff11
    }
    
    return NextResponse.json({ questions });

  } catch (error) {
<<<<<<< HEAD
    logger.error({ err: error, type }, `Error generating ${type} suggested questions from LLM`);
    return NextResponse.json({ questions: fallbackQuestions, error: `Failed to generate ${type} questions dynamically, serving fallback.` }, { status: 500 });
=======
    logger.error({ err: error }, 'Error generating suggested questions from LLM');
    // Fallback to a static list in case of any error - 4 questions
    const fallbackQuestions = [
        "What are some popular eyeshadow palettes?",
        "Any tips for beginners on skincare routines?",
        "Find me a good gift for my mom.",
        "What products help with frizzy hair?"
    ];
    return NextResponse.json({ questions: fallbackQuestions, error: "Failed to generate questions dynamically, serving fallback." }, { status: 500 });
>>>>>>> 64a827b9f867e23e5563b1f13d65920ff791ff11
  }
}
