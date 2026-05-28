import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import type { Store } from './store';

function createMemoryStore(): Store {
  const products = [
    {
      id: 1,
      name: 'Vibe Miner Tee',
      slug: 'vibe-miner-tee',
      description: 'Pixel cave mining shirt.',
      category: 'Apparel',
      priceCents: 3200,
      imageUrl: '/assets/tshirt_vibe_miner.png',
      sizes: ['S', 'M'],
      stock: 5,
      featured: true
    }
  ];
  const orders: any[] = [];
  return {
    listProducts: vi.fn(async () => products),
    getProduct: vi.fn(async (id: number) => products.find((product) => product.id === id) ?? null),
    findUserByEmailOrUsername: vi.fn(async () => null),
    findUserById: vi.fn(async () => null),
    createUser: vi.fn(async (input) => ({ id: 9, email: input.email, username: input.username, role: 'customer', name: input.name })),
    verifyPassword: vi.fn(async () => true),
    createPasswordToken: vi.fn(async () => 'reset-token'),
    resetPassword: vi.fn(async () => true),
    createOrder: vi.fn(async (input) => {
      products[0].stock -= input.items[0].quantity;
      const order = { id: 11, status: 'New', totalCents: 6400, ...input };
      orders.push(order);
      return order;
    }),
    listOrdersForUser: vi.fn(async () => orders),
    listOrders: vi.fn(async () => orders),
    updateOrderStatus: vi.fn(async (_id, status) => ({ ...orders[0], status })),
    createProduct: vi.fn(async (input) => ({ id: 2, ...input })),
    updateProduct: vi.fn(async (id, input) => ({ id, ...products[0], ...input })),
    deleteProduct: vi.fn(async () => undefined),
    logEvent: vi.fn(async () => undefined)
  };
}

describe('shop api', () => {
  it('returns a product catalog', async () => {
    const app = createApp(createMemoryStore());
    const response = await request(app).get('/api/products').expect(200);

    expect(response.body.products).toHaveLength(1);
    expect(response.body.products[0].imageUrl).toBe('/assets/tshirt_vibe_miner.png');
  });

  it('creates checkout orders and decreases inventory through the store', async () => {
    const store = createMemoryStore();
    const app = createApp(store);

    const response = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Ada Player',
        address: '1 Pixel Road',
        phone: '+100000000',
        paymentMethod: 'Mock card',
        items: [{ productId: 1, size: 'M', quantity: 2 }]
      })
      .expect(201);

    expect(response.body.order.totalCents).toBe(6400);
    expect(await store.getProduct(1)).toMatchObject({ stock: 3 });
    expect(store.logEvent).toHaveBeenCalledWith('checkout_success', expect.any(Object));
  });
});
