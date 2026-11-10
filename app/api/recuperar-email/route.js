import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { allowRecoveryAttempt, maskEmail } from '@/lib/recovery';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const cnpj = String(body.cnpj || '').replace(/\D/g, '');
  const telefone = String(body.telefone || '').replace(/\D/g, '');
  if (cnpj.length !== 14 || telefone.length < 10) {
    return NextResponse.json({ error: 'Confira o CNPJ e o telefone informados.' }, { status: 400 });
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!(await allowRecoveryAttempt('email:' + ip))) {
    return NextResponse.json({ message: 'Se os dados corresponderem a uma conta, mostraremos o e-mail parcialmente oculto.' });
  }
  const rows = await query(
    `SELECT email FROM users
     WHERE regexp_replace(COALESCE(cnpj, ''), '\\D', '', 'g') = $1
       AND regexp_replace(COALESCE(telefone, ''), '\\D', '', 'g') = $2
     LIMIT 1`,
    [cnpj, telefone]
  );
  if (!rows[0]) {
    return NextResponse.json({ message: 'Não foi possível confirmar os dados. Confira as informações ou fale com o suporte.' });
  }
  return NextResponse.json({ message: 'Encontramos um cadastro. Confira o e-mail parcialmente oculto:', email: maskEmail(rows[0].email) });
}
