// test/shopify.test.js
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import dotenv from 'dotenv';
dotenv.config();

import { fetchCartDetails, createCheckout, addToCart } from '../lib/shopify';

describe('Shopify Integration Tests', () => {
  const mockCartId = 'mock_cart_id';
  const mockVariantId = 'mock_variant_id';
  const mockQuantity = 1;

beforeEach(() => {
  jest.spyOn(global, 'fetch').mockImplementation((url, options) => {
    const { body } = options;
    const { query } = JSON.parse(body);

    if (query.includes('cart(')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { cart: { id: 'mock_cart_id', checkoutUrl: 'mock_checkout_url', lines: { edges: [] } } } }),
      });
    } else if (query.includes('cartCheckoutCreate')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { cartCheckoutCreate: { checkout: { id: 'mock_checkout_id', webUrl: 'mock_web_url' }, cart: { id: 'mock_cart_id' }, userErrors: [] } } }),
      });
    } else if (query.includes('cartCreate')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { cartCreate: { cart: { id: 'mock_cart_id', checkoutUrl: 'mock_checkout_url' }, userErrors: [] } } }),
      });
    } else if (query.includes('cartLinesAdd')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { cartLinesAdd: { cart: { id: 'mock_cart_id', checkoutUrl: 'mock_checkout_url' }, userErrors: [] } } }),
      });
    }
     else {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });
    }
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('should fetch cart details successfully', async () => {
  const cartDetails = await fetchCartDetails(mockCartId);
  expect(cartDetails).toBeDefined();
  expect(cartDetails.cartId).toBe(mockCartId || null);
});

it('should create a checkout successfully', async () => {
  const checkout = await createCheckout(mockCartId);
  expect(checkout).toBeDefined();
  expect(checkout.cartId).toBe(mockCartId);
});

it('should add to cart successfully', async () => {
  const cart = await addToCart(mockCartId, mockVariantId, mockQuantity);
  expect(cart).toBeDefined();
  expect(cart.cartId).toBe(mockCartId);
});
});
