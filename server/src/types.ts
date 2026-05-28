export type Role = 'customer' | 'admin';
export type OrderStatus = 'New' | 'Confirmed' | 'Shipped' | 'Delivered';

export interface PublicUser {
  id: number;
  email: string;
  username: string;
  name: string;
  role: Role;
}

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

export interface CartItemInput {
  productId: number;
  size: string;
  quantity: number;
}

export interface CheckoutInput {
  userId?: number;
  customerName: string;
  address: string;
  phone: string;
  paymentMethod: string;
  items: CartItemInput[];
}

export interface Order {
  id: number;
  userId?: number;
  customerName: string;
  address: string;
  phone: string;
  paymentMethod: string;
  status: OrderStatus;
  totalCents: number;
  createdAt?: string;
  items: Array<CartItemInput & { productName?: string; priceCents?: number }>;
}
