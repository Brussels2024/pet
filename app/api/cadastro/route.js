import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { isValidCnpj, lookupCnpj, onlyDigits } from '@/lib/cnpj';
import { enforceRequestLimit } from '@/lib/security';
import { hashPassword, validatePassword } from '@/lib/passwords';
import { encryptPii, ensurePiiSchema, phoneLookupHash } from '@/lib/pii';

export const dynamic = 'force-dynamic';

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  let body;
  try {
    if (Number(request.headers.get('content-length') || 0) > 20000) return fail('Dados inválidos.', 413);
    body = await request.json();
  } catch {
    return fail('Dados inválidos.');
  }

  const allowed = await enforceRequestLimit(request, 'registration', 5, 60 * 60);
  if (!allowed) return fail('Muitas tentativas de cadastro. Aguarde uma hora.', 429);

  const email = String(body.email || '').trim().toLowerCase();
  const senha = String(body.senha || '');
  const cnpj = onlyDigits(body.cnpj);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Informe um e-mail válido.');
  const passwordError = validatePassword(senha);
  if (passwordError) return fail(passwordError);
  if (!isValidCnpj(cnpj)) return fail('CNPJ inválido. Confira os números digitados.');

  const dupEmail = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (dupEmail.length) return fail('Já existe uma conta com este e-mail.', 409);
  const dupCnpj = await query('SELECT id FROM users WHERE cnpj = $1', [cnpj]);
  if (dupCnpj.length) return fail('Este CNPJ já está cadastrado.', 409);

  const lookup = await lookupCnpj(cnpj);
  let status = 'pendente';
  let situacao = 'Consulta indisponível';
  let data = {};

  if (lookup.ok) {
    data = lookup.data;
    situacao = data.situacao || 'DESCONHECIDA';
    if (data.situacao !== 'ATIVA') return fail(`Este CNPJ está com situação cadastral "${data.situacao || 'desconhecida'}" e não pode ser ativado.`, 422);
    status = 'ativo';
  } else if (lookup.error === 'nao_encontrado') {
    return fail('CNPJ não encontrado na Receita Federal.', 422);
  }

  const pick = (key) => String(body[key] || data[key] || '').trim();
  await ensurePiiSchema();
  const hash = await hashPassword(senha);
  const pii = {
    telefone: encryptPii(pick('telefone')),
    cep: encryptPii(onlyDigits(pick('cep'))),
    logradouro: encryptPii(pick('logradouro')),
    numero: encryptPii(pick('numero')),
    complemento: encryptPii(pick('complemento')),
    bairro: encryptPii(pick('bairro')),
    cidade: encryptPii(pick('cidade')),
    uf: encryptPii(pick('uf').toUpperCase().slice(0, 2)),
  };
  const phoneHash = phoneLookupHash(pick('telefone'));
  const rows = await query(
    `INSERT INTO users
       (email, password_hash, role, status, razao_social, nome_fantasia, cnpj, situacao_cnpj,
        telefone_enc, telefone_lookup_hash, cep_enc, logradouro_enc, numero_enc, complemento_enc, bairro_enc, cidade_enc, uf_enc)
     VALUES ($1, $2, 'cliente', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING id`,
    [email, hash, status, pick('razao_social'), pick('nome_fantasia'), cnpj, situacao, pii.telefone, phoneHash, pii.cep, pii.logradouro, pii.numero, pii.complemento, pii.bairro, pii.cidade, pii.uf]
  );

  await createSession(rows[0].id, 0, 'cliente');
  return NextResponse.json({
    ok: true,
    status,
    message: status === 'ativo'
      ? 'Cadastro aprovado! Os preços já estão liberados.'
      : 'Cadastro recebido. Não conseguimos consultar o CNPJ agora, então ele será aprovado manualmente.',
  });
}
