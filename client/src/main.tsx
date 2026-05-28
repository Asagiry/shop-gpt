import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, Filter, Lock, LogOut, Package, Plus, Search, ShoppingBag, Trash2, Upload, UserRound } from 'lucide-react';
import { api, money, type Order, type Product, type User } from './api';
import { decodeCart, encodeCart, loadCart, saveCart, type CartItem } from './cart';
import './styles.css';

type View = 'shop' | 'profile' | 'admin';

const statusLabels: Record<Order['status'], string> = {
  New: 'Новый',
  Confirmed: 'Подтвержден',
  Shipped: 'Отправлен',
  Delivered: 'Доставлен'
};

const sizeLabels: Record<string, string> = {
  'One size': 'Один размер',
  Pack: 'Набор'
};

function displaySize(size: string) {
  return sizeLabels[size] ?? size;
}

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
    setMessage(`${product.name} добавлен в корзину`);
  }

  async function onLogin(form: FormData) {
    const data = await api.login(String(form.get('login')), String(form.get('password')));
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('gpt-shop-token', data.token);
    setMessage(`Вы вошли как ${data.user.username}`);
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
    setMessage('Аккаунт создан');
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
    setMessage(`Заказ #${data.order.id} оформлен`);
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
        <button className="brand" onClick={() => setView('shop')}><ShoppingBag size={24} /> Магазин Vibe Miner</button>
        <nav>
          <button onClick={() => setView('shop')}><Search size={18} /> Магазин</button>
          <button onClick={() => setView('profile')}><UserRound size={18} /> Профиль</button>
          {user?.role === 'admin' && <button onClick={() => setView('admin')}><Lock size={18} /> Админ</button>}
          {user ? <button onClick={logout}><LogOut size={18} /> {user.username}</button> : null}
        </nav>
      </header>

      {message && <div className="toast" onClick={() => setMessage('')}>{message}</div>}

      {view === 'shop' && (
        <>
          <section className="hero">
            <div>
              <p>Мерч по инди-играм</p>
              <h1>Носи точку сохранения. Повесь битву с боссом.</h1>
            </div>
          </section>
          <section className="layout">
            <aside className="panel">
              <h2><Filter size={18} /> Фильтры</h2>
              <label>Категория<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">Все</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label>Размер<select value={filters.size} onChange={(event) => setFilters({ ...filters, size: event.target.value })}><option value="">Все</option>{['S', 'M', 'L', 'XL', 'A2', 'A3', 'One size', 'Pack'].map((size) => <option key={size} value={size}>{displaySize(size)}</option>)}</select></label>
              <label>Сортировка<select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="">Сначала избранное</option><option value="price-asc">Цена по возрастанию</option><option value="price-desc">Цена по убыванию</option><option value="name">По названию</option></select></label>
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
      <small>В наличии: {product.stock}</small>
      <button disabled={product.stock === 0} onClick={() => addToCart(product)}><Plus size={18} /> Добавить</button>
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
        <label>Размер<select value={size} onChange={(event) => setSize(event.target.value)}>{product.sizes.map((item) => <option key={item} value={item}>{displaySize(item)}</option>)}</select></label>
        <p>Доступно: {product.stock}</p>
        <button onClick={() => { addToCart(product, size); close(); }}><ShoppingBag size={18} /> Добавить за {money(product.priceCents)}</button>
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
  const [exportValue, setExportValue] = useState('');

  async function exportCart() {
    const value = encodeCart(cart);
    setExportValue(value);
    try {
      await navigator.clipboard?.writeText(value);
      setMessage('Экспорт корзины готов и скопирован');
    } catch {
      setMessage('Экспорт корзины готов: скопируйте строку из поля');
    }
  }

  function importCart() {
    try {
      setCart(decodeCart(importValue.trim()));
      setImportValue('');
      setMessage('Корзина импортирована');
    } catch {
      setMessage('Не удалось импортировать корзину: проверьте строку');
    }
  }

  return <section className="cart">
    <h2><Package size={18} /> Корзина</h2>
    {cart.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      return <div className="cartLine" key={`${item.productId}-${item.size}`}>
        <span>{product?.name ?? item.productId} / {displaySize(item.size)}</span>
        <input type="number" min="1" value={item.quantity} onChange={(event) => setCart((items) => items.map((cartItem) => cartItem === item ? { ...cartItem, quantity: Number(event.target.value) } : cartItem))} />
        <button aria-label="Удалить" onClick={() => setCart((items) => items.filter((cartItem) => cartItem !== item))}><Trash2 size={16} /></button>
      </div>;
    })}
    <strong>Итого {money(total)}</strong>
    <button type="button" onClick={exportCart}><Download size={16} /> Экспорт</button>
    <textarea readOnly value={exportValue} placeholder="Здесь появится строка экспорта корзины" onFocus={(event) => event.currentTarget.select()} />
    <textarea value={importValue} onChange={(event) => setImportValue(event.target.value)} placeholder="Вставьте строку экспорта корзины" />
    <button type="button" onClick={importCart}><Upload size={16} /> Импорт</button>
    <form onSubmit={submitWith((form) => checkout(form).catch((error) => setMessage(error.message)))}>
      <input name="customerName" placeholder="Имя" required />
      <input name="address" placeholder="Адрес" required />
      <input name="phone" placeholder="Телефон" required />
      <select name="paymentMethod"><option>Тестовая карта</option><option>Тестовая оплата при получении</option></select>
      <button disabled={!cart.length}><ShoppingBag size={18} /> Оформить заказ</button>
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
    <p>{user.email} · {user.role === 'admin' ? 'администратор' : 'покупатель'}</p>
    <h2>История заказов</h2>
    {orders.map((order) => <article className="order" key={order.id}><strong>#{order.id} {statusLabels[order.status]}</strong><span>{money(order.totalCents)}</span><p>{order.items.map((item) => item.productName ?? item.productId).join(', ')}</p></article>)}
    {!orders.length && <p>Заказов пока нет.</p>}
  </section>;
  return <section className="authGrid">
    <form className="panel" onSubmit={submitWith((form) => onLogin(form).catch((error) => setMessage(error.message)))}>
      <h2>Вход</h2>
      <input name="login" placeholder="Email или логин" defaultValue="admin" />
      <input name="password" type="password" placeholder="Пароль" defaultValue={token ? '' : 'admin'} />
      <button><Lock size={18} /> Войти</button>
    </form>
    <form className="panel" onSubmit={submitWith((form) => onRegister(form).catch((error) => setMessage(error.message)))}>
      <h2>Регистрация</h2>
      <input name="name" placeholder="Имя" />
      <input name="username" placeholder="Логин" />
      <input name="email" placeholder="Email" />
      <input name="password" type="password" placeholder="Пароль" />
      <button><UserRound size={18} /> Создать аккаунт</button>
    </form>
    <form className="panel" onSubmit={submitWith(async (form) => { const data = await api.forgot(String(form.get('email'))); setResetToken(data.token ?? ''); setMessage(data.token ? `Токен восстановления: ${data.token}` : 'Если пользователь существует, токен создан'); })}>
      <h2>Восстановление пароля</h2>
      <input name="email" placeholder="Email" />
      <button>Запросить токен</button>
      <input value={resetToken} onChange={(event) => setResetToken(event.target.value)} placeholder="Токен восстановления" />
      <input name="newPassword" type="password" placeholder="Новый пароль" />
      <button type="button" onClick={async () => { await api.reset(resetToken, (document.querySelector('[name=newPassword]') as HTMLInputElement).value); setMessage('Пароль обновлен'); }}>Сбросить пароль</button>
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
    setMessage('Товар сохранен');
  }
  return <section className="admin">
    <form className="panel" onSubmit={submitWith((form) => saveProduct(form).catch((error) => setMessage(error.message)))}>
      <h2>Новый товар</h2>
      <input name="name" placeholder="Название" required />
      <input name="category" placeholder="Категория" required />
      <input name="priceCents" type="number" placeholder="Цена в центах" required />
      <input name="stock" type="number" placeholder="Остаток" required />
      <input name="sizes" placeholder="Размеры через запятую" defaultValue="S,M,L" />
      <input name="imageUrl" placeholder="Локальный URL изображения" />
      <input name="externalImageUrl" placeholder="Внешний URL изображения" />
      <textarea name="description" placeholder="Описание" required />
      <label className="check"><input name="featured" type="checkbox" /> Избранное</label>
      <button><Plus size={18} /> Добавить товар</button>
    </form>
    <section className="adminList">
      <h2>Товары</h2>
      {products.map((product) => <div className="adminRow" key={product.id}>
        <span>{product.name}</span><strong>{money(product.priceCents)}</strong>
        <button aria-label="Удалить товар" onClick={async () => { await api.deleteProduct(product.id, token); await refreshProducts(); }}><Trash2 size={16} /></button>
      </div>)}
      <h2>Заказы</h2>
      {orders.map((order) => <div className="adminRow" key={order.id}>
        <span>#{order.id} {order.customerName}</span><strong>{money(order.totalCents)}</strong>
        <select value={order.status} onChange={async (event) => {
          const data = await api.updateOrder(order.id, event.target.value as Order['status'], token);
          setOrders((current) => current.map((entry) => entry.id === order.id ? data.order : entry));
        }}>{(['New', 'Confirmed', 'Shipped', 'Delivered'] as Order['status'][]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>
      </div>)}
    </section>
  </section>;
}

createRoot(document.getElementById('root')!).render(<App />);
