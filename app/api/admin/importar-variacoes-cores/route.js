import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function colorName(item) {
  if (typeof item === 'string') return item.trim();
  return String(item?.name ?? item?.color ?? item?.cor ?? item?.value ?? item?.label ?? '').trim();
}
function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().replace(/\\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
function parseColors(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = []; }
  }
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    for (const key of ['colors', 'cores', 'variations', 'variacoes', 'items']) {
      if (Array.isArray(value[key])) return value[key];
    }
  }
  return [];
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
      const current = parseColors(product.colors);
      const merged = current.map((item) => {
        const name = colorName(item);
        if (!name || typeof item === 'string') return name || item;
        return { ...item, name };
      }).filter((item) => colorName(item));
      const known = new Set(merged.map((item) => normalize(colorName(item))));
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
      // Sempre grava e confirma a lista completa, inclusive se a planilha já foi importada.
      const saved = await query(
        'UPDATE products SET colors = $1::jsonb WHERE id = $2 RETURNING colors',
        [JSON.stringify(merged), product.id]
      );
      if (!saved.length) throw new Error('O produto da SKU ' + sku + ' não foi atualizado.');
      const persisted = parseColors(saved[0]?.colors);
      const persistedNames = new Set(persisted.map((item) => normalize(colorName(item))).filter(Boolean));
      const missing = colors.filter((name) => !persistedNames.has(normalize(name)));
      if (missing.length) {
        throw new Error('A gravação das cores da SKU ' + sku + ' não foi confirmada (' + missing.length + ' cor(es) ausente(s)).');
      }
      if (persisted.length !== merged.length) {
        throw new Error('A lista de cores da SKU ' + sku + ' foi gravada incompleta.');
      }
      revalidatePath('/admin/produtos/' + product.id);
      revalidatePath('/produto/' + product.id);
    }
    revalidatePath('/admin/produtos');
    revalidatePath('/admin/importar-sku-precos');
    revalidatePath('/');
    return NextResponse.json({ total: rows.length, matched, added, unchanged, notFound, ambiguous, saved: matched - ambiguous - notFound, details });
  } catch (error) {
    const message = error?.message || 'Não foi possível importar as variações.';
    const status = /admin|autoriz/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
