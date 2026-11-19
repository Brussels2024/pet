'use client';

import { useEffect, useState } from 'react';

const PILOT_CONFIRMATION = 'AUTORIZO O PILOTO DE 3 IMAGENS';
const BATCH_CONFIRMATION = 'AUTORIZO O LOTE DE ATÉ 5 IMAGENS';

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

  async function run(mode) {
    const isPilot = mode === 'pilot';
    const expected = isPilot ? PILOT_CONFIRMATION : BATCH_CONFIRMATION;
    const enabled = isPilot ? data?.executionEnabled : data?.batchExecutionEnabled;
    const items = isPilot ? data?.candidates : data?.batchCandidates;
    if (!enabled || confirmation !== expected || !items?.length || running) return;

    setRunning(true);
    setError('');
    setReport(null);
    try {
      const response = await fetch('/api/admin/migracao-blob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, confirmation, items }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível executar o lote.');
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
      <h2>Conferência da migração</h2>
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

          <h3>1. Três registros previstos para o piloto</h3>
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
              O piloto está bloqueado até sua aprovação expressa. Esta tela apenas consulta nomes e contagens; nenhuma imagem foi enviada ou alterada.
            </p>
          ) : (
            <div style={{ marginTop: 16 }}>
              <label htmlFor="blob-pilot-confirm">Para executar, digite: {PILOT_CONFIRMATION}</label>
              <input id="blob-pilot-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
              <button className="btn" type="button" disabled={!data.ready || confirmation !== PILOT_CONFIRMATION || running} onClick={() => run('pilot')}>
                {running ? 'Migrando...' : 'Executar piloto de 3 imagens'}
              </button>
            </div>
          )}

          <h3 style={{ marginTop: 26 }}>2. Próximos lotes (até 5 imagens por vez)</h3>
          {data.batchCandidates.length ? (
            <ul>
              {data.batchCandidates.map((item) => (
                <li key={item.table + '-' + item.id}>
                  <b>{item.label}:</b> {item.name} <span className="muted">(registro {item.id})</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Não há imagens base64 restantes para os próximos lotes.</p>}
          {!data.batchExecutionEnabled ? (
            <p className="msg warn">Os lotes seguintes só serão liberados depois que você conferir o piloto e autorizar a continuação.</p>
          ) : (
            <div style={{ marginTop: 16 }}>
              <label htmlFor="blob-batch-confirm">Para executar, digite: {BATCH_CONFIRMATION}</label>
              <input id="blob-batch-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
              <button className="btn" type="button" disabled={!data.batchCandidates.length || confirmation !== BATCH_CONFIRMATION || running} onClick={() => run('batch')}>
                {running ? 'Migrando...' : 'Executar próximo lote'}
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
