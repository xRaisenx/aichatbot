import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import pino from 'pino';

const logger = pino();

const MODEL_NAME = "gemini-2.0-flash"; // Or your preferred model
const API_KEY = process.env.GEMINI_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

const generationConfig = {
  temperature: 3, // Slightly higher for more creative/diverse questions
  topK: 1,
  topP: 0.80,
  maxOutputTokens: 2048,
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) { 
  logger.info('API endpoint /api/chat/generate-suggested-questions hit');
  if (!API_KEY) {
    logger.error('GEMINI_API_KEY is not set.');
    return NextResponse.json({ error: 'API key not configured for AI question generation.' }, { status: 500 });
  }

  const prompt = `
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
    ["What's a good serum for anti-aging?", "Show me cruelty-free foundations.", "Any recommendations for oily skin cleansers?", "What are popular gift sets?", "Find hydrating face masks under $50."]
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    });

    const responseText = result.response.text();
    logger.info({ responseTextFromLLM: responseText }, "Raw response from LLM for suggested questions");

    // Attempt to parse the response as a JSON array
    let questions: string[] = [];
    try {
      // Clean the response: remove potential markdown/code block fences
      const cleanedText = responseText.replace(/^```json\s*|```\s*$/g, '').trim();
      questions = JSON.parse(cleanedText);
      if (!Array.isArray(questions) || questions.length !== 5 || !questions.every(q => typeof q === 'string')) {
        logger.error({ parsedQuestions: questions }, "LLM response for suggested questions was not a valid array of 5 strings.");
        throw new Error("Invalid format for suggested questions from LLM.");
      }
    } catch (parseError) {
      logger.error({ parseError, responseText }, "Failed to parse LLM response for suggested questions into JSON array.");
      // Fallback if parsing fails or format is incorrect
      questions = [
        "What’s the best moisturizer for dry skin?",
        "Can you recommend a sulfate-free shampoo?",
        "Show me vegan lipsticks under $20.",
        "Are there any products for sensitive skin?",
        "I need a good anti-aging serum."
      ];
    }
    
    return NextResponse.json({ questions });

  } catch (error) {
    logger.error({ err: error }, 'Error generating suggested questions from LLM');
    // Fallback to a static list in case of any error
    const fallbackQuestions = [
        "What are some popular eyeshadow palettes?",
        "Any tips for beginners on skincare routines?",
        "Find me a good gift for my mom.",
        "What products help with frizzy hair?",
        "Can you suggest a good night cream?"
    ];
    return NextResponse.json({ questions: fallbackQuestions, error: "Failed to generate questions dynamically, serving fallback." }, { status: 500 });
  }
}
