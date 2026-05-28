import fs from 'node:fs/promises';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import { z } from 'zod';
import { config } from './config';
import type { Store } from './store';
import type { OrderStatus, PublicUser } from './types';

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(4),
  name: z.string().min(1)
});

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1)
});

const checkoutSchema = z.object({
  customerName: z.string().min(1),
  address: z.string().min(3),
  phone: z.string().min(3),
  paymentMethod: z.string().min(1),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    size: z.string().min(1),
    quantity: z.number().int().positive()
  })).min(1)
});

const productSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().min(1),
  category: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  imageUrl: z.string().min(1),
  sizes: z.array(z.string().min(1)).min(1),
  stock: z.number().int().nonnegative(),
  featured: z.boolean().optional(),
  externalImageUrl: z.string().url().optional()
});

function sign(user: PublicUser) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
}

function asyncRoute(handler: express.RequestHandler): express.RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function downloadImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image download failed with status ${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
  const uploads = path.join(config.rootDir, 'uploads');
  await fs.mkdir(uploads, { recursive: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(path.join(uploads, filename), buffer);
  return `/uploads/${filename}`;
}

export function createApp(store: Store) {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: [config.publicOrigin, 'http://localhost:5173'], credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('tiny'));
  app.use('/assets', express.static(path.join(config.rootDir, 'assets')));
  app.use('/uploads', express.static(path.join(config.rootDir, 'uploads')));

  app.use(asyncRoute(async (req, _res, next) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(auth.slice(7), config.jwtSecret) as { sub: number };
        const user = await store.findUserById(Number(payload.sub));
        if (user) req.user = user;
      } catch {
        req.user = undefined;
      }
    }
    next();
  }));

  const requireUser: express.RequestHandler = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    next();
  };

  const requireAdmin: express.RequestHandler = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/products', asyncRoute(async (req, res) => {
    const products = await store.listProducts({
      category: req.query.category?.toString(),
      size: req.query.size?.toString(),
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      sort: req.query.sort?.toString()
    });
    res.json({ products });
  }));

  app.get('/api/products/:id', asyncRoute(async (req, res) => {
    const product = await store.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product });
  }));

  app.post('/api/auth/register', asyncRoute(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const existing = await store.findUserByEmailOrUsername(input.email);
    if (existing) return res.status(409).json({ error: 'Email already exists' });
    const user = await store.createUser(input);
    await store.logEvent('register_success', { userId: user.id, email: user.email });
    res.status(201).json({ user, token: sign(user) });
  }));

  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await store.findUserByEmailOrUsername(input.login);
    if (!user || !(await store.verifyPassword(input.password, user.passwordHash))) {
      await store.logEvent('login_failed', { login: input.login });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const publicUser = { id: user.id, email: user.email, username: user.username, name: user.name, role: user.role };
    await store.logEvent('login_success', { userId: user.id });
    res.json({ user: publicUser, token: sign(publicUser) });
  }));

  app.get('/api/me', requireUser, asyncRoute(async (req, res) => {
    const orders = await store.listOrdersForUser(req.user!.id);
    res.json({ user: req.user, orders });
  }));

  app.post('/api/auth/forgot', asyncRoute(async (req, res) => {
    const email = z.object({ email: z.string().email() }).parse(req.body).email;
    const token = await store.createPasswordToken(email);
    await store.logEvent('password_reset_requested', { email, issued: Boolean(token) });
    res.json({ ok: true, token });
  }));

  app.post('/api/auth/reset', asyncRoute(async (req, res) => {
    const input = z.object({ token: z.string().min(1), password: z.string().min(4) }).parse(req.body);
    const ok = await store.resetPassword(input.token, input.password);
    if (!ok) return res.status(400).json({ error: 'Invalid or expired token' });
    res.json({ ok: true });
  }));

  app.post('/api/orders', asyncRoute(async (req, res) => {
    const input = checkoutSchema.parse(req.body);
    const order = await store.createOrder({ ...input, userId: req.user?.id });
    await store.logEvent('checkout_success', { orderId: order.id, userId: req.user?.id, totalCents: order.totalCents });
    res.status(201).json({ order });
  }));

  app.get('/api/admin/orders', requireAdmin, asyncRoute(async (_req, res) => {
    res.json({ orders: await store.listOrders() });
  }));

  app.patch('/api/admin/orders/:id', requireAdmin, asyncRoute(async (req, res) => {
    const status = z.enum(['New', 'Confirmed', 'Shipped', 'Delivered']).parse(req.body.status) as OrderStatus;
    const order = await store.updateOrderStatus(Number(req.params.id), status);
    res.json({ order });
  }));

  app.post('/api/admin/products', requireAdmin, asyncRoute(async (req, res) => {
    const parsed = productSchema.parse(req.body);
    const imageUrl = parsed.externalImageUrl ? await downloadImage(parsed.externalImageUrl) : parsed.imageUrl;
    const product = await store.createProduct({ ...parsed, imageUrl });
    res.status(201).json({ product });
  }));

  app.put('/api/admin/products/:id', requireAdmin, asyncRoute(async (req, res) => {
    const parsed = productSchema.partial().parse(req.body);
    const imageUrl = parsed.externalImageUrl ? await downloadImage(parsed.externalImageUrl) : parsed.imageUrl;
    const product = await store.updateProduct(Number(req.params.id), { ...parsed, imageUrl });
    res.json({ product });
  }));

  app.delete('/api/admin/products/:id', requireAdmin, asyncRoute(async (req, res) => {
    await store.deleteProduct(Number(req.params.id));
    res.status(204).end();
  }));

  app.use(express.static(config.clientDist));
  app.get('*', (_req, res, next) => {
    res.sendFile(path.join(config.clientDist, 'index.html'), (error) => {
      if (error) next();
    });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Server error';
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: error.flatten() });
    res.status(500).json({ error: message });
  });

  return app;
}
