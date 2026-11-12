'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function ResetForm() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const senha = String(form.get('senha') || '');
    const confirmacao = String(form.get('confirmacao') || '');
    if (senha !== confirmacao) { setMessage('As senhas não coincidem.'); return; }
    if (!/[A-Z]/.test(senha) || !/[a-z]/.test(senha) || !/[0-9]/.test(senha) || !/[^A-Za-z0-9]/.test(senha)) { setMessage('Use maiúscula, minúscula, número e símbolo.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/redefinir-senha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, senha }) });
      const data = await res.json();
      if (!res.ok) setMessage(data.error || 'Não foi possível redefinir a senha.');
      else setDone(true);
    } catch { setMessage('Erro de conexão. Tente novamente.'); }
    setBusy(false);
  }

  if (done) return <><h1>Senha atualizada!</h1><p>Agora você já pode entrar com sua nova senha.</p><Link className="btn" href="/entrar">Ir para o login</Link></>;
  return <>
    <h1>Criar nova senha</h1>
    <p className="muted">A senha precisa ter pelo menos 12 caracteres, incluindo maiúscula, minúscula, número e símbolo.</p>
    <form onSubmit={submit}>
      <div className="field"><label htmlFor="senha">Nova senha</label><input id="senha" name="senha" type="password" minLength={12} maxLength={72} required autoComplete="new-password" /></div>
      <div className="field"><label htmlFor="confirmacao">Confirme a nova senha</label><input id="confirmacao" name="confirmacao" type="password" minLength={12} maxLength={72} required autoComplete="new-password" /></div>
      {message && <div className="msg error">{message}</div>}
      <button className="btn" type="submit" disabled={busy || !token} style={{ width: '100%' }}>{busy ? 'Salvando...' : 'Salvar nova senha'}</button>
    </form>
  </>;
}

export default function RedefinirSenhaPage() {
  return <div className="wrap page"><div className="auth-box card"><Suspense fallback={<p>Carregando...</p>}><ResetForm /></Suspense></div></div>;
}
