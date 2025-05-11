// simulate-chat.ts
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const CHAT_API_URL = 'http://localhost:3000/api/chat';

type ChatHistoryItem = {
  role: 'user' | 'bot' | 'model' | 'assistant' | 'system';
  text?: string;
  content?: string;
};

interface ProductCard {
  title: string;
  description: string;
  price: string | number; // Price is now number (USD)
  image: string | null;
  landing_page: string;
  variantId: string;
}

interface ApiChatResponse {
  ai_understanding: string;
  product_card?: ProductCard;
  advice: string;
  product_comparison?: ProductCard[];
  complementary_products?: ProductCard[];
  history: ChatHistoryItem[];
}

interface SimulationTestCase {
  description: string;
  query: string;
  expected_ai_understanding_keywords?: string[];
  expected_advice_keywords?: string[];
  expected_product_card_present?: boolean;
  expected_complementary_products_count?: number;
  expected_product_card_properties?: {
    title_contains?: string[];
    max_price?: number; // Max price in USD
    vendor_name_includes?: string;
  };
  expected_no_products?: boolean;
  is_greeting?: boolean;
}

const testCases: SimulationTestCase[] = [
  {
    description: "Greeting: Simple 'Hi'",
    query: "Hi",
    is_greeting: true,
    expected_ai_understanding_keywords: ["greeting"],
    expected_advice_keywords: ["how can i assist"],
    expected_no_products: true,
  },
  {
    description: "Greeting: 'Thanks'",
    query: "Thanks",
    is_greeting: true,
    expected_ai_understanding_keywords: ["greeting"],
    expected_advice_keywords: ["you're welcome"],
    expected_no_products: true,
  },
  {
    description: "General Question: 'What is skincare?'",
    query: "What is skincare?",
    expected_ai_understanding_keywords: ["general question", "skincare"],
    expected_advice_keywords: ["cleansing", "treating", "moisturizing", "health", "appearance"],
    expected_no_products: true,
  },
  {
    description: "Product Search: 'Find me a vegan lipstick'",
    query: "Find me a vegan lipstick",
    expected_ai_understanding_keywords: ["product query", "vegan", "lipstick"],
    expected_advice_keywords: ["vegan lipstick", "options"],
    expected_product_card_present: true,
    expected_complementary_products_count: 0,
    expected_product_card_properties: {
      title_contains: ["lipstick"],
    },
  },
  {
    description: "Product Search with Attribute: 'serum for dry skin'",
    query: "serum for dry skin",
    expected_ai_understanding_keywords: ["product query", "serum", "dry skin"],
    expected_advice_keywords: ["serum", "dry skin"],
    expected_product_card_present: true,
    expected_product_card_properties: {
      title_contains: ["serum"],
    },
  },
  {
    description: "Product Search - Multiple Types: 'cleanser and moisturizer'",
    query: "I need a cleanser and moisturizer",
    expected_ai_understanding_keywords: ["product query", "cleanser", "moisturizer"],
    expected_advice_keywords: ["cleanser", "moisturizer"],
    expected_product_card_present: false,
    expected_complementary_products_count: 2,
  },
  {
    description: "No Results Scenario (Specific Item): 'Find unobtainium face cream'",
    query: "Find unobtainium face cream",
    expected_ai_understanding_keywords: ["query for fictional product"],
    expected_advice_keywords: ["fictional material", "can't find", "hydration"],
    expected_product_card_present: false,
    expected_no_products: true,
  },
  {
    description: "Product Search with Price Filter: 'cheap sunscreen under $30'",
    query: "cheap sunscreen under $30",
    expected_ai_understanding_keywords: ["product query", "sunscreen", "cheap", "price filter"],
    expected_advice_keywords: ["sunscreen", "under", "usd"],
    expected_product_card_present: true,
    expected_product_card_properties: {
      title_contains: ["sunscreen"],
      max_price: 30,
    },
    expected_no_products: false,
  },
  {
    description: "Product Search with Vendor: 'Planet Beauty brand moisturizer'",
    query: "Planet Beauty brand moisturizer",
    expected_ai_understanding_keywords: ["product query", "moisturizer", "Planet Beauty"],
    expected_advice_keywords: ["Planet Beauty", "moisturizer"],
    expected_product_card_present: true,
    expected_product_card_properties: {
      title_contains: ["moisturizer"],
      vendor_name_includes: "Planet Beauty", // Test will check if title contains "Planet Beauty"
    },
    expected_no_products: false,
  },
  {
    description: "Invalid/Edge Case Input: 'asdfjkl;'",
    query: "asdfjkl;",
    expected_ai_understanding_keywords: ["Unable to understand", "query"], // Updated to match route.ts
    expected_advice_keywords: ["sorry", "didn't understand", "rephrase", "more details"], // Updated
    expected_no_products: true,
    expected_product_card_present: false,
  },
  {
    description: "Fallback Logic - General Skincare: 'Any good eye creams for dark circles?'",
    query: "Any good eye creams for dark circles?",
    expected_ai_understanding_keywords: ["product query", "eye cream", "dark circles"],
    expected_advice_keywords: ["eye creams", "dark circles"],
    expected_product_card_present: true, // Expecting a single card now
    expected_product_card_properties: {
      title_contains: ["eye cream", "eye"], // Keywords to find in title
    },
  },
  {
    description: "Product Search: Complex with multiple attributes and price filter",
    query: "I'm looking for a vegan and cruelty-free serum, preferably under $100.",
    expected_ai_understanding_keywords: ["product query", "vegan", "cruelty-free", "serum", "price filter"],
    expected_advice_keywords: ["vegan", "cruelty-free", "serum", "usd"],
    expected_product_card_present: true, // Expecting a single card
    expected_product_card_properties: {
      title_contains: ["serum"],
      max_price: 100,
    },
    expected_no_products: false,
  },
  {
    description: "Product Search: 'Skincare set for dry skin'",
    query: "I need a skincare set for dry skin",
    expected_ai_understanding_keywords: ["product query", "set", "dry skin"],
    expected_advice_keywords: ["skincare set", "dry skin"],
    expected_product_card_present: false,
    expected_complementary_products_count: 3, // Sticking to 3 as per prompt
  },
  {
    description: "Memory Query: 'What were we talking about?'",
    query: "What were we talking about?",
    expected_ai_understanding_keywords: ["memory query"],
    expected_advice_keywords: ["skincare set", "dry skin"], // Example, will depend on actual history
    expected_no_products: true,
  },
  {
    description: "Follow-up Clarification: 'Is that moisturizer part of a kit?'",
    query: "Is that moisturizer part of a kit?",
    expected_ai_understanding_keywords: ["follow-up clarification"],
    expected_advice_keywords: ["moisturizer", "kit", "set"],
    expected_no_products: true,
  },
  {
    description: "General Question: 'What's your name?'",
    query: "What's your name?",
    expected_ai_understanding_keywords: ["general question", "chatbot"],
    expected_advice_keywords: ["planet beauty", "ai shopping assistant"],
    expected_no_products: true,
  },
  {
    description: "Product Search - Combo with specific types: 'I want a combo with cleanser and toner for oily skin'",
    query: "I want a combo with cleanser and toner for oily skin",
    expected_ai_understanding_keywords: ["product query", "combo", "cleanser", "toner", "oily skin"],
    expected_advice_keywords: ["combo", "cleanser", "toner", "oily skin"],
    expected_product_card_present: false,
    expected_complementary_products_count: 2,
  }
];

