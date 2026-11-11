'use client';

import { useState } from 'react';

export default function PIIMigrationButton({ configured }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function run() {
    if (!configured || busy) return;
    const confirmed = window.confirm('Confirma a criptografia dos telefones, endereços dos clientes e endereços dos pedidos que ainda estão em texto aberto? A operação preserva a visualização no sistema.');
    if (!confirmed) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/seguranca/migrar-dados', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) setMessage(data.error || 'Não foi possível concluir a migração.');
      else setMessage(`Concluído nesta execução: ${data.usersMigrated} cadastro(s) e ${data.ordersMigrated} pedido(s). Pendentes: ${data.usersPending} cadastro(s) e ${data.ordersPending} pedido(s). ${data.message}`);
    } catch {
      setMessage('Erro de conexão. Tente novamente.');
    }
    setBusy(false);
  }

  return (
    <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
      <h2 style={{ marginTop: 0 }}>Proteção de dados pessoais</h2>
      <p className="muted">Criptografa telefones, endereços e endereços de entrega já salvos. Os dados continuam disponíveis nas telas de clientes e pedidos.</p>
      {!configured && <p className="msg warn">Antes de executar, configure PII_ENCRYPTION_KEY na Vercel. Não execute a migração sem essa chave.</p>}
      <button className="btn" type="button" onClick={run} disabled={!configured || busy}>{busy ? 'Criptografando...' : 'Criptografar dados existentes'}</button>
      {message && <p className="msg" role="status">{message}</p>}
    </div>
  );
}
