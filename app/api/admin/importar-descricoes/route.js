import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function normalizeName(value) {
  return String(value ?? '').trim().replace(/\\s+/g, ' ');
}

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length || rows.length > 5000) {
      return NextResponse.json({ error: 'Envie uma planilha com 1 a 5.000 descrições.' }, { status: 400 });
    }

    const products = await query('SELECT id, name, description FROM products');
    const productsByName = new Map();
    for (const product of products) {
      const key = normalizeName(product.name);
      if (!productsByName.has(key)) productsByName.set(key, []);
      productsByName.get(key).push(product);
    }

    const seen = new Set();
    const details = [];
    let updated = 0;
    let notFound = 0;
    let alreadyDescribed = 0;
    let ambiguous = 0;
    let invalid = 0;

    for (const row of rows) {
      const name = normalizeName(row?.name);
      const description = String(row?.description ?? '').trim().slice(0, 2000);
      if (!name || !description) {
        invalid++;
        if (details.length < 100) details.push({ name: name || '(sem nome)', reason: 'Nome ou descrição vazios.' });
        continue;
      }
      if (seen.has(name)) {
        invalid++;
        if (details.length < 100) details.push({ name, reason: 'Nome repetido na planilha; linha ignorada para evitar atualização duplicada.' });
        continue;
      }
      seen.add(name);

      const matches = productsByName.get(name) || [];
      if (matches.length === 0) {
        notFound++;
        if (details.length < 100) details.push({ name, reason: 'Não existe produto com esse nome exato no cadastro.' });
        continue;
      }
      if (matches.length > 1) {
        ambiguous++;
        if (details.length < 100) details.push({ name, reason: 'Há mais de um produto com esse mesmo nome; nenhum foi alterado.' });
        continue;
      }

      const product = matches[0];
      if (String(product.description ?? '').trim()) {
        alreadyDescribed++;
        if (details.length < 100) details.push({ name, reason: 'Já possui descrição; a descrição atual foi preservada.' });
        continue;
      }

      await query('UPDATE products SET description = $1 WHERE id = $2', [description, product.id]);
      updated++;
    }

    revalidatePath('/admin/produtos');
    revalidatePath('/');
    return NextResponse.json({
      total: rows.length,
      updated,
      notFound,
      alreadyDescribed,
      ambiguous,
      invalid,
      details,
    });
  } catch (error) {
    const message = error?.message || 'Não foi possível importar as descrições.';
    const status = /admin|autoriz/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
