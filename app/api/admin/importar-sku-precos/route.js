import { NextResponse } from 'next/server';
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
    if (!rows.length || rows.length > 5000) return NextResponse.json({ error: 'Envie uma planilha com 1 a 5.000 linhas.' }, { status: 400 });
    const products = await query('SELECT id, name FROM products');
    const byName = new Map();
    for (const product of products) {
      const key = normalize(product.name);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(product);
    }
    const seen = new Set(), details = [];
    let updated = 0, notFound = 0, ambiguous = 0, invalid = 0;
    for (const row of rows) {
      const name = String(row?.name ?? '').trim().slice(0, 180);
      const sku = String(row?.sku ?? '').trim().slice(0, 100);
      const price = Number(row?.price), key = normalize(name);
      if (!name || !sku || !Number.isFinite(price) || price < 0 || price > 9999999999) {
        invalid++; if (details.length < 100) details.push({ name: name || '(sem nome)', reason: 'Nome, SKU ou preço inválido' }); continue;
      }
      if (seen.has(key)) {
        invalid++; if (details.length < 100) details.push({ name, reason: 'Nome repetido no arquivo' }); continue;
      }
      seen.add(key);
      const matches = byName.get(key) || [];
      if (!matches.length) { notFound++; if (details.length < 100) details.push({ name, reason: 'Produto não encontrado no cadastro' }); continue; }
      if (matches.length > 1) { ambiguous++; if (details.length < 100) details.push({ name, reason: 'Há mais de um produto com esse nome no cadastro' }); continue; }
      await query('UPDATE products SET sku = $1, price = $2 WHERE id = $3', [sku, price.toFixed(2), matches[0].id]);
      updated++;
    }
    return NextResponse.json({ updated, notFound, ambiguous, invalid, details });
  } catch (error) {
    const message = error?.message || 'Não foi possível importar SKU e preços.';
    const status = /admin|autoriz/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
