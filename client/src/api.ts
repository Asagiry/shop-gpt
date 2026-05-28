import type { CartItem } from './cart';

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  category: string;
  priceCents: number;
  imageUrl: string;
  sizes: string[];
  stock: number;
  featured: boolean;
}

export interface User {
  id: number;
  email: string;
  username: string;
  name: string;
  role: 'customer' | 'admin';
}

export interface Order {
  id: number;
  status: 'New' | 'Confirmed' | 'Shipped' | 'Delivered';
  totalCents: number;
  customerName: string;
  address: string;
  phone: string;
  paymentMethod: string;
  createdAt?: string;
  items: Array<CartItem & { productName?: string; priceCents?: number }>;
}

const API_BASE = '';

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Запрос не выполнен');
  return data as T;
}

export const api = {
  products: (params = '') => request<{ products: Product[] }>(`/api/products${params}`),
  login: (login: string, password: string) => request<{ user: User; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login, password })
  }),
  register: (input: { email: string; username: string; password: string; name: string }) => request<{ user: User; token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input)
  }),
  me: (token: string) => request<{ user: User; orders: Order[] }>('/api/me', {}, token),
  forgot: (email: string) => request<{ ok: boolean; token?: string }>('/api/auth/forgot', {
    method: 'POST',
    body: JSON.stringify({ email })
  }),
  reset: (token: string, password: string) => request<{ ok: boolean }>('/api/auth/reset', {
    method: 'POST',
    body: JSON.stringify({ token, password })
  }),
  checkout: (body: { customerName: string; address: string; phone: string; paymentMethod: string; items: CartItem[] }, token?: string) =>
    request<{ order: Order }>('/api/orders', { method: 'POST', body: JSON.stringify(body) }, token),
  adminOrders: (token: string) => request<{ orders: Order[] }>('/api/admin/orders', {}, token),
  updateOrder: (id: number, status: Order['status'], token: string) => request<{ order: Order }>(`/api/admin/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }, token),
  createProduct: (product: Partial<Product> & { externalImageUrl?: string }, token: string) => request<{ product: Product }>('/api/admin/products', {
    method: 'POST',
    body: JSON.stringify(product)
  }, token),
  updateProduct: (id: number, product: Partial<Product>, token: string) => request<{ product: Product }>(`/api/admin/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(product)
  }, token),
  deleteProduct: (id: number, token: string) => fetch(`/api/admin/products/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
};

export function money(cents: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
