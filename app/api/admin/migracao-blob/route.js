import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_EXECUTION_ENABLED = true;
const BASE64_PATTERN = 'data:image/%;base64,%';
const BATCH_CONFIRMATION = 'AUTORIZO LOTES DE ATÉ 25 IMAGENS';
const IMAGE_RE = /^data:image\\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\\r\\n]+)$/i;
const TABLES = new Set(['banners', 'products', 'product_images']);

function database() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (!connectionString) throw new Error('Banco não configurado.');
  return neon(connectionString);
}

async function authorizePreview(sql) {
  if (process.env.VERCEL_ENV !== 'preview' || !process.env.BLOB_READ_WRITE_TOKEN) return null;
  const rawSecret = process.env.AUTH_SECRET || '';
  if (Buffer.byteLength(rawSecret, 'utf8') < 32) return null;
  try {
    const store = await cookies();
    const token = store.get('bp_admin_session')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(rawSecret), { algorithms: ['HS256'] });
    if (!Number.isInteger(Number(payload.uid)) || payload.role !== 'admin') return null;
    const rows = await sql.query(
      'SELECT id, role, status, session_version FROM users WHERE id = $1 LIMIT 1',
      [Number(payload.uid)]
    );
    const user = rows[0];
    if (!user || user.role !== 'admin' || user.status !== 'ativo' ||
        Number(payload.sv) !== Number(user.session_version)) return null;
    return user;
  } catch {
    return null;
  }
}

async function getBatchCandidates(sql) {
  const [banners, products, extras] = await Promise.all([
    sql.query('SELECT id, position, title AS name FROM banners WHERE image_url LIKE $1 ORDER BY id LIMIT 25', [BASE64_PATTERN]),
    sql.query('SELECT id, name FROM products WHERE image_url LIKE $1 ORDER BY id LIMIT 25', [BASE64_PATTERN]),
    sql.query(
      `SELECT pi.id, pi.position, p.name
         FROM product_images pi JOIN products p ON p.id = pi.product_id
        WHERE pi.image_url LIKE $1 ORDER BY pi.id LIMIT 25`,
      [BASE64_PATTERN]
    ),
  ]);
  return [
    ...banners.map((row) => ({ kind: 'batch', table: 'banners', id: Number(row.id), label: `Banner ${row.position}`, name: row.name || `Banner ${row.position}` })),
    ...products.map((row) => ({ kind: 'batch', table: 'products', id: Number(row.id), label: 'Imagem principal', name: row.name })),
    ...extras.map((row) => ({ kind: 'batch', table: 'product_images', id: Number(row.id), label: `Foto posição ${row.position}`, name: row.name })),
  ].slice(0, 25);
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

async function migrateItems(sql, items) {
  const migrated = [];
  const skipped = [];
  const failed = [];
  let stoppedOnError = false;

  for (const item of items) {
    try {
      const columns = item.table === 'product_images' ? ', position, product_id' : '';
      const rows = await sql.query(
        `SELECT id, image_url${columns} FROM ${item.table} WHERE id = $1 LIMIT 1`,
        [Number(item.id)]
      );
      const row = rows[0];
      if (!row) {
        skipped.push({ table: item.table, id: Number(item.id), reason: 'Registro não encontrado' });
        continue;
      }

      const match = String(row.image_url || '').match(IMAGE_RE);
      if (!match) {
        skipped.push({ table: item.table, id: Number(item.id), reason: 'Imagem já é URL ou foi alterada; banco preservado' });
        continue;
      }

      const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
      const blobPath = `migration/${item.table}/${Number(item.id)}.${extension}`;
      if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) {
        failed.push({ table: item.table, id: Number(item.id), reason: 'Formato de imagem não permitido' });
        stoppedOnError = true;
        break;
      }
      const bytes = Buffer.from(match[2].replace(/\\s/g, ''), 'base64');
      if (!bytes.length || bytes.length > 8 * 1024 * 1024) {
        failed.push({ table: item.table, id: Number(item.id), reason: 'Arquivo vazio ou acima de 8 MB' });
        stoppedOnError = true;
        break;
      }

      const mime = extension === 'jpg' ? 'jpeg' : extension;
      const blob = await put(blobPath, bytes, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: `image/${mime}`,
      });
      const updated = await sql.query(
        `UPDATE ${item.table} SET image_url = $1 WHERE id = $2 AND image_url = $3 RETURNING id`,
        [blob.url, Number(item.id), row.image_url]
      );
      if (!updated.length) {
        skipped.push({ table: item.table, id: Number(item.id), reason: 'Registro alterado durante a migração; banco preservado' });
      } else {
        migrated.push({ table: item.table, id: Number(item.id) });
      }
    } catch {
      failed.push({ table: item.table, id: Number(item.id), reason: 'Falha ao enviar ou atualizar a imagem' });
      stoppedOnError = true;
      break;
    }
  }

  const counts = await getCounts(sql);
  revalidatePath('/');
  revalidatePath('/admin/produtos');
  revalidatePath('/admin/banners');
  return {
    migrated: migrated.length,
    skipped: skipped.length,
    failed: failed.length,
    remaining: counts.total,
    remainingByTable: counts.byTable,
    stoppedOnError,
    details: { migrated, skipped, failed },
  };
}

export async function GET() {
  try {
    const sql = database();
    const user = await authorizePreview(sql);
    if (!user) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 404 });
    const [batchCandidates, counts] = await Promise.all([getBatchCandidates(sql), getCounts(sql)]);
    return NextResponse.json({
      environment: 'preview',
      store: 'pet-product-images',
      batchExecutionEnabled: BATCH_EXECUTION_ENABLED,
      batchCandidates,
      counts,
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
    const sql = database();
    const user = await authorizePreview(sql);
    if (!user) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 404 });

    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!BATCH_EXECUTION_ENABLED) {
      return NextResponse.json({ error: 'Os lotes de 25 imagens estão bloqueados.' }, { status: 423 });
    }
    if (body?.mode !== 'batch' || body?.confirmation !== BATCH_CONFIRMATION ||
        items.length < 1 || items.length > 25 || items.some((item) => item?.kind !== 'batch')) {
      return NextResponse.json({ error: 'Confirmação ou seleção do lote inválida.' }, { status: 400 });
    }

    for (const item of items) {
      if (!TABLES.has(item.table) || !Number.isInteger(Number(item.id)) || Number(item.id) < 1) {
        return NextResponse.json({ error: 'Registro de imagem inválido.' }, { status: 400 });
      }
    }

    const expected = await getBatchCandidates(sql);
    const submitted = items.map((item) => `${item.table}:${Number(item.id)}`).sort();
    const approved = expected.map((item) => `${item.table}:${item.id}`).sort();
    if (JSON.stringify(submitted) !== JSON.stringify(approved)) {
      return NextResponse.json({ error: 'A lista de imagens mudou. Atualize a conferência antes de continuar.' }, { status: 409 });
    }

    const result = await migrateItems(sql, items);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Não foi possível executar o lote.' }, { status: 500 });
  }
}
