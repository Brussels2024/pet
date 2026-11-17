'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

const text = (formData, key) => String(formData.get(key) ?? '').trim();
const num = (formData, key) => Number(String(formData.get(key) ?? '').replace(',', '.')) || 0;

/* ---------- Clientes ---------- */

export async function setUserStatus(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  const status = text(formData, 'status');
  if (!id || !['ativo', 'pendente', 'bloqueado'].includes(status)) return;
  await query("UPDATE users SET status = $1 WHERE id = $2 AND role = 'cliente'", [status, id]);
  revalidatePath('/admin/clientes');
}

/* ---------- Banners ---------- */

export async function saveBanner(formData) {
  await requireAdmin();
  const position = Math.floor(Number(formData.get('position')));
  const title = text(formData, 'title');
  const imageUrl = text(formData, 'image_url');
  const active = formData.get('active') === 'on';

  if (![1, 2, 3].includes(position)) return;
  if (!imageUrl) {
    await query('DELETE FROM banners WHERE position = $1', [position]);
    revalidatePath('/admin/banners');
    revalidatePath('/');
    return;
  }
  if (imageUrl.length > 1500000) return;
  if (!/^data:image\/(webp|jpeg|png|gif);base64,/.test(imageUrl) && !/^https?:\/\//i.test(imageUrl)) return;

  await query(
    `INSERT INTO banners (position, title, image_url, active)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (position) DO UPDATE
       SET title = EXCLUDED.title,
           image_url = EXCLUDED.image_url,
           active = EXCLUDED.active,
           updated_at = now()`,
    [position, title, imageUrl, active]
  );
  revalidatePath('/admin/banners');
  revalidatePath('/');
}

export async function deleteBanner(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!id) return;
  await query('DELETE FROM banners WHERE id = $1', [id]);
  revalidatePath('/admin/banners');
  revalidatePath('/');
}

/* ---------- Produtos ---------- */

export async function saveProduct(formData) {
  await requireAdmin();
  const id = Number(formData.get('id')) || null;
  const name = text(formData, 'name');
  if (!name) return;

  const images = [];
  for (let i = 1; i <= 6; i++) {
    const key = i === 1 ? 'image_url' : 'product_image_' + i;
    const value = text(formData, key);
    if (!value) continue;
    if (value.length > 700000) return;
    const validImageData = ['data:image/webp;base64,', 'data:image/jpeg;base64,', 'data:image/png;base64,'].some((prefix) => value.startsWith(prefix));
    const validImageUrl = value.startsWith('https://') || value.startsWith('http://');
    if (!validImageData && !validImageUrl) return;
    images.push(value);
  }
  const cover = images[0] || '';
  const sku = text(formData, 'sku');
  let colors = [];
  try {
    const raw = JSON.parse(text(formData, 'colors_json') || '[]');
    colors = (Array.isArray(raw) ? raw : []).map((item) => {
      const colorName = String(item?.name || '').trim().slice(0, 60);
      const abbreviation = String(item?.abbreviation || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      if (!colorName) return null;
      const suffix = abbreviation || colorName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2);
      return { name: colorName, abbreviation: suffix, sku: sku ? sku + '-' + suffix : '' };
    }).filter(Boolean).slice(0, 40);
  } catch { return; }

  const categoryIds = [...new Set(formData.getAll('category_ids').map(Number).filter((value) => Number.isInteger(value) && value > 0))];
  const values = [
    name, text(formData, 'description'), sku,
    num(formData, 'price').toFixed(2),
    Math.max(0, Math.floor(num(formData, 'stock'))),
    cover, categoryIds[0] || null,
    formData.get('active') === 'on',
    formData.get('priority') === 'on',
    JSON.stringify(colors),
  ];

  let productId = id;
  if (id) {
    await query(
      `UPDATE products
          SET name = $1, description = $2, sku = $3, price = $4, stock = $5,
              image_url = $6, category_id = $7, active = $8, priority = $9, colors = $10::jsonb
        WHERE id = $11`,
      [...values, id]
    );
  } else {
    const inserted = await query(
      `INSERT INTO products (name, description, sku, price, stock, image_url, category_id, active, priority, colors)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb) RETURNING id`,
      values
    );
    productId = inserted[0]?.id;
  }
  if (!productId) throw new Error('Não foi possível salvar o produto.');

  await query('DELETE FROM product_categories WHERE product_id = $1', [productId]);
  for (const categoryId of categoryIds) {
    await query('INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [productId, categoryId]);
  }
  await query('DELETE FROM product_images WHERE product_id = $1', [productId]);
  for (let i = 0; i < images.length; i++) {
    await query('INSERT INTO product_images (product_id, image_url, position) VALUES ($1, $2, $3)', [productId, images[i], i + 1]);
  }
  revalidatePath('/admin/produtos');
  revalidatePath('/admin/vitrines');
  revalidatePath('/');
  revalidatePath('/produto/' + productId);
  redirect('/admin/produtos');
}

export async function setStock(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!id) return;
  await query('UPDATE products SET stock = $1 WHERE id = $2', [
    Math.max(0, Math.floor(num(formData, 'stock'))),
    id,
  ]);
  revalidatePath('/admin/produtos');
  revalidatePath('/');
}

