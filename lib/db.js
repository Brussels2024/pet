import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

function client() {
  const url = connectionString();
  if (!url) throw new Error('DATABASE_URL não configurada na Vercel.');
  return neon(url);
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cliente',
    session_version INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendente',
    razao_social TEXT,
    nome_fantasia TEXT,
    cnpj TEXT UNIQUE,
    telefone TEXT,
    cep TEXT,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    uf TEXT,
    situacao_cnpj TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS security_rate_limits (
    fingerprint TEXT PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS security_rate_limits_window_idx ON security_rate_limits(window_started_at)`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS password_resets_user_created_idx ON password_resets(user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS recovery_attempts (
    id SERIAL PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS recovery_attempts_fingerprint_created_idx ON recovery_attempts(fingerprint, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS priority BOOLEAN NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS product_colors (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT NOT NULL DEFAULT '',
    hex TEXT NOT NULL DEFAULT '#888888',
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS product_colors_product_idx ON product_colors(product_id, position, id)`,
  `CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(product_id, position)
  )`,
  `CREATE TABLE IF NOT EXISTS banners (
    id SERIAL PRIMARY KEY,
    position INTEGER NOT NULL UNIQUE CHECK (position BETWEEN 1 AND 3),
    title TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'novo',
    payment_method TEXT,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    shipping NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'PENDING'`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_key TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_key_unique ON orders (checkout_key) WHERE checkout_key IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('checkout_pending', 'purchase_paid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(order_id, event_type)
  )`,
  `CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
    id SERIAL PRIMARY KEY,
    endpoint TEXT NOT NULL UNIQUE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS asaas_webhook_events (
    event_id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    payment_id TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER,
    name TEXT NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    qty INTEGER NOT NULL
  )`,
  `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color_id INTEGER`,
  `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color_name TEXT`,
  `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color_sku TEXT`,
  `CREATE TABLE IF NOT EXISTS shipping_cities (id SERIAL PRIMARY KEY, city TEXT NOT NULL, uf TEXT NOT NULL DEFAULT 'SP', free_shipping BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS shipping_cities_city_uf_unique ON shipping_cities (lower(city), upper(uf))`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB`,
  `INSERT INTO shipping_cities (city, uf, free_shipping) VALUES
    ('Aguaí', 'SP', false),
    ('Águas da Prata', 'SP', false),
    ('Águas de Lindóia', 'SP', false),
    ('Águas de São Pedro', 'SP', false),
    ('Americana', 'SP', false),
    ('Amparo', 'SP', false),
    ('Analândia', 'SP', false),
    ('Araras', 'SP', false),
    ('Artur Nogueira', 'SP', false),
    ('Caconde', 'SP', false),
    ('Campinas', 'SP', false),
    ('Capivari', 'SP', false),
    ('Casa Branca', 'SP', false),
    ('Charqueada', 'SP', false),
    ('Conchal', 'SP', false),
    ('Cordeirópolis', 'SP', false),
    ('Corumbataí', 'SP', false),
    ('Cosmópolis', 'SP', false),
    ('Descalvado', 'SP', false),
    ('Divinolândia', 'SP', false),
    ('Elias Fausto', 'SP', false),
    ('Engenheiro Coelho', 'SP', false),
    ('Espírito Santo do Pinhal', 'SP', false),
    ('Estiva Gerbi', 'SP', false),
    ('Holambra', 'SP', false),
    ('Hortolândia', 'SP', false),
    ('Indaiatuba', 'SP', false),
    ('Ipeúna', 'SP', false),
    ('Iracemápolis', 'SP', false),
    ('Itapira', 'SP', false),
    ('Itirapina', 'SP', false),
    ('Itobi', 'SP', false),
    ('Jaguariúna', 'SP', false),
    ('Leme', 'SP', false),
    ('Limeira', 'SP', false),
    ('Lindóia', 'SP', false),
    ('Louveira', 'SP', false),
    ('Mococa', 'SP', false),
    ('Mogi Guaçu', 'SP', false),
    ('Mogi Mirim', 'SP', false),
    ('Mombuca', 'SP', false),
    ('Monte Alegre do Sul', 'SP', false),
    ('Monte Mor', 'SP', false),
    ('Nova Odessa', 'SP', false),
    ('Paulínia', 'SP', false),
    ('Pedreira', 'SP', false),
    ('Piracicaba', 'SP', false),
    ('Pirassununga', 'SP', false),
    ('Porto Ferreira', 'SP', false),
    ('Rafard', 'SP', false),
    ('Rio Claro', 'SP', false),
    ('Rio das Pedras', 'SP', false),
    ('Saltinho', 'SP', false),
    ('Santa Bárbara d''Oeste', 'SP', false),
    ('Santa Cruz da Conceição', 'SP', false),
    ('Santa Cruz das Palmeiras', 'SP', false),
    ('Santa Gertrudes', 'SP', false),
    ('Santa Maria da Serra', 'SP', false),
    ('Santa Rita do Passa Quatro', 'SP', false),
    ('Santo Antônio de Posse', 'SP', false),
    ('Santo Antônio do Jardim', 'SP', false),
    ('São João da Boa Vista', 'SP', false),
    ('São José do Rio Pardo', 'SP', false),
    ('São Pedro', 'SP', false),
    ('São Sebastião da Grama', 'SP', false),
    ('Serra Negra', 'SP', false),
    ('Socorro', 'SP', false),
    ('Sumaré', 'SP', false),
    ('Tambaú', 'SP', false),
    ('Tapiratiba', 'SP', false),
    ('Valinhos', 'SP', false),
    ('Vargem Grande do Sul', 'SP', false),
    ('Vinhedo', 'SP', false)
   ON CONFLICT DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
  `INSERT INTO settings (key, value) VALUES ('min_order', '300') ON CONFLICT (key) DO NOTHING`,
  `INSERT INTO settings (key, value) VALUES ('whatsapp', '') ON CONFLICT (key) DO NOTHING`,
];

async function createSchema() {
  const sql = client();
  for (const stmt of SCHEMA) {
    await sql.query(stmt);
  }
  // Administrador inicial: só é criado se ADMIN_EMAIL e ADMIN_PASSWORD existirem na Vercel.
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (email && password) {
    const found = await sql.query('SELECT id FROM users WHERE email = $1', [email]);
    if (found.length === 0) {
      const hash = await bcrypt.hash(password, 12);
      await sql.query(
        `INSERT INTO users (email, password_hash, role, status, razao_social)
         VALUES ($1, $2, 'admin', 'ativo', 'Administrador')`,
        [email, hash]
      );
    }
  }
}

export async function ensureSchema() {
  if (!globalThis.__bpSchema) {
    globalThis.__bpSchema = createSchema().catch((err) => {
      globalThis.__bpSchema = null;
      throw err;
    });
  }
  return globalThis.__bpSchema;
}

export async function query(text, params = []) {
  await ensureSchema();
  return client().query(text, params);
}

export async function getSetting(key, fallback = '') {
  const rows = await query('SELECT value FROM settings WHERE key = $1', [key]);
  return rows.length ? rows[0].value ?? fallback : fallback;
}
