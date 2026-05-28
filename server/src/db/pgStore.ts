import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { pool } from './pool';
import { appendServerLog } from '../logger';
import type { CheckoutInput, Order, OrderStatus, Product, PublicUser } from '../types';
import type { CreateUserInput, ProductInput, Store } from '../store';

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function productFromRow(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    priceCents: row.price_cents,
    imageUrl: row.image_url,
    sizes: row.sizes ?? [],
    stock: row.stock,
    featured: row.featured
  };
}

function userFromRow(row: any): PublicUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    name: row.name,
    role: row.role
  };
}

async function orderFromId(id: number): Promise<Order> {
  const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  const order = orderResult.rows[0];
  const items = await pool.query('SELECT product_id, product_name, size, quantity, price_cents FROM order_items WHERE order_id = $1 ORDER BY id', [id]);
  return {
    id: order.id,
    userId: order.user_id ?? undefined,
    customerName: order.customer_name,
    address: order.address,
    phone: order.phone,
    paymentMethod: order.payment_method,
    status: order.status,
    totalCents: order.total_cents,
    createdAt: order.created_at?.toISOString?.() ?? order.created_at,
    items: items.rows.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      size: item.size,
      quantity: item.quantity,
      priceCents: item.price_cents
    }))
  };
}

export class PgStore implements Store {
  async listProducts(filters: Parameters<Store['listProducts']>[0] = {}) {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (filters.category) {
      values.push(filters.category);
      clauses.push(`category = $${values.length}`);
    }
    if (filters.size) {
      values.push(filters.size);
      clauses.push(`$${values.length} = ANY(sizes)`);
    }
    if (filters.minPrice !== undefined) {
      values.push(filters.minPrice);
      clauses.push(`price_cents >= $${values.length}`);
    }
    if (filters.maxPrice !== undefined) {
      values.push(filters.maxPrice);
      clauses.push(`price_cents <= $${values.length}`);
    }
    const orderBy = filters.sort === 'price-desc'
      ? 'price_cents DESC'
      : filters.sort === 'price-asc'
        ? 'price_cents ASC'
        : filters.sort === 'name'
          ? 'name ASC'
          : 'featured DESC, id ASC';
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(`SELECT * FROM products ${where} ORDER BY ${orderBy}`, values);
    return result.rows.map(productFromRow);
  }

  async getProduct(id: number) {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    return result.rows[0] ? productFromRow(result.rows[0]) : null;
  }

  async findUserByEmailOrUsername(login: string) {
    const result = await pool.query('SELECT * FROM users WHERE lower(email) = lower($1) OR lower(username) = lower($1)', [login]);
    const row = result.rows[0];
    return row ? { ...userFromRow(row), passwordHash: row.password_hash } : null;
  }

  async findUserById(id: number) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? userFromRow(result.rows[0]) : null;
  }

  async createUser(input: CreateUserInput) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const result = await pool.query(
      'INSERT INTO users(email, username, password_hash, name, role) VALUES($1, $2, $3, $4, $5) RETURNING *',
      [input.email, input.username, passwordHash, input.name, input.role ?? 'customer']
    );
    return userFromRow(result.rows[0]);
  }

  async verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }

  async createPasswordToken(email: string) {
    const user = await this.findUserByEmailOrUsername(email);
    if (!user) return null;
    const token = randomUUID().replace(/-/g, '');
    await pool.query(
      'INSERT INTO password_reset_tokens(user_id, token, expires_at) VALUES($1, $2, now() + interval \'30 minutes\')',
      [user.id, token]
    );
    return token;
  }

  async resetPassword(token: string, password: string) {
    const tokenResult = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > now()',
      [token]
    );
    if (!tokenResult.rows[0]) return false;
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, tokenResult.rows[0].user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [tokenResult.rows[0].id]);
    return true;
  }

  async createOrder(input: CheckoutInput) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const productRows = [];
      let totalCents = 0;
      for (const item of input.items) {
        const productResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [item.productId]);
        const product = productResult.rows[0];
        if (!product) throw new Error(`Product ${item.productId} was not found`);
        if (!product.sizes.includes(item.size)) throw new Error(`${product.name} does not have size ${item.size}`);
        if (product.stock < item.quantity) throw new Error(`${product.name} does not have enough stock`);
        await client.query('UPDATE products SET stock = stock - $1, updated_at = now() WHERE id = $2', [item.quantity, item.productId]);
        totalCents += product.price_cents * item.quantity;
        productRows.push({ product, item });
      }
      const orderResult = await client.query(
        'INSERT INTO orders(user_id, customer_name, address, phone, payment_method, total_cents) VALUES($1, $2, $3, $4, $5, $6) RETURNING id',
        [input.userId ?? null, input.customerName, input.address, input.phone, input.paymentMethod, totalCents]
      );
      const orderId = orderResult.rows[0].id;
      for (const { product, item } of productRows) {
        await client.query(
          'INSERT INTO order_items(order_id, product_id, product_name, size, quantity, price_cents) VALUES($1, $2, $3, $4, $5, $6)',
          [orderId, product.id, product.name, item.size, item.quantity, product.price_cents]
        );
      }
      await client.query('COMMIT');
      return orderFromId(orderId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listOrdersForUser(userId: number) {
    const result = await pool.query('SELECT id FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return Promise.all(result.rows.map((row) => orderFromId(row.id)));
  }

  async listOrders() {
    const result = await pool.query('SELECT id FROM orders ORDER BY created_at DESC');
    return Promise.all(result.rows.map((row) => orderFromId(row.id)));
  }

  async updateOrderStatus(id: number, status: OrderStatus) {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
    return orderFromId(id);
  }

  async createProduct(input: ProductInput) {
    const slug = input.slug || slugify(input.name);
    const result = await pool.query(
      'INSERT INTO products(name, slug, description, category, price_cents, image_url, sizes, stock, featured) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [input.name, slug, input.description, input.category, input.priceCents, input.imageUrl, input.sizes, input.stock, input.featured ?? false]
    );
    return productFromRow(result.rows[0]);
  }

  async updateProduct(id: number, input: Partial<ProductInput>) {
    const current = await this.getProduct(id);
    if (!current) throw new Error('Product not found');
    if (input.priceCents !== undefined && input.priceCents !== current.priceCents) {
      await this.logEvent('admin_price_change', { productId: id, from: current.priceCents, to: input.priceCents });
    }
    const next = { ...current, ...input, slug: input.slug ?? current.slug };
    const result = await pool.query(
      'UPDATE products SET name=$1, slug=$2, description=$3, category=$4, price_cents=$5, image_url=$6, sizes=$7, stock=$8, featured=$9, updated_at=now() WHERE id=$10 RETURNING *',
      [next.name, next.slug, next.description, next.category, next.priceCents, next.imageUrl, next.sizes, next.stock, next.featured, id]
    );
    return productFromRow(result.rows[0]);
  }

  async deleteProduct(id: number) {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
  }

  async logEvent(event: string, details: Record<string, unknown>) {
    await pool.query('INSERT INTO system_logs(event, details) VALUES($1, $2)', [event, details]);
    await appendServerLog(event, details);
  }
}
