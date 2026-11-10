'use client';

import { useState } from 'react';

const EMPTY = {
  cnpj: '',
  razao_social: '',
  nome_fantasia: '',
  email: '',
  senha: '',
  telefone: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
};

export default function CadastroForm() {
  const [f, setF] = useState(EMPTY);
  const [cnpjInfo, setCnpjInfo] = useState(null); // { type: 'ok' | 'error' | 'warn', text }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }));
  const merge = (values) =>
    setF((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(values)) {
        if (v) next[k] = v;
      }
      return next;
    });

  async function consultarCnpj() {
    const digits = f.cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return;
    setChecking(true);
    setCnpjInfo(null);
    try {
      const res = await fetch(`/api/cnpj/${digits}`);
      const data = await res.json();
      if (res.ok) {
        const d = data.data;
        merge({
          razao_social: d.razao_social,
          nome_fantasia: d.nome_fantasia,
          telefone: d.telefone,
          cep: d.cep,
          logradouro: d.logradouro,
          numero: d.numero,
          complemento: d.complemento,
          bairro: d.bairro,
          cidade: d.cidade,
          uf: d.uf,
        });
        if (d.situacao === 'ATIVA') {
          setCnpjInfo({ type: 'ok', text: `${d.razao_social} — situação cadastral ATIVA.` });
        } else {
          setCnpjInfo({ type: 'error', text: `Situação cadastral: ${d.situacao || 'desconhecida'}. Só é possível cadastrar CNPJ ativo.` });
        }
      } else if (data.code === 'indisponivel') {
        setCnpjInfo({ type: 'warn', text: data.error });
      } else {
        setCnpjInfo({ type: 'error', text: data.error || 'Não foi possível consultar o CNPJ.' });
      }
    } catch {
      setCnpjInfo({ type: 'warn', text: 'Não conseguimos consultar o CNPJ agora. Você pode continuar para aprovação manual.' });
    }
    setChecking(false);
  }

  async function consultarCep() {
    const digits = f.cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const d = await res.json();
      if (!d.erro) {
        merge({ logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, uf: d.uf });
      }
    } catch {
      // o cliente pode preencher o endereço manualmente
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível concluir o cadastro.');
        setBusy(false);
        return;
      }
      window.location.href = '/';
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h2 style={{ marginTop: 0 }}>Dados da empresa</h2>
      <div className="field">
        <label htmlFor="cnpj">CNPJ</label>
        <div className="inline-form">
          <input
            id="cnpj"
            value={f.cnpj}
            onChange={set('cnpj')}
            onBlur={consultarCnpj}
            placeholder="00.000.000/0000-00"
            required
            inputMode="numeric"
            style={{ flex: 1 }}
          />
          <button type="button" className="btn outline" onClick={consultarCnpj} disabled={checking}>
            {checking ? 'Consultando...' : 'Consultar'}
          </button>
        </div>
        {cnpjInfo && <div className={`msg ${cnpjInfo.type}`}>{cnpjInfo.text}</div>}
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="razao">Razão social</label>
          <input id="razao" value={f.razao_social} onChange={set('razao_social')} required />
        </div>
        <div className="field">
          <label htmlFor="fantasia">Nome fantasia</label>
          <input id="fantasia" value={f.nome_fantasia} onChange={set('nome_fantasia')} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="tel">Telefone / WhatsApp</label>
        <input id="tel" value={f.telefone} onChange={set('telefone')} inputMode="tel" />
      </div>

      <h2>Endereço</h2>
      <div className="grid2">
        <div className="field">
          <label htmlFor="cep">CEP</label>
          <input id="cep" value={f.cep} onChange={set('cep')} onBlur={consultarCep} inputMode="numeric" />
        </div>
        <div className="field">
          <label htmlFor="log">Rua / avenida</label>
          <input id="log" value={f.logradouro} onChange={set('logradouro')} />
        </div>
      </div>
      <div className="grid3">
        <div className="field">
          <label htmlFor="bairro">Bairro</label>
          <input id="bairro" value={f.bairro} onChange={set('bairro')} />
        </div>
        <div className="field">
          <label htmlFor="num">Número</label>
          <input id="num" value={f.numero} onChange={set('numero')} />
        </div>
        <div className="field">
          <label htmlFor="comp">Complemento</label>
          <input id="comp" value={f.complemento} onChange={set('complemento')} />
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="cidade">Cidade</label>
          <input id="cidade" value={f.cidade} onChange={set('cidade')} />
        </div>
        <div className="field">
          <label htmlFor="uf">UF</label>
          <input id="uf" value={f.uf} onChange={set('uf')} maxLength={2} />
        </div>
      </div>

      <h2>Acesso</h2>
      <div className="grid2">
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={f.email} onChange={set('email')} required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="senha">Senha (mínimo 12 caracteres)</label>
          <input id="senha" type="password" value={f.senha} onChange={set('senha')} required minLength={12} autoComplete="new-password" maxLength={72} />
        </div>
      </div>

      {error && <div className="msg error">{error}</div>}
      <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
        {busy ? 'Enviando...' : 'Criar conta empresarial'}
      </button>
    </form>
  );
}