function parsePriceFromString(priceStr: string | number): number {
  if (typeof priceStr === 'number') return priceStr;
  if (!priceStr) return NaN;
  // This regex handles cases like "$25.99" or "25.99 USD"
  const match = String(priceStr).match(/[\d.]+/);
  if (match && match[0]) {
    return parseFloat(match[0]);
  }
  return NaN;
}


function evaluateResponse(
  responseBody: ApiChatResponse,
  testCase: SimulationTestCase
): { success: boolean; details: string[] } {
  const evaluationDetails: string[] = [];
  let overallSuccess = true;

  if (testCase.expected_ai_understanding_keywords) {
    const understandingLower = responseBody.ai_understanding.toLowerCase();
    for (const keyword of testCase.expected_ai_understanding_keywords) {
      if (!understandingLower.includes(keyword.toLowerCase())) {
        evaluationDetails.push(`FAIL: ai_understanding missing keyword '${keyword}'. Got: "${responseBody.ai_understanding}"`);
        overallSuccess = false;
      } else {
        evaluationDetails.push(`PASS: ai_understanding contains keyword '${keyword}'.`);
      }
    }
  }

  if (testCase.expected_advice_keywords) {
    const adviceLower = responseBody.advice.toLowerCase();
    for (const keyword of testCase.expected_advice_keywords) {
      if (!adviceLower.includes(keyword.toLowerCase())) {
        evaluationDetails.push(`FAIL: advice missing keyword '${keyword}'. Got: "${responseBody.advice.substring(0, 100)}..."`);
        overallSuccess = false;
      } else {
        evaluationDetails.push(`PASS: advice contains keyword '${keyword}'.`);
      }
    }
  }

  const productCardPresent = !!responseBody.product_card;
  const complementaryProductsCount = responseBody.complementary_products?.length || 0;

  if (testCase.expected_product_card_present !== undefined) {
    if (productCardPresent !== testCase.expected_product_card_present) {
      evaluationDetails.push(`FAIL: product_card presence. Expected: ${testCase.expected_product_card_present}, Got: ${productCardPresent}`);
      overallSuccess = false;
    } else {
      evaluationDetails.push(`PASS: product_card presence matched expectation (${productCardPresent}).`);
    }
  }

  if (testCase.expected_complementary_products_count !== undefined) {
    if (complementaryProductsCount !== testCase.expected_complementary_products_count) {
      evaluationDetails.push(`FAIL: complementary_products count. Expected: ${testCase.expected_complementary_products_count}, Got: ${complementaryProductsCount}`);
      overallSuccess = false;
    } else {
      evaluationDetails.push(`PASS: complementary_products count matched expectation (${complementaryProductsCount}).`);
    }
  }

  if (testCase.expected_no_products) {
    if (productCardPresent || complementaryProductsCount > 0) {
      evaluationDetails.push(`FAIL: Expected no products, but found product_card present: ${productCardPresent} and/or complementary_products count: ${complementaryProductsCount}.`);
      overallSuccess = false;
    } else {
      evaluationDetails.push(`PASS: Correctly found no products as expected.`);
    }
  }

  if (testCase.is_greeting) {
    if (productCardPresent || complementaryProductsCount > 0) {
      evaluationDetails.push(`FAIL: Greeting scenario returned products. product_card: ${productCardPresent}, complementary_products: ${complementaryProductsCount}`);
      overallSuccess = false;
    }
    if (responseBody.ai_understanding.toLowerCase().includes("product query")) {
        evaluationDetails.push(`FAIL: Greeting identified as "product query" in ai_understanding. Got: "${responseBody.ai_understanding}"`);
        overallSuccess = false;
    }
  }

  if (testCase.expected_product_card_properties && responseBody.product_card) {
    const card = responseBody.product_card;
    const props = testCase.expected_product_card_properties;

    if (props.title_contains) {
      const titleLower = card.title.toLowerCase();
      let foundAllTitleKeywords = true;
      for (const keyword of props.title_contains) {
        if (!titleLower.includes(keyword.toLowerCase())) {
          evaluationDetails.push(`FAIL: product_card.title missing keyword '${keyword}'. Got: "${card.title}"`);
          overallSuccess = false;
          foundAllTitleKeywords = false;
        }
      }
      if (foundAllTitleKeywords) {
        evaluationDetails.push(`PASS: product_card.title contains expected keywords: "${props.title_contains.join(', ')}".`);
      }
    }

    if (props.max_price !== undefined) {
      const priceNum = parsePriceFromString(card.price); // Price is now number (USD)
      if (isNaN(priceNum) || priceNum > props.max_price) {
        evaluationDetails.push(`FAIL: product_card.price (${priceNum}) > ${props.max_price} USD. Got: "${card.price}"`);
        overallSuccess = false;
      } else {
        evaluationDetails.push(`PASS: product_card.price (${priceNum}) is <= ${props.max_price} USD.`);
      }
    }

    if (props.vendor_name_includes) {
      // Assuming vendor name might be in the title if not a separate field in ProductCard
      const titleLower = card.title.toLowerCase();
      if (!titleLower.includes(props.vendor_name_includes.toLowerCase())) {
        evaluationDetails.push(`FAIL: product_card.title does not include vendor '${props.vendor_name_includes}'. Got: "${card.title}"`);
        overallSuccess = false;
      } else {
        evaluationDetails.push(`PASS: product_card.title includes vendor '${props.vendor_name_includes}'.`);
      }
    }
  } else if (testCase.expected_product_card_properties && !responseBody.product_card && testCase.expected_product_card_present) {
    evaluationDetails.push(`FAIL: Expected product_card properties but no product_card was present.`);
    overallSuccess = false;
  }

  if (evaluationDetails.length === 0) {
    evaluationDetails.push("No specific checks ran for this test case based on its definition.");
  }
  if (overallSuccess && !evaluationDetails.some(d => d.startsWith("FAIL:"))) {
    evaluationDetails.push("Overall PASS for implemented checks.");
  }

  return { success: overallSuccess, details: evaluationDetails };
}

