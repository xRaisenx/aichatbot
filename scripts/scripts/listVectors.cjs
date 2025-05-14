const { Index } = require('@upstash/vector');
const { config } = require('dotenv');
const path = require('path');

config({ path: path.resolve(__dirname, '.env') });

// Debug environment variables
console.log('UPSTASH_VECTOR_REST_URL:', process.env.UPSTASH_VECTOR_REST_URL);
console.log('UPSTASH_VECTOR_REST_TOKEN:', process.env.UPSTASH_VECTOR_REST_TOKEN);

const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

async function listVectors() {
  try {
    const vectors = await vectorIndex.query({ data: 'vegan mascara', topK: 10 });
    console.log('Database vectors:', vectors);
  } catch (error) {
    console.error('Error querying vectors:', error.message);
  }
}

listVectors().catch(console.error);