import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { maskEmail } from '@/lib/recovery';
import { enforceRequestLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    if (Number(request.headers.get('content-length') || 0) > 10000) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 413 });
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const cnpj = String(body.cnpj || '').replace(/\D/g, '');
  const telefone = String(body.telefone || '').replace(/\D/g, '');
  if (cnpj.length !== 14 || telefone.length < 10 || telefone.length > 13) {
    return NextResponse.json({ error: 'Confira o CNPJ e o telefone informados.' }, { status: 400 });
  }
  if (!(await enforceRequestLimit(request, 'email-recovery', 5, 60 * 60, cnpj))) {
    return NextResponse.json({ message: 'Não foi possível confirmar os dados. Aguarde e tente novamente.' }, { status: 429, headers: { 'Retry-After': '3600' } });
  }
  const rows = await query(
    \`SELECT email FROM users
     WHERE regexp_replace(COALESCE(cnpj, ''), '[^0-9]', '', 'g') = $1
       AND regexp_replace(COALESCE(telefone, ''), '[^0-9]', '', 'g') = $2
     LIMIT 1\`,
    [cnpj, telefone]
  );
  if (!rows[0]) {
    return NextResponse.json({ message: 'Não foi possível confirmar os dados. Confira as informações ou fale com o suporte.' });
  }
  return NextResponse.json({ message: 'Encontramos um cadastro. Confira o e-mail parcialmente oculto:', email: maskEmail(rows[0].email) });
}
