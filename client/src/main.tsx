import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, Filter, Lock, LogOut, Package, Plus, Search, ShoppingBag, Trash2, Upload, UserRound } from 'lucide-react';
import { api, money, type Order, type Product, type User } from './api';
import { decodeCart, encodeCart, loadCart, saveCart, type CartItem } from './cart';
import './styles.css';

type View = 'shop' | 'profile' | 'admin';

function submitWith(handler: (form: FormData) => Promise<void>) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handler(new FormData(event.currentTarget));
  };
}

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>(loadCart());
  const [token, setToken] = useState(localStorage.getItem('gpt-shop-token') ?? '');
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [view, setView] = useState<View>('shop');
  const [selected, setSelected] = useState<Product | null>(null);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ category: '', size: '', sort: '' });

  const cartProducts = useMemo(() => cart.map((item) => ({ item, product: products.find((product) => product.id === item.productId) })).filter((row) => row.product), [cart, products]);
  const total = cartProducts.reduce((sum, row) => sum + (row.product!.priceCents * row.item.quantity), 0);
  const categories = [...new Set(products.map((product) => product.category))];

  async function refreshProducts() {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.size) params.set('size', filters.size);
    if (filters.sort) params.set('sort', filters.sort);
    const data = await api.products(params.toString() ? `?${params}` : '');
    setProducts(data.products);
  }

  useEffect(() => { refreshProducts().catch((error) => setMessage(error.message)); }, [filters]);
  useEffect(() => { saveCart(cart); }, [cart]);
  useEffect(() => {
    if (!token) return;
    api.me(token).then((data) => {
      setUser(data.user);
      setOrders(data.orders);
    }).catch(() => {
      localStorage.removeItem('gpt-shop-token');
      setToken('');
    });
  }, [token]);

  function addToCart(product: Product, size = product.sizes[0]) {
    setCart((items) => {
      const existing = items.find((item) => item.productId === product.id && item.size === size);
      if (existing) return items.map((item) => item === existing ? { ...item, quantity: item.quantity + 1 } : item);
      return [...items, { productId: product.id, size, quantity: 1 }];
    });
    setMessage(`${product.name} added to cart`);
  }

  async function onLogin(form: FormData) {
    const data = await api.login(String(form.get('login')), String(form.get('password')));
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('gpt-shop-token', data.token);
    setMessage(`Signed in as ${data.user.username}`);
  }

  async function onRegister(form: FormData) {
    const data = await api.register({
      email: String(form.get('email')),
      username: String(form.get('username')),
      name: String(form.get('name')),
      password: String(form.get('password'))
    });
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('gpt-shop-token', data.token);
    setMessage('Account created');
  }

  async function checkout(form: FormData) {
    const data = await api.checkout({
      customerName: String(form.get('customerName')),
      address: String(form.get('address')),
      phone: String(form.get('phone')),
      paymentMethod: String(form.get('paymentMethod')),
      items: cart
    }, token || undefined);
    setCart([]);
    setOrders((current) => [data.order, ...current]);
    setMessage(`Order #${data.order.id} placed`);
    await refreshProducts();
  }

  function logout() {
    setToken('');
    setUser(null);
    setOrders([]);
    localStorage.removeItem('gpt-shop-token');
  }

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => setView('shop')}><ShoppingBag size={24} /> Vibe Miner Shop</button>
        <nav>
          <button onClick={() => setView('shop')}><Search size={18} /> Shop</button>
          <button onClick={() => setView('profile')}><UserRound size={18} /> Profile</button>
          {user?.role === 'admin' && <button onClick={() => setView('admin')}><Lock size={18} /> Admin</button>}
          {user ? <button onClick={logout}><LogOut size={18} /> {user.username}</button> : null}
        </nav>
      </header>

      {message && <div className="toast" onClick={() => setMessage('')}>{message}</div>}

      {view === 'shop' && (
        <>
          <section className="hero">
            <div>
              <p>Indie game merchandise</p>
              <h1>Wear the save point. Frame the boss fight.</h1>
            </div>
          </section>
          <section className="layout">
            <aside className="panel">
              <h2><Filter size={18} /> Filters</h2>
              <label>Category<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label>Size<select value={filters.size} onChange={(event) => setFilters({ ...filters, size: event.target.value })}><option value="">All</option>{['S', 'M', 'L', 'XL', 'A2', 'A3', 'One size', 'Pack'].map((size) => <option key={size}>{size}</option>)}</select></label>
              <label>Sort<select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="">Featured</option><option value="price-asc">Price low</option><option value="price-desc">Price high</option><option value="name">Name</option></select></label>
              <CartPanel products={products} cart={cart} setCart={setCart} total={total} setMessage={setMessage} checkout={checkout} />
            </aside>
            <section className="grid">
              {products.map((product) => <ProductCard key={product.id} product={product} addToCart={addToCart} open={setSelected} />)}
            </section>
          </section>
        </>
      )}

      {view === 'profile' && <Profile user={user} orders={orders} onLogin={onLogin} onRegister={onRegister} token={token} setMessage={setMessage} />}
      {view === 'admin' && user?.role === 'admin' && <Admin token={token} products={products} refreshProducts={refreshProducts} setMessage={setMessage} />}
      {selected && <ProductModal product={selected} addToCart={addToCart} close={() => setSelected(null)} />}
    </main>
  );
}

