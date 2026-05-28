import { migrate } from './migrate';
import { pool } from './pool';
import { PgStore } from './pgStore';

const store = new PgStore();

const products = [
  ['Футболка Vibe Miner Core', 'vibe-miner-core-tee', 'Мягкая черная футболка для ночных забегов по шахтам и светящейся руды.', 'Одежда', 3200, '/assets/tshirt_vibe_miner.png', ['S', 'M', 'L', 'XL'], 30, true],
  ['Футболка Pixel Heart', 'pixel-heart-tee', 'Ретро-сердце здоровья на плотном хлопке.', 'Одежда', 2900, '/assets/tshirt_pixel_heart.png', ['S', 'M', 'L'], 24, true],
  ['Футболка Synthwave Respawn', 'synthwave-respawn-tee', 'Неоновый горизонт для вечеров в аркадном темпе.', 'Одежда', 3400, '/assets/tshirt_synthwave.png', ['M', 'L', 'XL'], 18, true],
  ['Футболка Game Over', 'game-over-tee', 'Чистая монохромная типографика для тех, кто всегда начинает заново.', 'Одежда', 2800, '/assets/tshirt_game_over.png', ['S', 'M', 'L', 'XL'], 22, false],
  ['Футболка Cyber Cat', 'cyber-cat-tee', 'Киберпанковский спутник для любителей инвентаря и скрытных билдов.', 'Одежда', 3300, '/assets/tshirt_cyber_cat.png', ['S', 'M', 'L'], 20, true],
  ['Футболка Loading Bar', 'loading-bar-tee', 'Минималистичная шутка с прогресс-баром для терпеливых гриндеров.', 'Одежда', 2700, '/assets/tshirt_loading_bar.png', ['S', 'M', 'L', 'XL'], 26, false],
  ['Футболка Retro Gamepad', 'retro-gamepad-tee', 'Линии старого контроллера на аккуратной повседневной футболке.', 'Одежда', 3100, '/assets/tshirt_retro_gamepad.png', ['M', 'L', 'XL'], 19, false],
  ['Футболка Glitch Skull', 'glitch-skull-tee', 'Настроение испорченного экрана босса с резкими пиксельными краями.', 'Одежда', 3500, '/assets/tshirt_glitch_skull.png', ['S', 'M', 'L'], 16, true],
  ['Футболка Space Invader', 'space-invader-tee', 'Маленькое построение пришельцев и большая аркадная ностальгия.', 'Одежда', 3000, '/assets/tshirt_space_invader.png', ['S', 'M', 'L', 'XL'], 28, false],
  ['Футболка D20 Dice', 'd20-dice-tee', 'Для настольных критов между инди-геймджемами.', 'Одежда', 3200, '/assets/tshirt_d20_dice.png', ['S', 'M', 'L'], 17, false],
  ['Постер Пещеры Vibe Miner', 'vibe-miner-cavern-poster', 'Матовый постер A2 с биолюминесцентными пещерами и одиноким шахтером.', 'Постеры', 1800, '/assets/tshirt_vibe_miner.png', ['A2'], 40, true],
  ['Постер Чертеж Двери Босса', 'boss-door-blueprint-poster', 'Настенный арт в стиле чертежа про невозможные двери и скрытые переключатели.', 'Постеры', 1600, '/assets/tshirt_game_over.png', ['A3', 'A2'], 32, false],
  ['Худи Neon Save Point', 'neon-save-point-hoodie', 'Теплое худи с маленькой вышитой иконкой точки сохранения.', 'Одежда', 6200, '/assets/tshirt_synthwave.png', ['S', 'M', 'L', 'XL'], 14, true],
  ['Кепка Inventory Grid', 'inventory-grid-cap', 'Низкая кепка с вышитыми пиксельными слотами инвентаря.', 'Аксессуары', 2400, '/assets/tshirt_retro_gamepad.png', ['One size'], 25, false],
  ['Набор стикеров Mana Potion', 'mana-potion-sticker-pack', 'Десять прочных виниловых стикеров для ноутбуков, деков и чехлов.', 'Аксессуары', 900, '/assets/tshirt_pixel_heart.png', ['Pack'], 80, false]
] as const;

async function upsertUsers() {
  const users = [
    { email: 'admin@gpt-shop.local', username: 'admin', password: 'admin', name: 'Администратор', role: 'admin' as const },
    { email: 'mira@example.com', username: 'mira', password: 'password', name: 'Mira Stone' },
    { email: 'pixel@example.com', username: 'pixelrunner', password: 'password', name: 'Pixel Runner' }
  ];
  for (const user of users) {
    const existing = await store.findUserByEmailOrUsername(user.username);
    if (!existing) {
      await store.createUser(user);
    } else {
      await pool.query('UPDATE users SET name = $1, role = $2 WHERE id = $3', [user.name, user.role ?? 'customer', existing.id]);
    }
  }
}

async function upsertProducts() {
  for (const [name, slug, description, category, priceCents, imageUrl, sizes, stock, featured] of products) {
    const existing = await pool.query('SELECT id FROM products WHERE slug = $1', [slug]);
    if (existing.rows[0]) {
      await store.updateProduct(existing.rows[0].id, { name, slug, description, category, priceCents, imageUrl, sizes: [...sizes], stock, featured });
    } else {
      await store.createProduct({ name, slug, description, category, priceCents, imageUrl, sizes: [...sizes], stock, featured });
    }
  }
}

async function seedOrders() {
  await pool.query("UPDATE orders SET payment_method = 'Тестовая карта' WHERE payment_method = 'Mock card'");
  await pool.query("UPDATE orders SET address = replace(address, 'Pixel Lane, Indie City', 'Пиксельная улица, Инди-Сити') WHERE address LIKE '%Pixel Lane, Indie City%'");
  const count = await pool.query('SELECT count(*)::int AS count FROM orders');
  if (count.rows[0].count >= 5) return;
  const user = await store.findUserByEmailOrUsername('mira');
  const allProducts = await store.listProducts();
  for (let i = 0; i < 5; i += 1) {
    const product = allProducts[i];
    const order = await store.createOrder({
      userId: user?.id,
      customerName: user?.name ?? 'Mira Stone',
      address: `${10 + i} Пиксельная улица, Инди-Сити`,
      phone: '+100000000',
      paymentMethod: 'Тестовая карта',
      items: [{ productId: product.id, size: product.sizes[0], quantity: 1 }]
    });
    await store.updateOrderStatus(order.id, 'Delivered');
  }
}

export async function seed() {
  await migrate();
  await upsertUsers();
  await upsertProducts();
  await seedOrders();
  await store.logEvent('seed_complete', { products: products.length });
}

if (require.main === module) {
  seed()
    .then(() => console.log('Seed complete'))
    .finally(() => pool.end());
}
