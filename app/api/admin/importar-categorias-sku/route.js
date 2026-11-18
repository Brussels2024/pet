import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().replace(/\\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length || rows.length > 5000) {
      return NextResponse.json({ error: 'Envie de 1 a 5.000 linhas de categorias.' }, { status: 400 });
    }

    const valid = [];
    for (let index = 0; index < rows.length; index++) {
      const sku = String(rows[index]?.sku ?? '').trim().slice(0, 100);
      const category = String(rows[index]?.category ?? '').trim().slice(0, 100);
      const subcategory = String(rows[index]?.subcategory ?? '').trim().slice(0, 100);
      if (!sku || !category) {
        return NextResponse.json({ error: 'Linha ' + (index + 2) + ': SKU e Categoria são obrigatórios.' }, { status: 400 });
      }
      valid.push({ sku, category, subcategory });
    }

    const categories = await query('SELECT id, name, parent_id FROM categories ORDER BY position, id');
    const categoryMap = new Map();
    for (const category of categories) {
      categoryMap.set((category.parent_id || 0) + '::' + normalize(category.name), category.id);
    }

    let linked = 0;
    let productsFound = 0;
    let categoriesCreated = 0;
    let subcategoriesCreated = 0;
    let notFound = 0;
    const details = [];
    const countedProducts = new Set();

    async function getOrCreateCategory(name, parentId) {
      const key = (parentId || 0) + '::' + normalize(name);
      if (categoryMap.has(key)) return categoryMap.get(key);
      const positionRows = await query(
        'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM categories WHERE parent_id IS NOT DISTINCT FROM $1::int',
        [parentId]
      );
      const inserted = await query(
        'INSERT INTO categories (name, parent_id, position, active) VALUES ($1, $2, $3, true) RETURNING id',
        [name, parentId, Number(positionRows[0]?.next) || 1]
      );
      const id = inserted[0]?.id;
      if (!id) throw new Error('Não foi possível criar a categoria: ' + name);
      categoryMap.set(key, id);
      if (parentId) subcategoriesCreated++;
      else categoriesCreated++;
      return id;
    }

    for (const row of valid) {
      const found = await query(
        'SELECT id FROM products WHERE lower(trim(sku)) = lower(trim($1)) AND trim(sku) <> $2 ORDER BY id LIMIT 1',
        [row.sku, '']
      );
      if (!found.length) {
        notFound++;
        if (details.length < 100) details.push(row.sku);
        continue;
      }
      const productId = Number(found[0].id);
      if (!countedProducts.has(productId)) {
        countedProducts.add(productId);
        productsFound++;
      }

      const categoryId = await getOrCreateCategory(row.category, null);
      const ids = [categoryId];
      if (row.subcategory) ids.push(await getOrCreateCategory(row.subcategory, categoryId));

      for (const categoryIdToLink of ids) {
        const inserted = await query(
          'INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2) ON CONFLICT (product_id, category_id) DO NOTHING RETURNING product_id',
          [productId, categoryIdToLink]
        );
        if (inserted.length) linked++;
      }
    }

    revalidatePath('/admin/produtos');
    revalidatePath('/admin/configuracoes/categorias');
    revalidatePath('/');
    return NextResponse.json({ linked, productsFound, categoriesCreated, subcategoriesCreated, notFound, details });
  } catch (error) {
    const message = error?.message || 'Não foi possível importar as categorias.';
    const status = /admin|autoriz/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
