'use client';

import { useState } from 'react';

export default function LoginForm({ next, scope }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
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
      if (scope === 'admin') {
        window.location.href = '/admin';
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
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" required autoComplete="current-password" />
      </div>
      {scope !== 'admin' && <p className="muted" style={{ textAlign: 'right', margin: '-4px 0 14px' }}><a href="/recuperar-acesso"><b>Esqueci minha senha ou e-mail</b></a></p>}
      {error && <div className="msg error">{error}</div>
      <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}
