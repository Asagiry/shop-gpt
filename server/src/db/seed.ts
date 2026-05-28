import { migrate } from './migrate';
import { pool } from './pool';
import { PgStore } from './pgStore';

const store = new PgStore();

const products = [
  ['Vibe Miner Core Tee', 'vibe-miner-core-tee', 'A soft black tee for late-night cave runs and luminous ore finds.', 'Apparel', 3200, '/assets/tshirt_vibe_miner.png', ['S', 'M', 'L', 'XL'], 30, true],
  ['Pixel Heart Tee', 'pixel-heart-tee', 'Retro health pickup energy printed on heavyweight cotton.', 'Apparel', 2900, '/assets/tshirt_pixel_heart.png', ['S', 'M', 'L'], 24, true],
  ['Synthwave Respawn Tee', 'synthwave-respawn-tee', 'Neon horizon colors for arcade-speed evenings.', 'Apparel', 3400, '/assets/tshirt_synthwave.png', ['M', 'L', 'XL'], 18, true],
  ['Game Over Tee', 'game-over-tee', 'Crisp monochrome type for players who always queue again.', 'Apparel', 2800, '/assets/tshirt_game_over.png', ['S', 'M', 'L', 'XL'], 22, false],
  ['Cyber Cat Tee', 'cyber-cat-tee', 'A cyberpunk familiar for inventory tinkerers and stealth builds.', 'Apparel', 3300, '/assets/tshirt_cyber_cat.png', ['S', 'M', 'L'], 20, true],
  ['Loading Bar Tee', 'loading-bar-tee', 'Minimalist progress-bar humor for patient grinders.', 'Apparel', 2700, '/assets/tshirt_loading_bar.png', ['S', 'M', 'L', 'XL'], 26, false],
  ['Retro Gamepad Tee', 'retro-gamepad-tee', 'Old-school controller lines on a clean everyday shirt.', 'Apparel', 3100, '/assets/tshirt_retro_gamepad.png', ['M', 'L', 'XL'], 19, false],
  ['Glitch Skull Tee', 'glitch-skull-tee', 'Corrupted boss-screen attitude with sharp pixel edges.', 'Apparel', 3500, '/assets/tshirt_glitch_skull.png', ['S', 'M', 'L'], 16, true],
  ['Space Invader Tee', 'space-invader-tee', 'Tiny alien formation, big cabinet nostalgia.', 'Apparel', 3000, '/assets/tshirt_space_invader.png', ['S', 'M', 'L', 'XL'], 28, false],
  ['D20 Dice Tee', 'd20-dice-tee', 'For tabletop crits between indie game jams.', 'Apparel', 3200, '/assets/tshirt_d20_dice.png', ['S', 'M', 'L'], 17, false],
  ['Vibe Miner Cavern Poster', 'vibe-miner-cavern-poster', 'Matte A2 poster with bioluminescent caverns and a lone miner.', 'Posters', 1800, '/assets/tshirt_vibe_miner.png', ['A2'], 40, true],
  ['Boss Door Blueprint Poster', 'boss-door-blueprint-poster', 'Blueprint-style wall art for impossible doors and hidden switches.', 'Posters', 1600, '/assets/tshirt_game_over.png', ['A3', 'A2'], 32, false],
  ['Neon Save Point Hoodie', 'neon-save-point-hoodie', 'Warm pullover with a tiny embroidered save point glyph.', 'Apparel', 6200, '/assets/tshirt_synthwave.png', ['S', 'M', 'L', 'XL'], 14, true],
  ['Inventory Grid Cap', 'inventory-grid-cap', 'Low-profile cap with stitched pixel inventory slots.', 'Accessories', 2400, '/assets/tshirt_retro_gamepad.png', ['One size'], 25, false],
  ['Mana Potion Sticker Pack', 'mana-potion-sticker-pack', 'Ten durable vinyl stickers for laptops, decks, and cases.', 'Accessories', 900, '/assets/tshirt_pixel_heart.png', ['Pack'], 80, false]
] as const;

async function upsertUsers() {
  const users = [
    { email: 'admin@gpt-shop.local', username: 'admin', password: 'admin', name: 'Admin', role: 'admin' as const },
    { email: 'mira@example.com', username: 'mira', password: 'password', name: 'Mira Stone' },
    { email: 'pixel@example.com', username: 'pixelrunner', password: 'password', name: 'Pixel Runner' }
  ];
  for (const user of users) {
    const existing = await store.findUserByEmailOrUsername(user.username);
    if (!existing) await store.createUser(user);
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
  const count = await pool.query('SELECT count(*)::int AS count FROM orders');
  if (count.rows[0].count >= 5) return;
  const user = await store.findUserByEmailOrUsername('mira');
  const allProducts = await store.listProducts();
  for (let i = 0; i < 5; i += 1) {
    const product = allProducts[i];
    const order = await store.createOrder({
      userId: user?.id,
      customerName: user?.name ?? 'Mira Stone',
      address: `${10 + i} Pixel Lane, Indie City`,
      phone: '+100000000',
      paymentMethod: 'Mock card',
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
