// D:\PB_NEW5\dist_sim\scripts\testEnv.cjs
const { config } = require('dotenv');
const path = require('path');

config({ path: path.resolve(__dirname, '.env') });

console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY);
console.log('UPSTASH_VECTOR_REST_URL:', process.env.UPSTASH_VECTOR_REST_URL);
console.log('UPSTASH_VECTOR_REST_TOKEN:', process.env.UPSTASH_VECTOR_REST_TOKEN);