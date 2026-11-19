'use client';

import { useEffect, useState } from 'react';

const CONFIRMATION_TEXT = 'AUTORIZO O PILOTO DE 3 IMAGENS';

export default function BlobMigrationTool() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmation, setConfirmation] = useState('');
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/migracao-blob', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível consultar a migração.');
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function runPilot() {
    if (!data?.executionEnabled || confirmation !== CONFIRMATION_TEXT || !data.ready || running) return;
    setRunning(true);
    setError('');
    setReport(null);
    try {
      const response = await fetch('/api/admin/migracao-blob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation, items: data.candidates }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível executar o piloto.');
      setReport(result);
      setConfirmation('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="card" style={{ padding: 20, marginTop: 18 }}>
      <h2>Conferência do piloto</h2>
      {loading && <p>Consultando o banco...</p>}
      {error && <p className="msg error">{error}</p>}
      {data && (
        <>
          <p><b>Ambiente:</b> Preview · <b>Armazenamento:</b> {data.store}</p>
          <div className="stats" style={{ margin: '16px 0' }}>
            <div className="stat"><b>{data.counts.total}</b>Imagens base64 restantes</div>
            <div className="stat"><b>{data.counts.byTable.banners}</b>Banners</div>
            <div className="stat"><b>{data.counts.byTable.products}</b>Imagens principais</div>
            <div className="stat"><b>{data.counts.byTable.product_images}</b>Fotos adicionais</div>
          </div>
          <h3>Três registros previstos para o piloto</h3>
          <ul>
            {data.candidates.map((item, index) => (
              <li key={item ? item.kind + '-' + item.id : 'missing-' + index}>
                {item ? <><b>{item.label}:</b> {item.name} <span className="muted">(registro {item.id})</span></> : <span className="muted">Não foi encontrado um registro elegível para esta categoria.</span>}
              </li>
            ))}
          </ul>
          {!data.ready && <p className="msg warn">O piloto ainda não está completo: falta encontrar um dos três tipos de imagem.</p>}
          {!data.executionEnabled ? (
            <p className="msg warn" style={{ marginTop: 16 }}>
              A execução está bloqueada até sua aprovação expressa. Esta tela apenas consulta os nomes e as contagens; nenhuma imagem foi enviada ou alterada.
            </p>
          ) : (
            <div style={{ marginTop: 16 }}>
              <label htmlFor="blob-pilot-confirm">Para executar, digite: {CONFIRMATION_TEXT}</label>
              <input id="blob-pilot-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
              <button className="btn" type="button" disabled={!data.ready || confirmation !== CONFIRMATION_TEXT || running} onClick={runPilot}>
                {running ? 'Migrando...' : 'Executar piloto de 3 imagens'}
              </button>
            </div>
          )}
          {report && (
            <div style={{ marginTop: 18 }}>
              <h3>Resultado do lote</h3>
              <p>Migradas: <b>{report.migrated}</b> · Ignoradas: <b>{report.skipped}</b> · Falhas: <b>{report.failed}</b></p>
              <p>Imagens base64 restantes: <b>{report.remaining}</b></p>
              <p className="muted">Banners: {report.remainingByTable.banners} · Produtos: {report.remainingByTable.products} · Fotos extras: {report.remainingByTable.product_images}</p>
            </div>
          )}
          <button className="btn outline" type="button" onClick={refresh} disabled={loading || running} style={{ marginTop: 14 }}>
            Atualizar conferência
          </button>
        </>
      )}
    </section>
  );
}
