import { describe, expect, it } from 'vitest';
import { decodeCart, encodeCart } from './cart';

describe('cart import/export', () => {
  it('round trips cart items as base64 json', () => {
    const items = [{ productId: 1, size: 'M', quantity: 2 }];

    const encoded = encodeCart(items);
    const decoded = decodeCart(encoded);

    expect(decoded).toEqual(items);
  });

  it('rejects invalid cart payloads', () => {
    expect(() => decodeCart('not-base64')).toThrow(/Invalid cart/i);
  });

  it('returns a visible export string without relying on clipboard support', () => {
    const items = [{ productId: 3, size: 'L', quantity: 1 }];

    expect(encodeCart(items)).toBeTypeOf('string');
    expect(encodeCart(items).length).toBeGreaterThan(10);
  });
});
