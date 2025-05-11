// lib/external.ts

/**
 * Fetches product prices from a hypothetical external API.
 * This is a placeholder and needs to be adapted to a real API.
 * @param productType - The type of product to search for (e.g., "lipstick").
 * @param attributes - An array of product attributes (e.g., ["vegan", "cruelty-free"]).
 * @returns A promise that resolves to an array of product data or null if an error occurs.
 */
export async function fetchProductPrices(
  productType: string,
  attributes: string[]
): Promise<unknown[] | null> {
  if (!process.env.PRICE_API_KEY) {
    console.warn('PRICE_API_KEY not set. Skipping external price fetch.');
    return null;
  }

  // Construct the API URL carefully, ensuring proper encoding for parameters.
  const params = new URLSearchParams();
  params.append('type', productType);
  if (attributes && attributes.length > 0) {
    params.append('attributes', attributes.join(','));
  }
  
  // Placeholder API URL - replace with a real one.
  const apiUrl = `https://api.example-pricecomparison.com/v1/products?${params.toString()}`;

  try {
    console.log(`Fetching external prices from: ${apiUrl}`);
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.PRICE_API_KEY}`,
        'Accept': 'application/json',
      },
      // Add timeout if your fetch implementation or a library like 'node-fetch' supports it.
      // For example, with node-fetch: timeout: 5000 (milliseconds)
    });

    if (!response.ok) {
      console.error(`Error fetching prices from external API. Status: ${response.status}, Message: ${await response.text()}`);
      return null;
    }

    const data = await response.json();
    
    // Assuming the API returns an object with a 'products' array. Adapt as needed.
    if (data && Array.isArray(data.products)) {
      console.log(`Successfully fetched ${data.products.length} product prices externally.`);
      return data.products;
    } else {
      console.warn('External price API returned unexpected data structure:', data);
      return null;
    }
  } catch (error) {
    console.error('Error during external API call for product prices:', error);
    return null;
  }
}
