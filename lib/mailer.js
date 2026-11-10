import nodemailer from 'nodemailer';

export async function sendRecoveryEmail({ to, link }) {
  const user = process.env.SMTP_USER || 'contato.brussels@gmail.com';
  const pass = process.env.SMTP_PASS;
  if (!pass) throw new Error('SMTP_PASS não configurada.');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `Brussels Pet <${user}>`,
    to,
    subject: 'Recuperação de senha - Brussels Pet',
    text: `Recebemos um pedido para redefinir sua senha da Brussels Pet. Acesse este link em até 15 minutos: ${link}\n\nSe você não pediu esta alteração, ignore esta mensagem.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#444"><h2>Recuperação de senha</h2><p>Recebemos um pedido para redefinir sua senha da Brussels Pet.</p><p><a href="${link}" style="display:inline-block;background:#e5b224;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Criar nova senha</a></p><p>Este link expira em 15 minutos e só pode ser usado uma vez.</p><p>Se você não pediu esta alteração, ignore esta mensagem.</p></div>`,
  });
}
