import { NextResponse } from 'next/server';
import { isValidCnpj, lookupCnpj, onlyDigits } from '@/lib/cnpj';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { cnpj: raw } = await params;
  const cnpj = onlyDigits(raw);

  if (!isValidCnpj(cnpj)) {
    return NextResponse.json({ error: 'CNPJ inválido. Confira os números digitados.' }, { status: 400 });
  }

  const result = await lookupCnpj(cnpj);

  if (result.ok) {
    return NextResponse.json({ ok: true, data: result.data });
  }
  if (result.error === 'nao_encontrado') {
    return NextResponse.json(
      { error: 'CNPJ não encontrado na Receita Federal.', code: 'nao_encontrado' },
      { status: 404 }
    );
  }
  // Fonte fora do ar: não significa que a empresa não exista.
  return NextResponse.json(
    {
      error:
        'Não conseguimos consultar o CNPJ agora. Tente novamente em instantes ou continue o cadastro para aprovação manual.',
      code: 'indisponivel',
    },
    { status: 503 }
  );
}
