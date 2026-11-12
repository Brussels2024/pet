'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function RecuperarAcessoPage() {
  const [mode, setMode] = useState('senha');
  const [step, setStep] = useState('email');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  function changeMode(next) {
    setMode(next);
    setStep('email');
    setMessage('');
    setEmail('');
    setCode('');
  }

  async function submitEmail(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(e.currentTarget);
    const value = String(form.get('email') || '').trim().toLowerCase();
    try {
      const res = await fetch('/api/recuperar-senha', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json();
      setEmail(value);
      if (!res.ok && res.status !== 429) setMessage(data.error || 'Não foi possível solicitar o código.');
      else {
        setStep('code');
        setMessage(data.message || 'Se os dados corresponderem a uma conta, enviaremos um código por SMS.');
      }
    } catch {
      setMessage('Erro de conexão. Tente novamente.');
    }
    setBusy(false);
  }

  async function submitCode(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/confirmar-codigo-recuperacao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setMessage(data.error || 'Não foi possível validar o código.');
      } else {
        window.location.href = '/redefinir-senha?token=' + encodeURIComponent(data.token);
        return;
      }
    } catch {
      setMessage('Erro de conexão. Tente novamente.');
    }
    setBusy(false);
  }

  async function submitEmailRecovery(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/recuperar-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: form.get('cnpj'), telefone: form.get('telefone') }),
      });
      const data = await res.json();
      setMessage(data.error || data.message || 'Não foi possível concluir.');
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
          <button type="button" className={mode === 'senha' ? 'btn' : 'btn outline'} onClick={() => changeMode('senha')}>Esqueci a senha</button>
          <button type="button" className={mode === 'email' ? 'btn' : 'btn outline'} onClick={() => changeMode('email')}>Esqueci o e-mail</button>
        </div>

        {mode === 'senha' && step === 'email' && (
          <form onSubmit={submitEmail}>
            <div className="field">
              <label htmlFor="email">E-mail cadastrado</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
              <p className="muted">Enviaremos um código de seis dígitos por SMS para o telefone cadastrado na sua conta.</p>
            </div>
            {message && <div className="msg warn">{message}</div>}
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Enviando...' : 'Enviar código por SMS'}</button>
          </form>
        )}

        {mode === 'senha' && step === 'code' && (
          <form onSubmit={submitCode}>
            <div className="field">
              <label htmlFor="code">Código recebido por SMS</label>
              <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
              <p className="muted">Digite o código de seis dígitos enviado ao telefone cadastrado. Ele expira em poucos minutos.</p>
            </div>
            {message && <div className="msg warn">{message}</div>}
            <button className="btn" type="submit" disabled={busy || code.length !== 6} style={{ width: '100%' }}>{busy ? 'Verificando...' : 'Confirmar código'}</button>
            <button type="button" className="btn outline" disabled={busy} onClick={() => { setStep('email'); setCode(''); setMessage(''); }} style={{ width: '100%', marginTop: 10 }}>Voltar</button>
          </form>
        )}

        {mode === 'email' && (
          <form onSubmit={submitEmailRecovery}>
            <div className="field"><label htmlFor="cnpj">CNPJ cadastrado</label><input id="cnpj" name="cnpj" required inputMode="numeric" placeholder="00.000.000/0000-00" /></div>
            <div className="field"><label htmlFor="telefone">Telefone / WhatsApp cadastrado</label><input id="telefone" name="telefone" required inputMode="tel" placeholder="DDD + número" /></div>
            <p className="muted">Por segurança, precisamos conferir os dois dados cadastrados.</p>
            {message && <div className="msg warn">{message}</div>}
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Verificando...' : 'Localizar meu e-mail'}</button>
          </form>
        )}

        <p className="center muted" style={{ marginTop: 16 }}>Precisa de ajuda? <a href="mailto:contato.brussels@gmail.com"><b>Fale com o suporte</b></a></p>
        <p className="center muted"><Link href="/entrar"><b>Voltar para entrar</b></Link></p>
      </div>
    </div>
  );
}
