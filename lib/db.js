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
  `CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER,
    name TEXT NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    qty INTEGER NOT NULL
  )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'PENDING'`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_key TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_key_unique ON orders (checkout_key) WHERE checkout_key IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS asaas_webhook_events (
    event_id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    payment_id TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS olist_stock_events (
    event_id TEXT PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS olist_product_id TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS olist_order_id TEXT`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS olist_sync_status TEXT NOT NULL DEFAULT 'not_configured'`,
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
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (email && password) {
    const found = await sql.query('SELECT id FROM users WHERE email = $1', [email]);
    if (found.length === 0) {
      const hash = bcrypt.hashSync(password, 10);
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
