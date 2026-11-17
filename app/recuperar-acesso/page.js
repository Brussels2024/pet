'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function RecuperarAcessoPage() {
  const [mode, setMode] = useState('senha');
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);

  function changeMode(next) {
    setMode(next);
    setStep(1);
    setMessage('');
    setCompleted(false);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    let endpoint = '/api/recuperar-senha';
    let payload = { email: form.get('email') };

    if (mode === 'email') {
      endpoint = '/api/recuperar-email';
      payload = step === 1
        ? { action: 'validar', cnpj: form.get('cnpj'), telefone: form.get('telefone') }
        : {
            action: 'solicitar',
            novoEmail: form.get('novoEmail'),
            senha: form.get('senha'),
            confirmacao: form.get('confirmacao'),
          };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || data.message || 'Não foi possível concluir. Tente novamente.');
      } else if (mode === 'email' && step === 1) {
        setStep(2);
        setMessage(data.message || 'Dados conferidos. Informe o novo e-mail e a nova senha.');
      } else if (mode === 'email') {
        setCompleted(true);
        setMessage(data.message || 'Solicitação enviada para análise.');
      } else {
        setMessage(data.message || 'Se o e-mail estiver cadastrado, enviaremos as instruções.');
      }
    } catch {
      setMessage('Erro de conexão. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap page">
      <div className="auth-box card">
        <h1>Recuperar acesso</h1>
        <p className="muted">Escolha o que você precisa recuperar.</p>

        <div className="inline-form" style={{ marginBottom: 18 }}>
          <button type="button" className={mode === 'senha' ? 'btn' : 'btn outline'} onClick={() => changeMode('senha')}>Esqueci a senha</button>
          <button type="button" className={mode === 'email' ? 'btn' : 'btn outline'} onClick={() => changeMode('email')}>Esqueci o e-mail</button>
        </div>

        {completed ? (
          <>
            <div className="msg warn" role="status">{message}</div>
            <p className="muted">Você poderá usar os novos dados de acesso assim que a equipe concluir a análise e aprovar a solicitação.</p>
            <Link className="btn" href="/entrar">Voltar para entrar</Link>
          </>
        ) : (
          <form onSubmit={submit}>
            {mode === 'senha' ? (
              <div className="field">
                <label htmlFor="email">E-mail cadastrado</label>
                <input id="email" name="email" type="email" required autoComplete="email" />
                <p className="muted">Enviaremos um link seguro para esse endereço. Abra o link para criar e confirmar sua nova senha.</p>
              </div>
            ) : (
              <>
                {step === 1 ? (
                  <>
                    <div className="field">
                      <label htmlFor="cnpj">CNPJ cadastrado</label>
                      <input id="cnpj" name="cnpj" required inputMode="numeric" placeholder="00.000.000/0000-00" />
                    </div>
                    <div className="field">
                      <label htmlFor="telefone">Telefone cadastrado</label>
                      <input id="telefone" name="telefone" required inputMode="tel" placeholder="DDD + número" />
                    </div>
                    <p className="muted">Vamos conferir os dados vinculados ao cadastro da empresa.</p>
                  </>
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor="novoEmail">Novo e-mail</label>
                      <input id="novoEmail" name="novoEmail" type="email" required autoComplete="email" />
                    </div>
                    <div className="field">
                      <label htmlFor="senha">Nova senha</label>
                      <input id="senha" name="senha" type="password" minLength={12} maxLength={72} required autoComplete="new-password" />
                      <p className="muted">Use pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo.</p>
                    </div>
                    <div className="field">
                      <label htmlFor="confirmacao">Confirme a nova senha</label>
                      <input id="confirmacao" name="confirmacao" type="password" minLength={12} maxLength={72} required autoComplete="new-password" />
                    </div>
                    <p className="muted">A alteração só será aplicada depois da análise e aprovação administrativa.</p>
                  </>
                )}
              </>
            )}

            {message && <div className="msg warn" role="status">{message}</div>}
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'Aguarde...' : mode === 'senha' ? 'Confirmar' : step === 1 ? 'Conferir dados' : 'Enviar solicitação'}
            </button>
          </form>
        )}

        <p className="center muted" style={{ marginTop: 16 }}>
          Precisa de ajuda? <a href="mailto:contato.brussels@gmail.com"><b>Fale com o suporte</b></a>
        </p>
        <p className="center muted"><Link href="/entrar"><b>Voltar para entrar</b></Link></p>
      </div>
    </div>
  );
}