/* ---------- Categorias ---------- */

export async function createCategory(formData) {
  await requireAdmin();
  const name = text(formData, 'name');
  const parentId = Number(formData.get('parent_id')) || null;
  if (!name) return;
  const rows = await query(
    'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM categories WHERE parent_id IS NOT DISTINCT FROM $1::int',
    [parentId]
  );
  await query('INSERT INTO categories (name, parent_id, position) VALUES ($1, $2, $3)', [
    name,
    parentId,
    rows[0].next,
  ]);
  revalidatePath('/admin/configuracoes/categorias');
  revalidatePath('/');
}

export async function renameCategory(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  const name = text(formData, 'name');
  if (!id || !name) return;
  await query('UPDATE categories SET name = $1 WHERE id = $2', [name, id]);
  revalidatePath('/admin/configuracoes/categorias');
  revalidatePath('/');
}

export async function toggleCategory(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!id) return;
  await query('UPDATE categories SET active = NOT active WHERE id = $1', [id]);
  revalidatePath('/admin/configuracoes/categorias');
  revalidatePath('/');
}

export async function moveCategory(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  const dir = text(formData, 'dir');
  const found = await query('SELECT id, parent_id FROM categories WHERE id = $1', [id]);
  if (!found.length) return;

  const siblings = await query(
    'SELECT id FROM categories WHERE parent_id IS NOT DISTINCT FROM $1::int ORDER BY position, name, id',
    [found[0].parent_id]
  );
  const ids = siblings.map((s) => s.id);
  const index = ids.indexOf(id);
  const target = dir === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) return;

  [ids[index], ids[target]] = [ids[target], ids[index]];
  for (let i = 0; i < ids.length; i++) {
    await query('UPDATE categories SET position = $1 WHERE id = $2', [i + 1, ids[i]]);
  }
  revalidatePath('/admin/configuracoes/categorias');
  revalidatePath('/');
}

// Apagar a categoria NÃO apaga produtos: eles apenas ficam sem categoria.
export async function deleteCategory(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!id) return;
  await query('DELETE FROM categories WHERE id = $1', [id]);
  revalidatePath('/admin/configuracoes/categorias');
  revalidatePath('/');
}

/* ---------- Pedidos ---------- */

export async function setOrderStatus(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  const status = text(formData, 'status');
  const allowed = ['novo', 'confirmado', 'pago', 'enviado', 'entregue', 'cancelado'];
  if (!id || !allowed.includes(status)) return;
  await query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
  revalidatePath('/admin/pedidos');
}

/* ---------- Configurações ---------- */

