import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
function abbreviation(name) {
  const parts = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().match(/[A-Z0-9]+/g) || [];
  if (!parts.length) return '';
  return (parts.length > 1 ? parts.map((part) => part[0]).join('') : parts[0].slice(0, 2)).slice(0, 4);
}

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length || rows.length > 5000) {
      return NextResponse.json({ error: 'Envie uma planilha com 1 a 5.000 produtos.' }, { status: 400 });
    }
    let matched = 0, added = 0, unchanged = 0, notFound = 0, ambiguous = 0;
    const details = [];
    for (const row of rows) {
      const sku = String(row?.sku || '').trim().slice(0, 100);
      const colors = Array.isArray(row?.colors) ? [...new Set(row.colors.map((v) => String(v || '').trim()).filter(Boolean))] : [];
      if (!sku || !colors.length) {
        notFound++;
        if (details.length < 100) details.push({ sku: sku || '(vazia)', reason: 'SKU ou lista de cores inválida.' });
        continue;
      }
      const products = await query('SELECT id, sku, colors FROM products WHERE lower(trim(sku)) = lower(trim($1)) ORDER BY id', [sku]);
      if (!products.length) {
        notFound++;
        if (details.length < 100) details.push({ sku, reason: 'SKU principal não encontrada no cadastro.' });
        continue;
      }
      if (products.length > 1) {
        ambiguous++;
        if (details.length < 100) details.push({ sku, reason: 'Mais de um produto usa essa SKU. Nenhum foi alterado.' });
        continue;
      }
      matched++;
      const product = products[0];
      const current = Array.isArray(product.colors) ? product.colors : [];
      const merged = [...current];
      const known = new Set(current.map((item) => normalize(typeof item === 'string' ? item : item?.name)));
      let productAdded = 0;
      for (const name of colors) {
        const key = normalize(name);
        if (!key || known.has(key)) { unchanged++; continue; }
        const sigla = abbreviation(name);
        merged.push({ name, abbreviation: sigla, sku: String(product.sku || sku) + (sigla ? '-' + sigla : '') });
        known.add(key);
        productAdded++;
        added++;
      }
      if (productAdded) {
        await query('UPDATE products SET colors = $1::jsonb WHERE id = $2', [JSON.stringify(merged), product.id]);
      }
    }
    revalidatePath('/admin/produtos');
    revalidatePath('/admin/importar-sku-precos');
    revalidatePath('/');
    return NextResponse.json({ total: rows.length, matched, added, unchanged, notFound, ambiguous, details });
  } catch (error) {
    const message = error?.message || 'Não foi possível importar as variações.';
    const status = /admin|autoriz/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
