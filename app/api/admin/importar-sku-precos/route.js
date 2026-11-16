import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function colorHex(name) {
  const key = normalize(name);
  if (key.includes('azul')) return key.includes('escuro') ? '#174a8b' : key.includes('claro') ? '#76b9ed' : '#2478d4';
  if (key.includes('rosa')) return '#e889b7';
  if (key.includes('vermelho')) return '#d93434';
  if (key.includes('preto')) return '#222222';
  if (key.includes('branco')) return '#f4f4f4';
  if (key.includes('roxo')) return '#853bb5';
  if (key.includes('laranja')) return '#f28b24';
  if (key.includes('amarelo')) return '#f1cf27';
  if (key.includes('verde')) return '#35a853';
  return '#888888';
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
    const existingProducts = await query('SELECT id, name, sku, stock FROM products');
    const productByKey = new Map(existingProducts.map((p) => [normalize(p.sku) + '::' + normalize(p.name), p]));
    const existingColors = await query('SELECT id, product_id, name, sku, hex, stock, min_stock, position FROM product_colors ORDER BY position, id');
    const colorsByProduct = new Map();
    for (const color of existingColors) {
      if (!colorsByProduct.has(color.product_id)) colorsByProduct.set(color.product_id, []);
      colorsByProduct.get(color.product_id).push(color);
    }

    const seen = new Set();
    const details = [];
    let created = 0, updated = 0, invalid = 0, categoriesCreated = 0, variantsCreated = 0;

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

      const values = [name, sku, price.toFixed(2), packagePrice.toFixed(2), minQuantity, categoryId];
      let productId;
      let initialStock = 1000;
      const existing = productByKey.get(productKey);
      if (existing) {
        productId = existing.id;
        initialStock = Math.max(0, Number(existing.stock) || 0);
        await query(
          'UPDATE products SET name = $1, sku = $2, price = $3, package_price = $4, min_quantity = $5, category_id = $6 WHERE id = $7',
          [...values, productId]
        );
        updated++;
      } else {
        const inserted = await query(
          'INSERT INTO products (name, sku, price, package_price, min_quantity, stock, image_url, category_id, active) VALUES ($1, $2, $3, $4, $5, 1000, NULL, $6, true) RETURNING id',
          values
        );
        productId = inserted[0]?.id;
        if (!productId) throw new Error('Não foi possível cadastrar o produto: ' + name);
        created++;
      }

      // Não substitui variantes já cadastradas. Se o produto ainda não tem cores, cria
      // as opções da tabela e distribui o estoque total existente entre elas.
      const savedColors = colorsByProduct.get(productId) || [];
      if (colors.length && savedColors.length === 0) {
        const base = Math.floor(initialStock / colors.length);
        let remainder = initialStock - base * colors.length;
        for (let index = 0; index < colors.length; index++) {
          const colorName = colors[index];
          const stock = base + (remainder-- > 0 ? 1 : 0);
          const colorSku = (sku + '-' + normalize(colorName).replace(/[^a-z0-9]+/g, '-')).slice(0, 80);
          await query(
            'INSERT INTO product_colors (product_id, name, sku, hex, stock, min_stock, position) VALUES ($1, $2, $3, $4, $5, 0, $6)',
            [productId, colorName, colorSku, colorHex(colorName), stock, index + 1]
          );
          variantsCreated++;
        }
      }
    }

    revalidatePath('/admin/produtos');
    revalidatePath('/admin/configuracoes/categorias');
    revalidatePath('/');
    return NextResponse.json({ total: rows.length, created, updated, invalid, categoriesCreated, variantsCreated, details });
  } catch (error) {
    const message = error?.message || 'Não foi possível importar a planilha.';
    const status = /admin|autoriz/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
