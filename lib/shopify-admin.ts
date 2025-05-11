// --- Interfaces for Type Safety (Admin API) ---

interface AdminShopifyImageNode {
  url: string;
  altText?: string | null;
}

interface AdminShopifyVariantNode {
  id: string;
  price: AdminShopifyPrice;
}

interface AdminShopifyPrice {
  amount: string;
  currencyCode: string;
}

export interface AdminShopifyProductNode {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string | null;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  onlineStoreUrl: string | null;
  images: {
    edges: { node: AdminShopifyImageNode }[];
  };
  priceRange: {
    minVariantPrice: AdminShopifyPrice;
    maxVariantPrice: AdminShopifyPrice;
  };
  variants?: {
    edges: { node: AdminShopifyVariantNode }[];
  };
}

export interface AdminShopifyPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

// --- Fetch Products Function (Admin API using GraphQL) ---

export interface AdminFetchResult {
  products: AdminShopifyProductNode[];
  pageInfo: AdminShopifyPageInfo;
}

const SHOPIFY_PRODUCTS_QUERY = `
query getProducts($first: Int!, $after: String, $query: String) {
  products(first: $first, after: $after, query: $query, sortKey: ID) {
    edges {
      cursor
      node {
        id
        handle
        title
        descriptionHtml
        vendor
        productType
        tags
        onlineStoreUrl
        images(first: 5) {
          edges {
            node {
              url
              altText
            }
          }
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        variants(first: 5) {
          edges {
            node {
              id
              price
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

export async function fetchAdminShopifyProducts(
  cursor: string | null = null,
  limit: number = 50,
  queryFilter: string | null = "status:active"
): Promise<AdminFetchResult> {
  const storeDomain = process.env.SHOPIFY_STORE_NAME;
  const adminAccessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!adminAccessToken || !storeDomain) {
    console.error("CRITICAL: Missing Shopify Admin credentials (SHOPIFY_STORE_NAME, SHOPIFY_ADMIN_ACCESS_TOKEN).");
    throw new Error('Shopify Admin credentials are not configured.');
  }

  console.log(`Fetching Shopify Admin products via GraphQL... Limit: ${limit}, After: ${cursor || 'Start'}, Filter: "${queryFilter || 'None'}"`);

  try {
    const apiVersion = '2024-01'; // Use a specific version for stability
    const url = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;

    const variables: { first: number; after?: string; query?: string } = {
      first: limit,
    };
    if (cursor) {
      variables.after = cursor;
    }
    if (queryFilter) {
      variables.query = queryFilter;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': adminAccessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: SHOPIFY_PRODUCTS_QUERY,
        variables,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Shopify Admin GraphQL API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Shopify Admin GraphQL API error: ${response.status} ${errorText}`);
    }

    const jsonResponse = await response.json();

    if (jsonResponse.errors) {
      console.error('Shopify Admin GraphQL API errors:', jsonResponse.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(jsonResponse.errors)}`);
    }

    const productsData = jsonResponse.data?.products?.edges;
    const pageInfoData = jsonResponse.data?.products?.pageInfo;

    if (!Array.isArray(productsData) || !pageInfoData) {
      console.error("Invalid response structure from Shopify Admin GraphQL API:", jsonResponse);
      throw new Error("Received invalid data structure from Shopify Admin GraphQL API.");
    }

    const products: AdminShopifyProductNode[] = productsData.map(
      (edge: { node: AdminShopifyProductNode; cursor: string }) => edge.node
    );

    const pageInfo: AdminShopifyPageInfo = {
      hasNextPage: pageInfoData.hasNextPage,
      endCursor: pageInfoData.endCursor,
    };

    console.log(` -> Fetched ${products.length} products. HasNextPage: ${pageInfo.hasNextPage}, EndCursor: ${pageInfo.endCursor}`);

    return {
      products,
      pageInfo,
    };
  } catch (err) {
    console.error("Error during Shopify Admin GraphQL fetch:", err);
    throw err; // Re-throw to be caught by the caller
  }
}
