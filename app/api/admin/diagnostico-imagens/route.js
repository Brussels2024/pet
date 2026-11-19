import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { neon } from '@neondatabase/serverless';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}

export async function GET() {
  // A rota existe apenas para um deployment Preview. Falha antes de qualquer acesso ao banco.
  if (process.env.VERCEL_ENV !== 'preview') {
    return json({ error: 'Diagnóstico disponível somente no Preview.' }, 404);
  }

  const authSecret = process.env.AUTH_SECRET || '';
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

  if (Buffer.byteLength(authSecret, 'utf8') < 32 || !databaseUrl) {
    return json({ error: 'Autenticação ou conexão indisponível no Preview.' }, 503);
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('bp_admin_session')?.value;
  if (!token) {
    return json({ error: 'Autenticação administrativa obrigatória.' }, 401);
  }

  let payload;
  try {
    const verified = await jwtVerify(
      token,
      new TextEncoder().encode(authSecret),
      { algorithms: ['HS256'] }
    );
    payload = verified.payload;
  } catch {
    return json({ error: 'Sessão administrativa inválida ou expirada.' }, 401);
  }

  const userId = Number(payload.uid);
  if (
    !Number.isSafeInteger(userId) ||
    userId < 1 ||
    payload.role !== 'admin' ||
    !Number.isInteger(Number(payload.sv))
  ) {
    return json({ error: 'Sessão administrativa inválida.' }, 401);
  }

  try {
    // Cliente Neon direto: não usa lib/db.query(), pois ela executa ensureSchema()
    // e pode aplicar DDL. Todas as instruções abaixo são SELECT.
    const sql = neon(databaseUrl);

    const adminRows = await sql`
      SELECT id, role, status, session_version
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    const admin = adminRows[0];
    if (
      !admin ||
      admin.role !== 'admin' ||
      admin.status !== 'ativo' ||
      Number(admin.session_version) !== Number(payload.sv)
    ) {
      return json({ error: 'Acesso administrativo não autorizado.' }, 403);
    }

    const connectivity = await sql`SELECT 1 AS ok`;
    if (Number(connectivity[0]?.ok) !== 1) {
      return json({ error: 'Não foi possível validar a conexão com o banco.' }, 503);
    }

    const products = await sql`
      SELECT COUNT(*)::int AS total
      FROM products
      WHERE image_url LIKE 'data:image/%;base64,%'
    `;
    const productImages = await sql`
      SELECT COUNT(*)::int AS total
      FROM product_images
      WHERE image_url LIKE 'data:image/%;base64,%'
    `;
    const banners = await sql`
      SELECT COUNT(*)::int AS total
      FROM banners
      WHERE image_url LIKE 'data:image/%;base64,%'
    `;

    return json({
      ok: true,
      connection: 'SELECT 1 OK',
      counts: {
        products: Number(products[0]?.total ?? 0),
        product_images: Number(productImages[0]?.total ?? 0),
        banners: Number(banners[0]?.total ?? 0),
      },
    });
  } catch {
    // Não expõe SQL, dados, strings de conexão nem conteúdo de imagens.
    return json({ error: 'Falha na consulta de diagnóstico ao Neon.' }, 503);
  }
}