export async function saveSettings(formData) {
  await requireAdmin();
  const minOrder = Math.max(0, num(formData, 'min_order')).toFixed(2);
  const whatsapp = text(formData, 'whatsapp').replace(/\D/g, '');
  await query(
    `INSERT INTO settings (key, value) VALUES ('min_order', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [minOrder]
  );
  await query(
    `INSERT INTO settings (key, value) VALUES ('whatsapp', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [whatsapp]
  );
  revalidatePath('/admin/configuracoes');
  revalidatePath('/');
}


/* ---------- Cidades com frete grátis ---------- */
export async function addShippingCity(formData) {
  await requireAdmin();
  const city = text(formData, 'city').replace(/\\s+/g, ' ').slice(0, 100);
  const uf = text(formData, 'uf').toUpperCase().slice(0, 2);
  if (!city || !/^[A-Z]{2}$/.test(uf)) return;
  await query('INSERT INTO shipping_cities (city, uf, free_shipping) VALUES ($1, $2, false) ON CONFLICT DO NOTHING', [city, uf]);
  revalidatePath('/admin/configuracoes/frete');
}
export async function toggleShippingCity(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id) || id < 1) return;
  await query('UPDATE shipping_cities SET free_shipping = NOT free_shipping WHERE id = $1', [id]);
  revalidatePath('/admin/configuracoes/frete');
}
export async function deleteShippingCity(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id) || id < 1) return;
  await query('DELETE FROM shipping_cities WHERE id = $1', [id]);
  revalidatePath('/admin/configuracoes/frete');
}


/* ---------- Vitrines por linha ---------- */
export async function createFeaturedCollection(formData) {
  await requireAdmin();
  const title = text(formData, 'title').slice(0, 80);
  if (!title) return;
  const rows = await query('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM featured_collections');
  await query('INSERT INTO featured_collections (title, position, active) VALUES ($1, $2, true)', [title, rows[0].next]);
  revalidatePath('/admin/vitrines');
  revalidatePath('/');
}

export async function saveFeaturedCollection(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  const title = text(formData, 'title').slice(0, 80);
  const active = formData.get('active') === 'on';
  if (!Number.isInteger(id) || id < 1 || !title) return;
  const exists = await query('SELECT id FROM featured_collections WHERE id = $1', [id]);
  if (!exists.length) return;
  const productIds = [...new Set(formData.getAll('product_ids').map(Number).filter((value) => Number.isInteger(value) && value > 0))];
  await query('UPDATE featured_collections SET title = $1, active = $2 WHERE id = $3', [title, active, id]);
  await query('DELETE FROM featured_collection_products WHERE collection_id = $1', [id]);
  for (let i = 0; i < productIds.length; i++) {
    await query(
      'INSERT INTO featured_collection_products (collection_id, product_id, position) SELECT $1, id, $3 FROM products WHERE id = $2 AND active = true ON CONFLICT (collection_id, product_id) DO NOTHING',
      [id, productIds[i], i + 1]
    );
  }
  revalidatePath('/admin/vitrines');
  revalidatePath('/');
}

export async function deleteFeaturedCollection(formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id) || id < 1) return;
  await query('DELETE FROM featured_collections WHERE id = $1', [id]);
  revalidatePath('/admin/vitrines');
  revalidatePath('/');
}


/* ---------- Categorias em destaque na página inicial ---------- */
export async function saveFeaturedCategories(formData) {
  await requireAdmin();
  const categoryIds = [...new Set(formData.getAll('category_ids').map(Number).filter((value) => Number.isInteger(value) && value > 0))];
  await query('DELETE FROM featured_categories');
  for (let i = 0; i < categoryIds.length; i++) {
    await query(
      'INSERT INTO featured_categories (category_id, position, active) SELECT id, $2, true FROM categories WHERE id = $1 AND active = true ON CONFLICT (category_id) DO UPDATE SET position = EXCLUDED.position, active = true',
      [categoryIds[i], i + 1]
    );
  }
  revalidatePath('/admin/vitrines');
  revalidatePath('/');
}
