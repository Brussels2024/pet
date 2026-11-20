'use client';

import { useEffect, useState } from 'react';

const FIRST_BATCH_CONFIRMATION = 'AUTORIZO O PRIMEIRO LOTE DE 5 IMAGENS';
const BATCH_CONFIRMATION = 'AUTORIZO LOTES DE ATÉ 25 IMAGENS';

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
    const isFirstBatch = mode === 'first_batch';
    const expected = isFirstBatch ? FIRST_BATCH_CONFIRMATION : BATCH_CONFIRMATION;
    const enabled = isFirstBatch ? data?.firstBatchExecutionEnabled : data?.batchExecutionEnabled;
    const items = isFirstBatch ? data?.firstBatchCandidates : data?.batchCandidates;
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

          <h3>Primeiro lote autorizado: 2 banners restantes + 3 produtos</h3>
          <ul>
            {data.firstBatchCandidates.map((item) => (
              <li key={item.table + '-' + item.id}>
                <b>{item.label}:</b> {item.name} <span className="muted">(registro {item.id})</span>
              </li>
            ))}
          </ul>
          {!data.firstBatchReady && <p className="msg warn">Não foi possível montar exatamente 2 banners e 3 produtos. Nenhuma imagem será enviada.</p>}
          {!data.firstBatchExecutionEnabled ? (
            <p className="msg warn" style={{ marginTop: 16 }}>O primeiro lote está bloqueado.</p>
          ) : (
            <div style={{ marginTop: 16 }}>
              <label htmlFor="blob-first-batch-confirm">Para executar, digite: {FIRST_BATCH_CONFIRMATION}</label>
              <input id="blob-first-batch-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
              <button className="btn" type="button" disabled={!data.firstBatchReady || confirmation !== FIRST_BATCH_CONFIRMATION || running} onClick={() => run('first_batch')}>
                {running ? 'Migrando...' : 'Executar primeiro lote de 5 imagens'}
              </button>
            </div>
          )}

          <h3 style={{ marginTop: 26 }}>Lotes seguintes (até 25 imagens por vez)</h3>
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
            <p className="msg warn">Os lotes de 25 imagens serão liberados somente depois que você conferir os 2 banners e os 3 produtos deste primeiro lote.</p>
          ) : (
            <div style={{ marginTop: 16 }}>
              <label htmlFor="blob-batch-confirm">Para executar, digite: {BATCH_CONFIRMATION}</label>
              <input id="blob-batch-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
              <button className="btn" type="button" disabled={!data.batchCandidates.length || confirmation !== BATCH_CONFIRMATION || running} onClick={() => run('batch')}>
                {running ? 'Migrando...' : 'Executar sequência de lotes de 25'}
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