function ProductCard({ product, addToCart, open }: { product: Product; addToCart: (product: Product) => void; open: (product: Product) => void }) {
  return <article className="product">
    <button className="imageButton" onClick={() => open(product)}><img src={product.imageUrl} alt={product.name} /></button>
    <div>
      <span>{product.category}</span>
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      <strong>{money(product.priceCents)}</strong>
      <small>{product.stock} in stock</small>
      <button disabled={product.stock === 0} onClick={() => addToCart(product)}><Plus size={18} /> Add</button>
    </div>
  </article>;
}

function ProductModal({ product, addToCart, close }: { product: Product; addToCart: (product: Product, size?: string) => void; close: () => void }) {
  const [size, setSize] = useState(product.sizes[0]);
  return <div className="modal" onClick={close}>
    <section onClick={(event) => event.stopPropagation()}>
      <img src={product.imageUrl} alt={product.name} />
      <div>
        <h2>{product.name}</h2>
        <p>{product.description}</p>
        <label>Size<select value={size} onChange={(event) => setSize(event.target.value)}>{product.sizes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <p>{product.stock} available</p>
        <button onClick={() => { addToCart(product, size); close(); }}><ShoppingBag size={18} /> Add {money(product.priceCents)}</button>
      </div>
    </section>
  </div>;
}

function CartPanel({ products, cart, setCart, total, setMessage, checkout }: {
  products: Product[];
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  total: number;
  setMessage: (message: string) => void;
  checkout: (form: FormData) => Promise<void>;
}) {
  const [importValue, setImportValue] = useState('');
  return <section className="cart">
    <h2><Package size={18} /> Cart</h2>
    {cart.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      return <div className="cartLine" key={`${item.productId}-${item.size}`}>
        <span>{product?.name ?? item.productId} / {item.size}</span>
        <input type="number" min="1" value={item.quantity} onChange={(event) => setCart((items) => items.map((cartItem) => cartItem === item ? { ...cartItem, quantity: Number(event.target.value) } : cartItem))} />
        <button aria-label="Remove" onClick={() => setCart((items) => items.filter((cartItem) => cartItem !== item))}><Trash2 size={16} /></button>
      </div>;
    })}
    <strong>Total {money(total)}</strong>
    <button onClick={() => { navigator.clipboard?.writeText(encodeCart(cart)); setMessage('Cart export copied'); }}><Download size={16} /> Export</button>
    <textarea value={importValue} onChange={(event) => setImportValue(event.target.value)} placeholder="Paste cart export" />
    <button onClick={() => { setCart(decodeCart(importValue)); setImportValue(''); }}><Upload size={16} /> Import</button>
    <form onSubmit={submitWith((form) => checkout(form).catch((error) => setMessage(error.message)))}>
      <input name="customerName" placeholder="Name" required />
      <input name="address" placeholder="Address" required />
      <input name="phone" placeholder="Phone" required />
      <select name="paymentMethod"><option>Mock card</option><option>Mock cash on delivery</option></select>
      <button disabled={!cart.length}><ShoppingBag size={18} /> Checkout</button>
    </form>
  </section>;
}

