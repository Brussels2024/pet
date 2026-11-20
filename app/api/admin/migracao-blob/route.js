import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fase atual: somente o primeiro lote aprovado de 5 imagens. Lotes de 25 permanecem bloqueados.
const PILOT_EXECUTION_ENABLED = false;
const FIRST_BATCH_EXECUTION_ENABLED = true;
const BATCH_EXECUTION_ENABLED = false;
const BASE64_PATTERN = 'data:image/%;base64,%';
const FIRST_BATCH_CONFIRMATION = 'AUTORIZO O PRIMEIRO LOTE DE 5 IMAGENS';
const BATCH_CONFIRMATION = 'AUTORIZO LOTES DE ATÉ 25 IMAGENS';
const IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\r\n]+)$/i;
const TABLES = new Set(['banners', 'products', 'product_images']);

function database() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (!connectionString) throw new Error('Banco não configurado.');
  return neon(connectionString);
}

async function authorizePreview(sql) {
  if (process.env.VERCEL_ENV !== 'preview') return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
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

async function getPilotCandidates(sql) {
  // IDs conferidos no Neon pelo usuário: banner 4, produto 171 (Pneu M Black) e foto 191 do produto 286 (Anêmona).
  const [banners, products, extras] = await Promise.all([
    sql.query('SELECT id, position, title FROM banners WHERE id = $1 AND image_url LIKE $2 LIMIT 1', [4, BASE64_PATTERN]),
    sql.query('SELECT id, name FROM products WHERE id = $1 AND image_url LIKE $2 LIMIT 1', [171, BASE64_PATTERN]),
    sql.query(
      `SELECT pi.id, pi.product_id, pi.position, p.name
         FROM product_images pi
         JOIN products p ON p.id = pi.product_id
        WHERE pi.id = $1 AND pi.product_id = $3 AND pi.image_url LIKE $2
        LIMIT 1`,
      [191, BASE64_PATTERN, 286]
    ),
  ]);

  const banner = banners[0]
    ? { kind: 'banner', table: 'banners', id: 4, label: 'Banner 1', name: banners[0].title || 'Banner 1' }
    : null;
  const product = products[0]
    ? { kind: 'product', table: 'products', id: 171, label: 'Imagem principal do produto', name: products[0].name }
    : null;
  const extra = extras[0] && Number(extras[0].position) > 1
    ? { kind: 'extra', table: 'product_images', id: 191, productId: Number(extras[0].product_id), label: 'Foto extra do produto 286', name: extras[0].name }
    : null;

  return [banner, product, extra];
}

async function getFirstBatchCandidates(sql) {
  const [banners, products] = await Promise.all([
    sql.query('SELECT id, position, title AS name FROM banners WHERE image_url LIKE $1 ORDER BY id LIMIT 2', [BASE64_PATTERN]),
    sql.query('SELECT id, name FROM products WHERE image_url LIKE $1 ORDER BY id LIMIT 3', [BASE64_PATTERN]),
  ]);
  return [
    ...banners.map((row) => ({ kind: 'first_batch', table: 'banners', id: Number(row.id), label: `Banner ${row.position}`, name: row.name || `Banner ${row.position}` })),
    ...products.map((row) => ({ kind: 'first_batch', table: 'products', id: Number(row.id), label: 'Imagem principal', name: row.name })),
  ];
}

async function getBatchCandidates(sql) {
  const [banners, products, extras] = await Promise.all([
    sql.query('SELECT id, position, title AS name FROM banners WHERE image_url LIKE $1 ORDER BY id LIMIT 5', [BASE64_PATTERN]),
    sql.query('SELECT id, name FROM products WHERE image_url LIKE $1 ORDER BY id LIMIT 5', [BASE64_PATTERN]),
    sql.query(
      `SELECT pi.id, pi.position, p.name
         FROM product_images pi JOIN products p ON p.id = pi.product_id
        WHERE pi.image_url LIKE $1 ORDER BY pi.id LIMIT 5`,
      [BASE64_PATTERN]
    ),
  ]);
  return [
    ...banners.map((row) => ({ kind: 'batch', table: 'banners', id: Number(row.id), label: `Banner ${row.position}`, name: row.name || `Banner ${row.position}` })),
    ...products.map((row) => ({ kind: 'batch', table: 'products', id: Number(row.id), label: 'Imagem principal', name: row.name })),
    ...extras.map((row) => ({ kind: 'batch', table: 'product_images', id: Number(row.id), label: `Foto posição ${row.position}`, name: row.name })),
  ].slice(0, 5);
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

  for (const item of items) {
    try {
      const rows = await sql.query(
        `SELECT id, image_url${item.table === 'product_images' ? ', position, product_id' : ''} FROM ${item.table} WHERE id = $1 LIMIT 1`,
        [Number(item.id)]
      );
      const row = rows[0];
      if (!row) { skipped.push({ table: item.table, id: Number(item.id), reason: 'Registro não encontrado' }); continue; }

      const match = String(row.image_url || '').match(IMAGE_RE);
      const extension = match?.[1]?.toLowerCase() === 'jpeg' ? 'jpg' : match?.[1]?.toLowerCase();
      const blobPath = `migration/${item.table}/${Number(item.id)}.${extension || 'bin'}`;
      if (!match) {
        if (String(row.image_url || '').includes(`/migration/${item.table}/${Number(item.id)}.`)) {
          skipped.push({ table: item.table, id: Number(item.id), reason: 'Já migrada' });
        } else {
          skipped.push({ table: item.table, id: Number(item.id), reason: 'Imagem já é URL ou foi alterada' });
        }
        continue;
      }
      if (item.kind === 'extra' && Number(row.product_id) !== Number(item.productId)) {
        failed.push({ table: item.table, id: Number(item.id), reason: 'A foto não pertence ao produto aprovado' });
        continue;
      }
      if (item.kind === 'extra' && Number(row.position) <= 1) {
        failed.push({ table: item.table, id: Number(item.id), reason: 'A foto selecionada não é uma foto extra' });
        continue;
      }
      if (item.kind === 'product' && item.table === 'product_images' && Number(row.position) !== 1) {
        failed.push({ table: item.table, id: Number(item.id), reason: 'A foto selecionada não é a imagem principal' });
        continue;
      }

      const mime = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
      const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
      if (!bytes.length || bytes.length > 8 * 1024 * 1024) {
        failed.push({ table: item.table, id: Number(item.id), reason: 'Arquivo vazio ou acima de 8 MB' });
        continue;
      }

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
    details: { migrated, skipped, failed },
  };
}

export async function GET() {
  try {
    const sql = database();
    const user = await authorizePreview(sql);
    if (!user) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 404 });
    const [firstBatchCandidates, batchCandidates, counts] = await Promise.all([
      getFirstBatchCandidates(sql),
      getBatchCandidates(sql),
      getCounts(sql),
    ]);
    return NextResponse.json({
      environment: 'preview',
      store: 'pet-product-images',
      executionEnabled: PILOT_EXECUTION_ENABLED,
      firstBatchExecutionEnabled: FIRST_BATCH_EXECUTION_ENABLED,
      batchExecutionEnabled: BATCH_EXECUTION_ENABLED,
      firstBatchCandidates,
      batchCandidates,
      counts,
      firstBatchReady: firstBatchCandidates.length === 5 && firstBatchCandidates.filter((item) => item.table === 'banners').length === 2 && firstBatchCandidates.filter((item) => item.table === 'products').length === 3,
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
    const mode = body?.mode;
    const items = Array.isArray(body?.items) ? body.items : [];
    if (mode === 'pilot') {
      if (!PILOT_EXECUTION_ENABLED) return NextResponse.json({ error: 'Execução do piloto bloqueada até sua aprovação expressa.' }, { status: 423 });
      const approvedPilot = [
        { kind: 'banner', table: 'banners', id: 4 },
        { kind: 'product', table: 'products', id: 171 },
        { kind: 'extra', table: 'product_images', id: 191, productId: 286 },
      ];
      if (body?.confirmation !== PILOT_CONFIRMATION || items.length !== 3 ||
          approvedPilot.some((approved) => !items.some((item) =>
            item?.kind === approved.kind && item?.table === approved.table && Number(item?.id) === approved.id &&
            (approved.productId === undefined || Number(item?.productId) === approved.productId)
          ))) {
        return NextResponse.json({ error: 'Confirmação ou seleção do piloto inválida.' }, { status: 400 });
      }
    } else if (mode === 'first_batch') {
      if (!FIRST_BATCH_EXECUTION_ENABLED) return NextResponse.json({ error: 'O primeiro lote está bloqueado.' }, { status: 423 });
      const expected = await getFirstBatchCandidates(sql);
      const submitted = items.map((item) => `${item?.table}:${Number(item?.id)}`).sort();
      const approved = expected.map((item) => `${item.table}:${item.id}`).sort();
      if (body?.confirmation !== FIRST_BATCH_CONFIRMATION || items.length !== 5 ||
          items.some((item) => item?.kind !== 'first_batch') ||
          JSON.stringify(submitted) !== JSON.stringify(approved) ||
          expected.filter((item) => item.table === 'banners').length !== 2 ||
          expected.filter((item) => item.table === 'products').length !== 3) {
        return NextResponse.json({ error: 'O primeiro lote deve conter exatamente os 2 banners e 3 produtos apresentados na conferência.' }, { status: 400 });
      }
    } else if (mode === 'batch') {
      if (!BATCH_EXECUTION_ENABLED) return NextResponse.json({ error: 'Os lotes de 25 imagens serão liberados somente após sua conferência do primeiro lote.' }, { status: 423 });
      if (body?.confirmation !== BATCH_CONFIRMATION || items.length < 1 || items.length > 25 ||
          items.some((item) => item?.kind !== 'batch')) {
        return NextResponse.json({ error: 'Confirmação ou seleção do lote inválida.' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Operação inválida.' }, { status: 400 });
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

    const result = await migrateItems(sql, items);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Não foi possível executar o lote.' }, { status: 500 });
  }
}
