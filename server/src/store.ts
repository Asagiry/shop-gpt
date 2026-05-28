import type { CheckoutInput, Order, OrderStatus, Product, PublicUser, Role } from './types';

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  name: string;
  role?: Role;
}

export interface ProductInput {
  name: string;
  slug?: string;
  description: string;
  category: string;
  priceCents: number;
  imageUrl: string;
  sizes: string[];
  stock: number;
  featured?: boolean;
}

export interface Store {
  listProducts(filters?: {
    category?: string;
    size?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
  }): Promise<Product[]>;
  getProduct(id: number): Promise<Product | null>;
  findUserByEmailOrUsername(login: string): Promise<(PublicUser & { passwordHash: string }) | null>;
  findUserById(id: number): Promise<PublicUser | null>;
  createUser(input: CreateUserInput): Promise<PublicUser>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  createPasswordToken(email: string): Promise<string | null>;
  resetPassword(token: string, password: string): Promise<boolean>;
  createOrder(input: CheckoutInput): Promise<Order>;
  listOrdersForUser(userId: number): Promise<Order[]>;
  listOrders(): Promise<Order[]>;
  updateOrderStatus(id: number, status: OrderStatus): Promise<Order>;
  createProduct(input: ProductInput): Promise<Product>;
  updateProduct(id: number, input: Partial<ProductInput>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  logEvent(event: string, details: Record<string, unknown>): Promise<void>;
}