async function runChatSimulation() {
  console.log('Starting chat simulation with enhanced evaluation...\n');

  const sessionId = uuidv4();
  let chatHistory: ChatHistoryItem[] = [];

  for (const testCase of testCases) {
    console.log(`\n--- Test Case: ${testCase.description} ---`);
    console.log(`User Query: ${testCase.query}`);

    try {
      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': sessionId,
        },
        body: JSON.stringify({
          query: testCase.query,
          history: chatHistory,
        }),
      });

      console.log(`Chat API Response Status: ${response.status}`);
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Chat simulation failed for "${testCase.description}" with status ${response.status}: ${errorBody.substring(0, 500)}`);
        chatHistory.push({ role: 'user', content: testCase.query });
        chatHistory.push({ role: 'assistant', content: `API Error: ${response.status} - ${errorBody.substring(0,100)}`});
        continue;
      }

      const responseBody = await response.json() as ApiChatResponse;

      console.log(`AI Understanding: ${responseBody.ai_understanding}`);
      console.log(`Advice: ${responseBody.advice.substring(0, 200)}${responseBody.advice.length > 200 ? '...' : ''}`);
      if (responseBody.product_card) {
        console.log(`Product Card: ${responseBody.product_card.title} - ${responseBody.product_card.price}`);
      }
      if (responseBody.complementary_products && responseBody.complementary_products.length > 0) {
        console.log(`Complementary Products: ${responseBody.complementary_products.length} items`);
        responseBody.complementary_products.slice(0, 2).forEach(p => console.log(`  - ${p.title}`));
      }

      const evaluationResult = evaluateResponse(responseBody, testCase);
      console.log(`Evaluation: ${evaluationResult.success ? 'PASS' : 'FAIL'}`);
      evaluationResult.details.forEach(detail => console.log(`  - ${detail}`));

      // Update history from the actual API response
      chatHistory = responseBody.history ? responseBody.history.map(item => ({
        role: item.role,
        // Ensure content is always a string, even if API returns undefined/null for text/content
        content: item.content || item.text || "" 
      })) : [];


      await new Promise(resolve => setTimeout(resolve, 300)); // Delay between API calls

    } catch (error) {
      console.error(`Error during chat simulation for "${testCase.description}":`, error);
      chatHistory.push({ role: 'user', content: testCase.query });
      chatHistory.push({ role: 'assistant', content: `Simulation Script Error: ${String(error).substring(0,100)}`});
      continue;
    }
  }

  console.log('\nChat simulation finished.');
}

runChatSimulation();
