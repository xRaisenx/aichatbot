import { AdminFetchResult, fetchAdminShopifyProducts } from './shopify-admin';
    export const fetchShopifyProducts = fetchAdminShopifyProducts;
    export type { AdminFetchResult };
    
interface CartResponse {
  cartId: string | null;
  checkoutUrl: string | null;
  userErrors: { message: string }[];
}

interface CartDetailsResponse {
  cartId: string | null;
  checkoutUrl: string | null;
  lines: {
    id: string;
    merchandise: {
      id: string;
      title: string;
      product: {
        title: string;
      };
      image: {
        src: string;
      } | null;
      priceV2: {
        amount: string;
        currencyCode: "USD";
      };
    };
    quantity: number;
    cost: {
      totalAmount: {
        amount: string;
        currencyCode: "USD";
      };
    };
  }[];
  cost: {
    totalAmount: {
      amount: string;
      currencyCode: "USD";
    };
  };
  userErrors: { message: string }[];
}

interface CartLineItem {
  id: string;
  merchandise: {
    id: string;
    title: string;
    product: {
      title: string;
    };
    image: {
      src: string;
    } | null;
    priceV2: {
      amount: string;
      currencyCode: "USD";
    };
  };
  quantity: number;
  cost: {
    totalAmount: {
      amount: string;
      currencyCode: "USD";
    };
  };
}

export async function fetchCartDetails(cartId: string): Promise<CartDetailsResponse> {
  const storeName = process.env.SHOPIFY_STORE_NAME;
  const storefrontAccessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

  if (!storeName || !storefrontAccessToken) {
    throw new Error('Shopify environment variables are not set.');
  }

  const endpoint = `https://${storeName}/api/2023-10/graphql.json`;
  const query = `
    query {
      cart(id: "${cartId}") {
        id
        checkoutUrl
        lines(first: 100) {
          edges {
            node {
              id
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  product {
                    title
                  }
                  image {
                    src
                  }
                  priceV2 {
                    amount
                    currencyCode: "USD"
                  }
                }
              }
              quantity
              cost {
                totalAmount {
                  amount
                  currencyCode: "USD"
                }
              }
            }
          }
        }
        cost {
          totalAmount {
            amount
            currencyCode: "USD"
          }
        }
        userErrors {
          message
        }
      }
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error('Shopify API error:', response.status, response.statusText);
      return { cartId: null, checkoutUrl: null, lines: [], cost: { totalAmount: { amount: '0', currencyCode: "USD" } }, userErrors: [{ message: 'Failed to fetch cart details.' }] };
    }

    const result = await response.json();
    const cartData = result.data?.cart;

    if (!cartData) {
      return { cartId: null, checkoutUrl: null, lines: [], cost: { totalAmount: { amount: '0', currencyCode: "USD" } }, userErrors: [{ message: 'Cart not found' }] };
    }

    const lines = cartData.lines.edges.map((edge: { node: CartLineItem }) => edge.node);

    return {
      cartId: cartData.id || null,
      checkoutUrl: cartData.checkoutUrl || null,
      lines: lines || [],
      cost: cartData.cost || { totalAmount: { amount: '0', currencyCode: "USD" } },
      userErrors: cartData.userErrors || [],
    };
  } catch (error) {
    console.error('Shopify API error:', error);
    return { cartId: null, checkoutUrl: null, lines: [], cost: { totalAmount: { amount: '0', currencyCode: "USD" } }, userErrors: [{ message: 'Failed to fetch cart details.' }] };
  }
}


export async function createCheckout(cartId: string): Promise<CartResponse> {
  const storeName = process.env.SHOPIFY_STORE_NAME;
  const storefrontAccessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

  if (!storeName || !storefrontAccessToken) {
    throw new Error('Shopify environment variables are not set.');
  }

  const endpoint = `https://${storeName}/api/2023-10/graphql.json`;
  const query = `
    mutation {
      cartCheckoutCreate(cartId: "${cartId}") {
        checkout {
          id
          webUrl
        }
        cart {
          id
        }
        userErrors {
          message
        }
      }
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error('Shopify API error:', response.status, response.statusText);
      return { cartId: null, checkoutUrl: null, userErrors: [{ message: 'Failed to create checkout.' }] };
    }

    const result = await response.json();
    const checkoutData = result.data?.cartCheckoutCreate;

    return {
      cartId: checkoutData?.cart?.id || null,
      checkoutUrl: checkoutData?.checkout?.webUrl || null,
      userErrors: checkoutData?.userErrors || [],
    };
  } catch (error) {
    console.error('Shopify API error:', error);
    return { cartId: null, checkoutUrl: null, userErrors: [{ message: 'Failed to create checkout.' }] };
  }
}


export async function addToCart(
  cartId: string | null,
  variantId: string,
  quantity: number
): Promise<CartResponse> {
  const storeName = process.env.SHOPIFY_STORE_NAME;
  const storefrontAccessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

  if (!storeName || !storefrontAccessToken) {
    throw new Error('Shopify environment variables are not set.');
  }

  const endpoint = `https://${storeName}/api/2023-10/graphql.json`;
  const query = cartId
    ? `
      mutation {
        cartLinesAdd(cartId: "${cartId}", lines: [{ merchandiseId: "${variantId}", quantity: ${quantity} }]) {
          cart {
            id
            checkoutUrl
          }
          userErrors {
            message
          }
        }
      }
    `
    : `
      mutation {
        cartCreate(input: { lines: [{ merchandiseId: "${variantId}", quantity: ${quantity} }] }) {
          cart {
            id
            checkoutUrl
          }
          userErrors {
            message
          }
        }
      }
    `;
  const variables = {};

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      console.error('Shopify API error:', response.status, response.statusText);
      return { cartId: null, checkoutUrl: null, userErrors: [{ message: 'Failed to add to cart.' }] };
    }

    const result = await response.json();
    // Check if result.data exists before accessing its properties
    const cartData = result.data?.cartCreate || result.data?.cartLinesAdd;
    return {
      cartId: cartData?.cart?.id || null,
      checkoutUrl: cartData?.cart?.checkoutUrl || null,
      userErrors: cartData?.userErrors || [],
    };
  } catch (error) {
    console.error('Shopify API error:', error);
    return { cartId: null, checkoutUrl: null, userErrors: [{ message: 'Failed to add to cart.' }] };
  }
}
