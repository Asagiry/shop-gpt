export interface CartItem {
  productId: number;
  size: string;
  quantity: number;
}

export function encodeCart(items: CartItem[]) {
  return btoa(JSON.stringify(items));
}

export function decodeCart(payload: string): CartItem[] {
  try {
    const parsed = JSON.parse(atob(payload));
    if (!Array.isArray(parsed)) throw new Error('Invalid cart');
    for (const item of parsed) {
      if (!Number.isInteger(item.productId) || typeof item.size !== 'string' || !Number.isInteger(item.quantity)) {
        throw new Error('Invalid cart item');
      }
      if (item.productId <= 0 || item.quantity <= 0 || item.size.length === 0) throw new Error('Invalid cart item');
    }
    return parsed;
  } catch {
    throw new Error('Invalid cart payload');
  }
}

export function saveCart(items: CartItem[]) {
  localStorage.setItem('gpt-shop-cart', JSON.stringify(items));
}

export function loadCart(): CartItem[] {
  const raw = localStorage.getItem('gpt-shop-cart');
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
