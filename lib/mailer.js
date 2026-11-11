import nodemailer from 'nodemailer';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));
}

function transporterConfig() {
  const user = process.env.SMTP_USER || 'contato.brussels@gmail.com';
  const pass = process.env.SMTP_PASS;
  if (!pass) throw new Error('SMTP_PASS não configurada.');
  return {
    user,
    transporter: nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true',
      auth: { user, pass },
    }),
  };
}

export async function sendRecoveryEmail({ to, link }) {
  const { user, transporter } = transporterConfig();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `Brussels Pet <${user}>`,
    to,
    subject: 'Recuperação de senha - Brussels Pet',
    text: `Recebemos um pedido para redefinir sua senha da Brussels Pet. Acesse este link em até 15 minutos: ${link}\n\nSe você não pediu esta alteração, ignore esta mensagem.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#444"><h2>Recuperação de senha</h2><p>Recebemos um pedido para redefinir sua senha da Brussels Pet.</p><p><a href="${link}" style="display:inline-block;background:#e5b224;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Criar nova senha</a></p><p>Este link expira em 15 minutos e só pode ser usado uma vez.</p><p>Se você não pediu esta alteração, ignore esta mensagem.</p></div>`,
  });
}

export async function sendAccountLockedEmail({ to, link }) {
  const { user, transporter } = transporterConfig();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `Brussels Pet <${user}>`,
    to,
    subject: 'Alerta de segurança: acesso bloqueado - Brussels Pet',
    text: `Detectamos três tentativas de senha incorreta na sua conta Brussels Pet. Por segurança, o acesso foi bloqueado por 15 minutos. Se foi você, use este link seguro para criar uma nova senha: ${link}\n\nO link expira em 15 minutos e só pode ser usado uma vez. Se não foi você, não compartilhe o link e altere sua senha.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#333"><h2>Alerta de segurança</h2><p>Detectamos três tentativas de senha incorreta na sua conta Brussels Pet.</p><p>Por segurança, o acesso foi bloqueado por <b>15 minutos</b>.</p><p>Se foi você, use o link abaixo para redefinir sua senha:</p><p><a href="${link}" style="display:inline-block;background:#e5b224;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Redefinir minha senha</a></p><p>O link expira em 15 minutos e só pode ser usado uma vez. Se não foi você, não compartilhe o link e altere sua senha.</p></div>`,
  });
}

export async function sendSecurityAlertEmail({ to, accountEmail, accountName, accountType }) {
  const { user, transporter } = transporterConfig();
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!recipients.length) return;
  const safeName = escapeHtml(accountName);
  const safeEmail = escapeHtml(accountEmail);
  const safeType = escapeHtml(accountType);
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `Brussels Pet <${user}>`,
    to: recipients.join(', '),
    subject: 'Alerta de segurança: conta bloqueada - Brussels Pet',
    text: `A conta ${accountName} (${accountEmail}), tipo: ${accountType}, atingiu três tentativas de senha incorreta e foi bloqueada por 15 minutos. Se a mesma conta voltar a atingir três erros após o fim do bloqueio, um novo alerta será enviado.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#333"><h2>Alerta de segurança da Brussels Pet</h2><p>A conta abaixo atingiu <b>três tentativas de senha incorreta</b> e foi bloqueada por 15 minutos.</p><p><b>Conta:</b> ${safeName}<br><b>E-mail:</b> ${safeEmail}<br><b>Tipo:</b> ${safeType}</p><p>Se a mesma conta atingir três novos erros após o fim do bloqueio, outro alerta será enviado.</p></div>`,
  });
}
