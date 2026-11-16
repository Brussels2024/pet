import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length || rows.length > 5000) {
      return NextResponse.json({ error: 'Envie uma planilha com 1 a 5.000 produtos.' }, { status: 400 });
    }

    const categoryRows = await query('SELECT id, name, parent_id FROM categories ORDER BY position, id');
    const categoryByName = new Map(categoryRows.filter((c) => !c.parent_id).map((c) => [normalize(c.name), c.id]));
    const seen = new Set();
    const details = [];
    let created = 0, updated = 0, invalid = 0, categoriesCreated = 0;

    for (const row of rows) {
      const name = String(row?.name ?? '').trim().slice(0, 180);
      const sku = String(row?.sku ?? '').trim().slice(0, 100);
      const categoryName = String(row?.category ?? '').trim().slice(0, 100);
      const price = Number(row?.price);
      const packagePrice = Number(row?.packagePrice);
      const minQuantity = Number(row?.minQuantity);
      const colors = Array.isArray(row?.colors)
        ? [...new Set(row.colors.map((c) => String(c).trim()).filter(Boolean))].slice(0, 30)
        : [];

      if (!name || !sku || !categoryName ||
          !Number.isFinite(price) || price < 0 || price > 9999999999 ||
          !Number.isFinite(packagePrice) || packagePrice < 0 || packagePrice > 9999999999 ||
          !Number.isSafeInteger(minQuantity) || minQuantity < 1 || minQuantity > 100000) {
        invalid++;
        if (details.length < 100) details.push({ name: name || '(sem nome)', reason: 'Nome, SKU, categoria, preço unitário, preço do pacote ou quantidade mínima inválidos.' });
        continue;
      }

      const productKey = normalize(sku) + '::' + normalize(name);
      if (seen.has(productKey)) {
        invalid++;
        if (details.length < 100) details.push({ name, reason: 'Produto repetido no arquivo (mesmo nome e SKU).' });
        continue;
      }
      seen.add(productKey);

      const categoryKey = normalize(categoryName);
      let categoryId = categoryByName.get(categoryKey);
      if (!categoryId) {
        const positionRows = await query('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM categories WHERE parent_id IS NULL');
        const insertedCategory = await query(
          'INSERT INTO categories (name, parent_id, position) VALUES ($1, NULL, $2) RETURNING id',
          [categoryName, Number(positionRows[0]?.next) || 1]
        );
        categoryId = insertedCategory[0]?.id;
        if (!categoryId) throw new Error('Não foi possível criar a categoria: ' + categoryName);
        categoryByName.set(categoryKey, categoryId);
        categoriesCreated++;
      }

      const existing = await query(
        'SELECT id FROM products WHERE lower(trim(sku)) = lower(trim($1)) AND lower(trim(name)) = lower(trim($2)) ORDER BY id LIMIT 1',
        [sku, name]
      );
      if (existing.length) {
        // Mantém estoque atual e fotos já cadastradas em atualizações futuras da planilha.
        await query(
          'UPDATE products SET name = $1, sku = $2, price = $3, package_price = $4, min_quantity = $5, colors = $6::jsonb, category_id = $7 WHERE id = $8',
          [name, sku, price.toFixed(2), packagePrice.toFixed(2), minQuantity, JSON.stringify(colors), categoryId, existing[0].id]
        );
        updated++;
      } else {
        // Todo produto novo começa com 1.000 unidades; imagens ficam vazias para inclusão posterior.
        await query(
          'INSERT INTO products (name, sku, price, package_price, min_quantity, colors, stock, image_url, category_id, active) VALUES ($1, $2, $3, $4, $5, $6::jsonb, 1000, NULL, $7, true)',
          [name, sku, price.toFixed(2), packagePrice.toFixed(2), minQuantity, JSON.stringify(colors), categoryId]
        );
        created++;
      }
    }

    revalidatePath('/admin/produtos');
    revalidatePath('/admin/configuracoes/categorias');
    revalidatePath('/');
    return NextResponse.json({ total: rows.length, created, updated, invalid, categoriesCreated, details });
  } catch (error) {
    const message = error?.message || 'Não foi possível importar a planilha.';
    const status = /admin|autoriz/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
