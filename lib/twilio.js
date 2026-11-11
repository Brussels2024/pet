export async function sendAdminVerificationCode(code) {
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const token = process.env.TWILIO_AUTH_TOKEN || '';
  const serviceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || '';
  const phones = String(process.env.ADMIN_MFA_PHONES || '').split(',').map((item) => item.trim()).filter(Boolean);

  if (!sid || !token || !serviceSid || phones.length !== 3 || phones.some((phone) => !/^\+55\d{10,11}$/.test(phone))) {
    throw new Error('Configuração de SMS administrativo incompleta.');
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const authorization = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
  const results = await Promise.all(phones.map(async (to) => {
    const body = new URLSearchParams({
      To: to,
      MessagingServiceSid: serviceSid,
      Body: `Brussels Pet: seu código de acesso administrativo é ${code}. Ele expira em 5 minutos e só pode ser usado uma vez.`,
    });
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Falha no envio SMS (${response.status}): ${detail.slice(0, 300)}`);
    }
    return response.json();
  }));
  return results.length;
}
