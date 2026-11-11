import { NextResponse } from 'next/server';
import { getUser, createSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  }
  const user = await getUser();
  if (!user || user.role !== 'admin' || user.status !== 'ativo') {
    return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  }
  await createSession(user.id, user.session_version, 'admin');
  return NextResponse.json({ ok: true, expiresInDays: 30 });
}
