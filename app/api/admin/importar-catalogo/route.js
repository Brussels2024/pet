import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length || items.length > 5) {
      return NextResponse.json({ error: 'Envie de 1 a 5 produtos por lote.' }, { status: 400 });
    }

    const valid = items.map((item) => ({
      name: String(item?.name || '').trim().slice(0, 180),
      description: String(item?.description || '').trim().slice(0, 2000),
      image: String(item?.image || ''),
    })).filter((item) =>
      item.name &&
      /^data:image\/(?:jpeg|jpg|webp);base64,/.test(item.image) &&
      item.image.length <= 650000
    );

    const skipped = items.length - valid.length;
    if (!valid.length) return NextResponse.json({ added: 0, skipped, reason: 'Formato ou tamanho de imagem inválido.' });

    const existing = await query(
      'SELECT lower(name) AS name FROM products WHERE lower(name) = ANY($1::text[])',
      [valid.map((item) => item.name.toLowerCase())]
    );
    const existingNames = new Set(existing.map((row) => row.name));
    const fresh = valid.filter((item) => !existingNames.has(item.name.toLowerCase()));
    const duplicateCount = valid.length - fresh.length;
    if (!fresh.length) return NextResponse.json({ added: 0, skipped: skipped + duplicateCount });

    const params = [];
    const values = fresh.map((item, index) => {
      const base = index * 3;
      params.push(item.name, item.description, item.image);
      return `($${base + 1}, $${base + 2}, '', 0, 0, $${base + 3}, NULL, false, false)`;
    });
    const inserted = await query(
      `INSERT INTO products
        (name, description, sku, price, stock, image_url, category_id, active, priority)
       VALUES ${values.join(', ')}
       RETURNING id, image_url`,
      params
    );

    if (inserted.length) {
      const imageParams = [];
      const imageValues = inserted.map((row, index) => {
        imageParams.push(row.id, row.image_url);
        return `($${index * 2 + 1}, $${index * 2 + 2}, 1)`;
      });
      await query(
        `INSERT INTO product_images (product_id, image_url, position)
         VALUES ${imageValues.join(', ')}`,
        imageParams
      );
    }

    return NextResponse.json({ added: inserted.length, skipped: skipped + duplicateCount });
  } catch (error) {
    const message = error?.message || 'Não foi possível importar os produtos.';
    const status = /admin|autoriz/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}