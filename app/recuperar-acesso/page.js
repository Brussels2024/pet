'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function RecuperarAcessoPage() {
  const [mode, setMode] = useState('senha');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(e.currentTarget);
    const payload = mode === 'senha'
      ? { email: form.get('email') }
      : { cnpj: form.get('cnpj'), telefone: form.get('telefone') };
    try {
      const res = await fetch(mode === 'senha' ? '/api/recuperar-senha' : '/api/recuperar-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      setMessage(data.error || data.message || 'Não foi possível concluir.');
      setEmail(data.email || '');
    } catch {
      setMessage('Erro de conexão. Tente novamente.');
    }
    setBusy(false);
  }

  return (
    <div className="wrap page">
      <div className="auth-box card">
        <h1>Recuperar acesso</h1>
        <p className="muted">Escolha o que você esqueceu.</p>
        <div className="inline-form" style={{ marginBottom: 18 }}>
          <button type="button" className={mode === 'senha' ? 'btn' : 'btn outline'} onClick={() => { setMode('senha'); setMessage(''); setEmail(''); }}>Esqueci a senha</button>
          <button type="button" className={mode === 'email' ? 'btn' : 'btn outline'} onClick={() => { setMode('email'); setMessage(''); setEmail(''); }}>Esqueci o e-mail</button>
        </div>
        <form onSubmit={submit}>
          {mode === 'senha' ? (
            <div className="field">
              <label htmlFor="email">E-mail cadastrado</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
              <p className="muted">Enviaremos um link de redefinição se encontrarmos uma conta.</p>
            </div>
          ) : (
            <>
              <div className="field"><label htmlFor="cnpj">CNPJ cadastrado</label><input id="cnpj" name="cnpj" required inputMode="numeric" placeholder="00.000.000/0000-00" /></div>
              <div className="field"><label htmlFor="telefone">Telefone / WhatsApp cadastrado</label><input id="telefone" name="telefone" required inputMode="tel" placeholder="DDD + número" /></div>
              <p className="muted">Por segurança, precisamos conferir os dois dados cadastrados.</p>
            </>
          )}
          {message && <div className="msg warn">{message}{email && <strong style={{ display: 'block', marginTop: 6 }}>{email}</strong>}</div>}
          <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Verificando...' : mode === 'senha' ? 'Enviar recuperação' : 'Localizar meu e-mail'}</button>
        </form>
        <p className="center muted" style={{ marginTop: 16 }}>Precisa de ajuda? <a href="mailto:contato.brussels@gmail.com"><b>Fale com o suporte</b></a></p>
        <p className="center muted"><Link href="/entrar"><b>Voltar para entrar</b></Link></p>
      </div>
    </div>
  );
}
