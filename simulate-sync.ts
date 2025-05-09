import fetch from 'node-fetch'; // Use node-fetch for making requests in Node.js
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

// Define the expected response type
type SyncResponse = {
  fetched: number;
  processed: number;
  errors: number;
  error?: string; // Optional error field for failed responses
  details?: string; // Optional details field for failed responses
};

const SYNC_API_URL = 'http://localhost:3000/api/sync-products'; // Adjust if running on a different port/host
const CRON_SECRET = process.env.CRON_SECRET;

async function runSyncSimulation() {
  console.log('Starting sync simulation...');

  if (!CRON_SECRET) {
    console.error('Error: CRON_SECRET environment variable is not set.');
    return;
  }

  const syncUrl = `${SYNC_API_URL}?secret=${CRON_SECRET}`;

  try {
    console.log(`Triggering sync API at: ${syncUrl}`);
    const response = await fetch(syncUrl);

    console.log(`Sync API Response Status: ${response.status}`);
    const responseBody = await response.json() as SyncResponse; // Cast to the defined type
    console.log('Sync API Response Body:', responseBody);

    if (!response.ok) {
      console.error(`Sync simulation failed with status ${response.status}: ${responseBody.error} - ${responseBody.details}`);
    } else {
      console.log('Sync simulation completed successfully.');
      console.log(`Fetched: ${responseBody.fetched}, Processed: ${responseBody.processed}, Errors: ${responseBody.errors}`);
    }
  } catch (error) {
    console.error('Error during sync simulation:', error);
  }
}

runSyncSimulation();
