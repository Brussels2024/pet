import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import { getAdminUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Mantido bloqueado até a aprovação expressa do piloto pelo responsável.
const PILOT_EXECUTION_ENABLED = false;
const BASE64_PATTERN = 'data:image/%;base64,%';
const CONFIRMATION_TEXT = 'AUTORIZO O PILOTO DE 3 IMAGENS';
const IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\r\n]+)$/i;
const TABLES = new Set(['banners', 'products', 'product_images']);

function database() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (!connectionString) throw new Error('Banco não configurado.');
  return neon(connectionString);
}

async function authorizePreview() {
  if (process.env.VERCEL_ENV !== 'preview') return null;
  const user = await getAdminUser();
  if (!user || user.role !== 'admin' || user.status !== 'ativo') return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  return user;
}

async function getPilotCandidates(sql) {
  const [banners, directProducts, galleryProducts] = await Promise.all([
    sql.query(
      'SELECT id, position, title FROM banners WHERE image_url LIKE $1 ORDER BY position, id LIMIT 1',
      [BASE64_PATTERN]
    ),
    sql.query(
      `SELECT p.id, p.name
         FROM products p
        WHERE p.image_url LIKE $1
          AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id)
        ORDER BY p.id
        LIMIT 1`,
      [BASE64_PATTERN]
    ),
    sql.query(
      `SELECT pi.id, pi.product_id, pi.position, p.name
         FROM product_images pi
         JOIN products p ON p.id = pi.product_id
        WHERE pi.image_url LIKE $1 AND pi.position = 1
        ORDER BY pi.id
        LIMIT 1`,
      [BASE64_PATTERN]
    ),
  ]);

  const banner = banners[0]
    ? { kind: 'banner', table: 'banners', id: Number(banners[0].id), label: `Banner ${banners[0].position}`, name: banners[0].title || `Banner ${banners[0].position}` }
    : null;

  let product = null;
  let productId = null;
  if (directProducts[0]) {
    productId = Number(directProducts[0].id);
    product = { kind: 'product', table: 'products', id: productId, label: 'Imagem principal do produto', name: directProducts[0].name };
  } else if (galleryProducts[0]) {
    productId = Number(galleryProducts[0].product_id);
    product = { kind: 'product', table: 'product_images', id: Number(galleryProducts[0].id), label: 'Imagem principal do produto', name: galleryProducts[0].name };
  }

  let extras = await sql.query(
    `SELECT pi.id, pi.product_id, pi.position, p.name
       FROM product_images pi
       JOIN products p ON p.id = pi.product_id
      WHERE pi.image_url LIKE $1 AND pi.position > 1
        AND ($2::int IS NULL OR pi.product_id <> $2)
      ORDER BY pi.id
      LIMIT 1`,
    [BASE64_PATTERN, productId]
  );
  if (!extras.length) {
    extras = await sql.query(
      `SELECT pi.id, pi.product_id, pi.position, p.name
         FROM product_images pi
         JOIN products p ON p.id = pi.product_id
        WHERE pi.image_url LIKE $1 AND pi.position > 1
        ORDER BY pi.id
        LIMIT 1`,
      [BASE64_PATTERN]
    );
  }
  const extra = extras[0]
    ? { kind: 'extra', table: 'product_images', id: Number(extras[0].id), label: `Foto extra (posição ${extras[0].position})`, name: extras[0].name }
    : null;

  return [banner, product, extra];
}

async function getCounts(sql) {
  const [banners, products, productImages] = await Promise.all([
    sql.query('SELECT COUNT(*)::int AS count FROM banners WHERE image_url LIKE $1', [BASE64_PATTERN]),
    sql.query('SELECT COUNT(*)::int AS count FROM products WHERE image_url LIKE $1', [BASE64_PATTERN]),
    sql.query('SELECT COUNT(*)::int AS count FROM product_images WHERE image_url LIKE $1', [BASE64_PATTERN]),
  ]);
  const byTable = {
    banners: Number(banners[0]?.count || 0),
    products: Number(products[0]?.count || 0),
    product_images: Number(productImages[0]?.count || 0),
  };
  return { byTable, total: byTable.banners + byTable.products + byTable.product_images };
}

