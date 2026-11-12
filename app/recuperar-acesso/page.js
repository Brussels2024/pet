'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function RecuperarAcessoPage() {
  const [mode, setMode] = useState('senha');
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function changeMode(next) {
    setMode(next); setStep(1); setMessage('');
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMessage('');
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    let endpoint = '/api/recuperar-senha';
    let payload = { email: form.get('email') };

    if (mode === 'email') {
      endpoint = '/api/recuperar-email';
      payload = step === 1
        ? { action: 'validar', cnpj: form.get('cnpj'), telefone: form.get('telefone') }
        : { action: 'solicitar', cnpj: form.get('cnpj'), telefone: form.get('telefone'), novoEmail: form.get('novoEmail'), senha: form.get('senha'), confirmacao: form.get('confirmacao') };
    }

    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || data.message || 'Não foi possível concluir.'); }
      else if (mode === 'email' && step === 1) { setStep(2); setMessage('Dados conferidos. Agora informe o novo e-mail e uma senha forte. A alteração será analisada pela equipe Brussels Pet antes de ser aplicada.'); }
      else { setMessage(data.message || 'Solicitação recebida.'); }
    } catch { setMessage('Erro de conexão. Tente novamente.'); }
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
        <form onSubmit={submit}>
          {mode === 'senha' ? (
            <div className="field">
              <label htmlFor="email">E-mail cadastrado</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
              <p className="muted">Após confirmar, enviaremos um link seguro para o e-mail cadastrado. Abra o link para criar e confirmar sua nova senha.</p>
            </div>
          ) : (
            <>
              <div className="field"><label htmlFor="cnpj">CNPJ cadastrado</label><input id="cnpj" name="cnpj" required inputMode="numeric" placeholder="00.000.000/0000-00" /></div>
              <div className="field"><label htmlFor="telefone">Telefone / WhatsApp cadastrado</label><input id="telefone" name="telefone" required inputMode="tel" placeholder="DDD + número" /></div>
              {step === 2 && <>
                <div className="field"><label htmlFor="novoEmail">Novo e-mail</label><input id="novoEmail" name="novoEmail" type="email" required autoComplete="email" /></div>
                <div className="field"><label htmlFor="senha">Nova senha forte</label><input id="senha" name="senha" type="password" minLength={12} maxLength={72} required autoComplete="new-password" /><p className="muted">Mínimo de 12 caracteres, com maiúscula, minúscula, número e símbolo.</p></div>
                <div className="field"><label htmlFor="confirmacao">Confirme a nova senha</label><input id="confirmacao" name="confirmacao" type="password" minLength={12} maxLength={72} required autoComplete="new-password" /></div>
              </>}
              <p className="muted">{step === 1 ? 'Primeiro vamos conferir se o CNPJ e o telefone correspondem ao cadastro. Não enviamos SMS.' : 'Por segurança, o novo e-mail e a senha só serão aplicados após análise do administrador.'}</p>
            </>
          )}
          {message && <div className="msg warn" role="status">{message}</div>}
          <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Verificando...' : mode === 'senha' ? 'Confirmar' : step === 1 ? 'Conferir dados' : 'Enviar solicitação'}</button>
        </form>
        <p className="center muted" style={{ marginTop: 16 }}>Precisa de ajuda? <a href="mailto:contato.brussels@gmail.com"><b>Fale com o suporte</b></a></p>
        <p className="center muted"><Link href="/entrar"><b>Voltar para entrar</b></Link></p>
      </div>
    </div>
  );
}