function Profile({ user, orders, onLogin, onRegister, token, setMessage }: {
  user: User | null;
  orders: Order[];
  onLogin: (form: FormData) => Promise<void>;
  onRegister: (form: FormData) => Promise<void>;
  token: string;
  setMessage: (message: string) => void;
}) {
  const [resetToken, setResetToken] = useState('');
  if (user) return <section className="account">
    <h1>{user.name}</h1>
    <p>{user.email} · {user.role}</p>
    <h2>Order history</h2>
    {orders.map((order) => <article className="order" key={order.id}><strong>#{order.id} {order.status}</strong><span>{money(order.totalCents)}</span><p>{order.items.map((item) => item.productName ?? item.productId).join(', ')}</p></article>)}
    {!orders.length && <p>No orders yet.</p>}
  </section>;
  return <section className="authGrid">
    <form className="panel" onSubmit={submitWith((form) => onLogin(form).catch((error) => setMessage(error.message)))}>
      <h2>Login</h2>
      <input name="login" placeholder="Email or username" defaultValue="admin" />
      <input name="password" type="password" placeholder="Password" defaultValue={token ? '' : 'admin'} />
      <button><Lock size={18} /> Sign in</button>
    </form>
    <form className="panel" onSubmit={submitWith((form) => onRegister(form).catch((error) => setMessage(error.message)))}>
      <h2>Register</h2>
      <input name="name" placeholder="Name" />
      <input name="username" placeholder="Username" />
      <input name="email" placeholder="Email" />
      <input name="password" type="password" placeholder="Password" />
      <button><UserRound size={18} /> Create account</button>
    </form>
    <form className="panel" onSubmit={submitWith(async (form) => { const data = await api.forgot(String(form.get('email'))); setResetToken(data.token ?? ''); setMessage(data.token ? `Recovery token: ${data.token}` : 'If that user exists, a token was generated'); })}>
      <h2>Password recovery</h2>
      <input name="email" placeholder="Email" />
      <button>Request token</button>
      <input value={resetToken} onChange={(event) => setResetToken(event.target.value)} placeholder="Recovery token" />
      <input name="newPassword" type="password" placeholder="New password" />
      <button type="button" onClick={async () => { await api.reset(resetToken, (document.querySelector('[name=newPassword]') as HTMLInputElement).value); setMessage('Password updated'); }}>Reset password</button>
    </form>
  </section>;
}

function Admin({ token, products, refreshProducts, setMessage }: { token: string; products: Product[]; refreshProducts: () => Promise<void>; setMessage: (message: string) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => { api.adminOrders(token).then((data) => setOrders(data.orders)).catch((error) => setMessage(error.message)); }, [token]);
  async function saveProduct(form: FormData) {
    await api.createProduct({
      name: String(form.get('name')),
      description: String(form.get('description')),
      category: String(form.get('category')),
      priceCents: Number(form.get('priceCents')),
      imageUrl: String(form.get('imageUrl') || '/assets/tshirt_vibe_miner.png'),
      externalImageUrl: String(form.get('externalImageUrl') || '') || undefined,
      sizes: String(form.get('sizes')).split(',').map((item) => item.trim()).filter(Boolean),
      stock: Number(form.get('stock')),
      featured: Boolean(form.get('featured'))
    }, token);
    await refreshProducts();
    setMessage('Product saved');
  }
  return <section className="admin">
    <form className="panel" onSubmit={submitWith((form) => saveProduct(form).catch((error) => setMessage(error.message)))}>
      <h2>New product</h2>
      <input name="name" placeholder="Name" required />
      <input name="category" placeholder="Category" required />
      <input name="priceCents" type="number" placeholder="Price cents" required />
      <input name="stock" type="number" placeholder="Stock" required />
      <input name="sizes" placeholder="Sizes, comma separated" defaultValue="S,M,L" />
      <input name="imageUrl" placeholder="Local image URL" />
      <input name="externalImageUrl" placeholder="External image URL" />
      <textarea name="description" placeholder="Description" required />
      <label className="check"><input name="featured" type="checkbox" /> Featured</label>
      <button><Plus size={18} /> Add product</button>
    </form>
    <section className="adminList">
      <h2>Products</h2>
      {products.map((product) => <div className="adminRow" key={product.id}>
        <span>{product.name}</span><strong>{money(product.priceCents)}</strong>
        <button onClick={async () => { await api.deleteProduct(product.id, token); await refreshProducts(); }}><Trash2 size={16} /></button>
      </div>)}
      <h2>Orders</h2>
      {orders.map((order) => <div className="adminRow" key={order.id}>
        <span>#{order.id} {order.customerName}</span><strong>{money(order.totalCents)}</strong>
        <select value={order.status} onChange={async (event) => {
          const data = await api.updateOrder(order.id, event.target.value as Order['status'], token);
          setOrders((current) => current.map((entry) => entry.id === order.id ? data.order : entry));
        }}>{['New', 'Confirmed', 'Shipped', 'Delivered'].map((status) => <option key={status}>{status}</option>)}</select>
      </div>)}
    </section>
  </section>;
}

createRoot(document.getElementById('root')!).render(<App />);