export async function GET() {
  try {
    const user = await authorizePreview();
    if (!user) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 404 });
    const sql = database();
    const [candidates, counts] = await Promise.all([getPilotCandidates(sql), getCounts(sql)]);
    return NextResponse.json({
      environment: 'preview',
      store: 'pet-product-images',
      executionEnabled: PILOT_EXECUTION_ENABLED,
      candidates,
      counts,
      ready: candidates.every(Boolean),
    });
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar os candidatos da migração.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
    }
    const user = await authorizePreview();
    if (!user) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 404 });
    if (!PILOT_EXECUTION_ENABLED) {
      return NextResponse.json({ error: 'Execução bloqueada. Aguarde a aprovação expressa do piloto.' }, { status: 423 });
    }

    const body = await request.json();
    if (body?.confirmation !== CONFIRMATION_TEXT) {
      return NextResponse.json({ error: 'Confirmação do piloto inválida.' }, { status: 400 });
    }
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length !== 3 || new Set(items.map((item) => item?.kind)).size !== 3 ||
        !['banner', 'product', 'extra'].every((kind) => items.some((item) => item.kind === kind))) {
      return NextResponse.json({ error: 'O piloto precisa conter um banner, um produto e uma foto extra.' }, { status: 400 });
    }
    for (const item of items) {
      if (!TABLES.has(item.table) || !Number.isInteger(Number(item.id)) || Number(item.id) < 1) {
        return NextResponse.json({ error: 'Registro de imagem inválido.' }, { status: 400 });
      }
      if ((item.kind === 'banner' && item.table !== 'banners') ||
          (item.kind === 'extra' && item.table !== 'product_images') ||
          (item.kind === 'product' && !['products', 'product_images'].includes(item.table))) {
        return NextResponse.json({ error: 'Tipo de registro inválido.' }, { status: 400 });
      }
    }

    const sql = database();
    const migrated = [];
    const skipped = [];
    const failed = [];

    for (const item of items) {
      try {
        const rows = await sql.query(`SELECT id, image_url${item.table === 'product_images' ? ', position' : ''} FROM ${item.table} WHERE id = $1 LIMIT 1`, [Number(item.id)]);
        const row = rows[0];
        if (!row) { skipped.push({ kind: item.kind, reason: 'Registro não encontrado' }); continue; }

        const match = String(row.image_url || '').match(IMAGE_RE);
        const extension = match?.[1]?.toLowerCase() === 'jpeg' ? 'jpg' : match?.[1]?.toLowerCase();
        const blobPath = `migration/${item.table}/${Number(item.id)}.${extension || 'bin'}`;
        if (!match) {
          if (String(row.image_url || '').includes(`/migration/${item.table}/${Number(item.id)}.`)) {
            skipped.push({ kind: item.kind, reason: 'Já migrada' });
          } else {
            skipped.push({ kind: item.kind, reason: 'Imagem já é URL ou foi alterada' });
          }
          continue;
        }
        if (item.kind === 'extra' && Number(row.position) <= 1) {
          failed.push({ kind: item.kind, reason: 'A foto selecionada não é uma foto extra' });
          continue;
        }
        if (item.kind === 'product' && item.table === 'product_images' && Number(row.position) !== 1) {
          failed.push({ kind: item.kind, reason: 'A foto selecionada não é a imagem principal' });
          continue;
        }

        const contentType = `image/${match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase()}`;
        const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
        if (!bytes.length || bytes.length > 8 * 1024 * 1024) {
          failed.push({ kind: item.kind, reason: 'Arquivo vazio ou acima de 8 MB' });
          continue;
        }

        const blob = await put(blobPath, bytes, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType,
        });
        const updated = await sql.query(
          `UPDATE ${item.table} SET image_url = $1 WHERE id = $2 AND image_url = $3 RETURNING id`,
          [blob.url, Number(item.id), row.image_url]
        );
        if (!updated.length) {
          skipped.push({ kind: item.kind, reason: 'Registro alterado durante a migração; banco preservado' });
        } else {
          migrated.push({ kind: item.kind, id: Number(item.id) });
        }
      } catch {
        failed.push({ kind: item.kind, reason: 'Falha ao enviar ou atualizar a imagem' });
      }
    }

    const counts = await getCounts(sql);
    revalidatePath('/');
    revalidatePath('/admin/produtos');
    revalidatePath('/admin/banners');
    return NextResponse.json({
      migrated: migrated.length,
      skipped: skipped.length,
      failed: failed.length,
      remaining: counts.total,
      remainingByTable: counts.byTable,
      details: { migrated, skipped, failed },
    });
  } catch {
    return NextResponse.json({ error: 'Não foi possível executar o lote.' }, { status: 500 });
  }
}
