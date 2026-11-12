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

    let added = 0;
    let skipped = 0;
    for (const item of items) {
      const name = String(item?.name || '').trim().slice(0, 180);
      const description = String(item?.description || '').trim().slice(0, 2000);
      const image = String(item?.image || '');
      if (!name || !/^data:image\/webp;base64,/.test(image) || image.length > 650000) {
        skipped++;
        continue;
      }

      const exists = await query('SELECT id FROM products WHERE lower(name) = lower($1) LIMIT 1', [name]);
      if (exists.length) {
        skipped++;
        continue;
      }

      const inserted = await query(
        `INSERT INTO products
          (name, description, sku, price, stock, image_url, category_id, active, priority)
         VALUES ($1, $2, '', 0, 0, $3, NULL, false, false)
         RETURNING id`,
        [name, description, image]
      );
      const productId = inserted[0]?.id;
      if (!productId) {
        skipped++;
        continue;
      }

      await query(
        'INSERT INTO product_images (product_id, image_url, position) VALUES ($1, $2, 1)',
        [productId, image]
      );
      added++;
    }

    return NextResponse.json({ added, skipped });
  } catch (error) {
    const message = error?.message || 'Não foi possível importar os produtos.';
    const status = /admin|autoriz/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}