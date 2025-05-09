// lib/redis.ts

import { Index } from '@upstash/vector';
import { createClient } from 'redis';

type ChatMessage = {
  role: 'user' | 'bot' | 'model';
  text?: string;
};

type ChatHistory = ChatMessage[];


export const UPSTASH_VECTOR_INDEX_NAME = 'idx:products_vss';

if (!process.env.VECTOR_URL_BM25 || !process.env.VECTOR_TOKEN_BM25) {
  throw new Error('Missing Upstash Vector BM25 credentials. Set VECTOR_URL_BM25 and VECTOR_TOKEN_BM25 in .env.local.');
}

export const vectorIndex = new Index({
  url: process.env.VECTOR_URL_BM25,
  token: process.env.VECTOR_TOKEN_BM25,
});


export const redisClient = createClient({
  url: process.env.AICHATBOTZ_KV_URL,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect().catch((err) => console.error('Redis Connect Error:', err));

const CHAT_HISTORY_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Sets the ephemeral chat history for a user in Redis with a TTL.
 * @param userId - The ID of the user.
 * @param history - The chat history object to store.
 * @param ttlSeconds - The Time To Live for the cache entry in seconds. Defaults to 24 hours.
 */
export async function setEphemeralUserChatHistory(
  userId: string,
  history: ChatHistory,
  ttlSeconds: number = CHAT_HISTORY_TTL_SECONDS
): Promise<void> {
  // Assume client is connected or will handle connection state internally
  const key = `user:${userId}:chatHistory`;
  try {
    const value = JSON.stringify(history);
    // Use set with EX option for node-redis v4+
    await redisClient.set(key, value, { EX: ttlSeconds });
    console.log(`Ephemeral chat history set for user ${userId} with TTL ${ttlSeconds}s`);
  } catch (error) {
    console.error(`Error setting ephemeral chat history for user ${userId}:`, error);
    // Optionally re-throw or handle as per application's error strategy
  }
}

/**
 * Gets the ephemeral chat history for a user from Redis.
 * @param userId - The ID of the user.
 * @returns The chat history object if found, otherwise null.
 */
export async function getEphemeralUserChatHistory(userId: string): Promise<ChatHistory | null> {
  // Assume client is connected or will handle connection state internally
  const key = `user:${userId}:chatHistory`;
  try {
    const value = await redisClient.get(key);
    if (value) {
      console.log(`Ephemeral chat history found for user ${userId}`);
      return JSON.parse(value);
    }
    console.log(`No ephemeral chat history found for user ${userId}`);
    return null;
  } catch (error) {
    console.error(`Error getting ephemeral chat history for user ${userId}:`, error);
    return null;
  }
}
