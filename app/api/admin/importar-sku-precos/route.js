import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().replace(/\\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length || rows.length > 5000) {
      return NextResponse.json({ error: 'Envie uma planilha com 1 a 5.000 linhas.' }, { status: 400 });
    }

    const products = await query('SELECT id, name FROM products');
    const byName = new Map();
    for (const product of products) {
      const key = normalize(product.name);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(product);
    }

    const categoryRows = await query('SELECT id, name, parent_id FROM categories ORDER BY position, id');
    const categoryByName = new Map();
    for (const category of categoryRows) {
      if (category.parent_id) continue;
      const key = normalize(category.name);
      if (!categoryByName.has(key)) categoryByName.set(key, category.id);
    }

    const seen = new Set();
    const details = [];
    let updated = 0, notFound = 0, ambiguous = 0, invalid = 0, categoriesCreated = 0;

    for (const row of rows) {
      const name = String(row?.name ?? '').trim().slice(0, 180);
      const sku = String(row?.sku ?? '').trim().slice(0, 100);
      const categoryName = String(row?.category ?? '').trim().slice(0, 100);
      const price = Number(row?.price);
      const stock = Number(row?.stock);
      const key = normalize(name);

      if (!name || !sku || !categoryName ||
          row?.price === null || row?.price === undefined || row?.price === '' ||
          !Number.isFinite(price) || price < 0 || price > 9999999999 ||
          !Number.isSafeInteger(stock) || stock < 0) {
        invalid++;
        if (details.length < 100) details.push({ name: name || '(sem nome)', reason: 'Nome, SKU, preço, estoque ou categoria inválidos' });
        continue;
      }

      if (seen.has(key)) {
        invalid++;
        if (details.length < 100) details.push({ name, reason: 'Nome repetido no arquivo' });
        continue;
      }
      seen.add(key);

      const matches = byName.get(key) || [];
      if (!matches.length) {
        notFound++;
        if (details.length < 100) details.push({ name, reason: 'Produto não encontrado no cadastro; não foi criado' });
        continue;
      }
      if (matches.length > 1) {
        ambiguous++;
        if (details.length < 100) details.push({ name, reason: 'Há mais de um produto com esse nome no cadastro; nenhum foi alterado' });
        continue;
      }

      const categoryKey = normalize(categoryName);
      let categoryId = categoryByName.get(categoryKey);
      if (!categoryId) {
        const positionRows = await query(
          'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM categories WHERE parent_id IS NULL'
        );
        const created = await query(
          'INSERT INTO categories (name, parent_id, position) VALUES ($1, NULL, $2) RETURNING id',
          [categoryName, Number(positionRows[0]?.next) || 1]
        );
        categoryId = created[0]?.id;
        if (!categoryId) throw new Error('Não foi possível criar a categoria: ' + categoryName);
        categoryByName.set(categoryKey, categoryId);
        categoriesCreated++;
      }

      await query(
        'UPDATE products SET sku = $1, price = $2, stock = $3, category_id = $4 WHERE id = $5',
        [sku, price.toFixed(2), stock, categoryId, matches[0].id]
      );
      updated++;
    }

    revalidatePath('/admin/produtos');
    revalidatePath('/admin/configuracoes/categorias');
    revalidatePath('/');
    return NextResponse.json({ updated, notFound, ambiguous, invalid, categoriesCreated, details });
  } catch (error) {
    const message = error?.message || 'Não foi possível importar a planilha.';
    const status = /admin|autoriz/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
