const { GoogleGenerativeAI } = require('@google/generative-ai');
const { config } = require('dotenv');
const { writeFile } = require('fs/promises');
const path = require('path');

config({ path: path.resolve(__dirname, '.env') });

const configData = { true_gemini: true };

// Debug environment variable
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY || 'Not set (using fallback)');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'fallback-key');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const queries = [
  'List vegan and cruelty-free mascaras available at Sephora with their key features.',
  'What are the best vegan and cruelty-free mascaras for volume and length?',
  'Provide customer reviews for vegan and cruelty-free mascaras sold online.',
];

async function generateMascaraData() {
  if (!configData.true_gemini) {
    console.log('Gemini disabled in config');
    return;
  }

  const trainingData = [];

  for (const query of queries) {
    try {
      const result = await model.generateContent(query);
      const response = await result.response.text();
      trainingData.push({ query, response });
    } catch (error) {
      console.warn(`Failed to generate response for query "${query}":`, error.message);
      trainingData.push({ query, response: 'Fallback: Check Sephora for vegan mascaras.' });
    }
  }

  await writeFile(path.join(__dirname, 'mascara_data.json'), JSON.stringify(trainingData, null, 2));
  console.log('Mascara data saved to mascara_data.json');
}

generateMascaraData().catch(console.error);