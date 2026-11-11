'use client';

import { useState } from 'react';

export default function LoginForm({ next, scope }) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      if (mfaRequired) {
        const res = await fetch('/api/login/verificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: form.get('code') }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Não foi possível validar o código.');
          setLoading(false);
          return;
        }
        window.location.href = '/admin';
        return;
      }

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          senha: form.get('senha'),
          scope: scope || 'cliente',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível entrar.');
        setLoading(false);
        return;
      }
      if (scope === 'admin' && data.mfa_required) {
        setMfaRequired(true);
        setNotice('Enviamos o mesmo código de segurança por SMS aos três telefones autorizados. Digite o código para concluir o acesso.');
        setLoading(false);
        return;
      }
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      window.location.href = safeNext;
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {!mfaRequired ? (
        <>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="senha">Senha</label>
            <input id="senha" name="senha" type="password" required autoComplete="current-password" />
          </div>
          <p className="muted" style={{ textAlign: 'right', margin: '-4px 0 14px' }}><a href="/recuperar-acesso"><b>Esqueci minha senha ou e-mail</b></a></p>
        </>
      ) : (
        <div className="field">
          <label htmlFor="code">Código de segurança (6 dígitos)</label>
          <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus />
        </div>
      )}
      {notice && <div className="msg warn">{notice}</div>}
      {error && <div className="msg error">{error}</div>}
      <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
        {loading ? 'Aguarde...' : mfaRequired ? 'Validar código e entrar' : 'Entrar'}
      </button>
    </form>
  );
}
