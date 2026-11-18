import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  await requireAdmin();
  const apiKey = process.env.ASAAS_API_KEY;
  const authToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!apiKey || !authToken || authToken.length < 32) {
    return NextResponse.json({ error: 'Confira ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN na Vercel. O token do webhook precisa ter pelo menos 32 caracteres.' }, { status: 503 });
  }

  const base = String(process.env.ASAAS_ENV || '').toLowerCase().includes('sandbox') ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';
  const url = 'https://www.brusselspet.com.br/api/webhooks/asaas';
  const config = {
    name: 'Brussels Pet - pagamentos',
    url,
    email: 'contato.brussels@gmail.com',
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken,
    sendType: 'SEQUENTIALLY',
    events: ['PAYMENT_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_REFUNDED'],
  };
  const headers = { access_token: apiKey, accept: 'application/json', 'content-type': 'application/json', 'User-Agent': 'BrusselsPet/1.0.0' };

  try {
    const listResponse = await fetch(base + '/webhooks', { headers, cache: 'no-store' });
    const listPayload = await listResponse.json().catch(() => ({}));
    if (!listResponse.ok) return NextResponse.json({ error: listPayload.errors?.[0]?.description || 'Não foi possível consultar os webhooks do Asaas.' }, { status: 502 });

    const existing = (Array.isArray(listPayload.data) ? listPayload.data : []).find((item) => item.url === url);
    const response = existing
      ? await fetch(base + '/webhooks/' + encodeURIComponent(existing.id), { method: 'PUT', headers, body: JSON.stringify(config), cache: 'no-store' })
      : await fetch(base + '/webhooks', { method: 'POST', headers, body: JSON.stringify(config), cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: payload.errors?.[0]?.description || 'O Asaas recusou a configuração do webhook.' }, { status: 502 });
    return NextResponse.json({ ok: true, message: existing ? 'Webhook Brussels Pet atualizado no Asaas.' : 'Webhook Brussels Pet criado no Asaas.' });
  } catch {
    return NextResponse.json({ error: 'Não foi possível conectar à API do Asaas.' }, { status: 502 });
  }
}
