'use client';

import { useEffect, useState } from 'react';

const BATCH_CONFIRMATION = 'AUTORIZO LOTES DE ATÉ 25 IMAGENS';

export default function BlobMigrationTool() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmation, setConfirmation] = useState('');
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);

  async function loadSnapshot(showLoading = false) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/migracao-blob', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível consultar a migração.');
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function refresh() {
    try {
      await loadSnapshot(true);
    } catch {
      // O erro já é exibido na tela.
    }
  }

  useEffect(() => { refresh(); }, []);

  async function runBatchSequence() {
    if (!data?.batchExecutionEnabled || confirmation !== BATCH_CONFIRMATION || running) return;
    setRunning(true);
    setError('');
    setConfirmation('');

    const totals = { migrated: 0, skipped: 0, failed: 0, remaining: data.counts.total, remainingByTable: data.counts.byTable };
    const allDetails = { migrated: [], skipped: [], failed: [] };\n    let batchesProcessed = 0;
    setReport({ ...totals, details: allDetails, running: true, batches: 0, stoppedOnError: false });

    try {
      let snapshot = data;
      while (totals.remaining > 0) {
        const candidates = snapshot.batchCandidates || [];
        if (!candidates.length) {
          snapshot = await loadSnapshot();
          if (snapshot.counts.total === 0) {
            totals.remaining = 0;
            totals.remainingByTable = snapshot.counts.byTable;
            break;
          }
          if (!snapshot.batchCandidates?.length) {
            throw new Error('Ainda existem imagens base64, mas nenhum candidato foi encontrado. A sequência foi interrompida sem alterar esses registros.');
          }
        }

        const items = snapshot.batchCandidates.slice(0, 25);
        const response = await fetch('/api/admin/migracao-blob', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'batch', confirmation: BATCH_CONFIRMATION, items }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'O lote foi recusado. A sequência foi interrompida.');

        totals.migrated += result.migrated || 0;
        totals.skipped += result.skipped || 0;
        totals.failed += result.failed || 0;
        totals.remaining = result.remaining;
        totals.remainingByTable = result.remainingByTable;
        allDetails.migrated.push(...(result.details?.migrated || []));
        allDetails.skipped.push(...(result.details?.skipped || []));
        allDetails.failed.push(...(result.details?.failed || []));
        batchesProcessed += 1;
        setReport({
          ...totals,
          details: { ...allDetails },
          running: true,
          batches: batchesProcessed,
          stoppedOnError: Boolean(result.stoppedOnError),
        });

        if (result.failed > 0 || result.stoppedOnError) break;
        if (result.remaining === 0) break;
        if ((result.migrated || 0) + (result.skipped || 0) === 0) {
          throw new Error('Nenhuma imagem avançou neste lote. A sequência foi interrompida para evitar repetição.');
        }

        snapshot = await loadSnapshot();
        if (snapshot.counts.total === 0) {
          totals.remaining = 0;
          totals.remainingByTable = snapshot.counts.byTable;
          break;
        }
      }

      setReport({
        ...totals,
        details: { ...allDetails },
        running: false,
        batches: batchesProcessed,
        stoppedOnError: totals.failed > 0,
        completed: totals.remaining === 0 && totals.failed === 0,
      });
      await loadSnapshot();
    } catch (err) {
      setError(err.message);
      setReport((previous) => previous ? { ...previous, ...totals, details: { ...allDetails }, running: false, stoppedOnError: true } : null);
      try { await loadSnapshot(); } catch { /* Mantém o último contador confirmado. */ }
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="card" style={{ padding: 20, marginTop: 18 }}>
      <h2>Migração de imagens para Blob</h2>
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

          <h3>Sequência automática de lotes de até 25 imagens</h3>
          <p>O botão executa um lote por vez e atualiza os contadores após cada lote. A sequência para no primeiro erro ou quando não houver mais imagens base64.</p>
          {!data.batchExecutionEnabled ? (
            <p className="msg warn">Execução dos lotes bloqueada.</p>
          ) : data.counts.total === 0 ? (
            <p className="msg success">Não há imagens base64 restantes. Migração concluída.</p>
          ) : (
            <div style={{ marginTop: 16 }}>
              <label htmlFor="blob-batch-confirm">Para iniciar, digite: {BATCH_CONFIRMATION}</label>
              <input id="blob-batch-confirm" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" disabled={running} />
              <button className="btn" type="button" disabled={confirmation !== BATCH_CONFIRMATION || running || loading} onClick={runBatchSequence}>
                {running ? 'Migrando lotes...' : 'Iniciar sequência de lotes de 25'}
              </button>
            </div>
          )}

          {report && (
            <div style={{ marginTop: 20 }}>
              <h3>Progresso da migração</h3>
              <p>Lotes processados: <b>{report.batches || 0}</b></p>
              <p>Migradas: <b>{report.migrated}</b> · Falhas: <b>{report.failed}</b> · Restantes: <b>{report.remaining}</b></p>
              <p>Ignoradas (já alteradas ou não encontradas): <b>{report.skipped}</b></p>
              <p className="muted">Banners: {report.remainingByTable.banners} · Produtos: {report.remainingByTable.products} · Fotos adicionais: {report.remainingByTable.product_images}</p>
              {report.running && <p>Sequência em andamento. Os números são atualizados a cada lote.</p>}
              {report.completed && <p className="msg success">Concluído: 0 imagens base64 restantes. Contagem final exibida acima. A sequência foi encerrada.</p>}
              {report.stoppedOnError && <p className="msg error">A sequência foi interrompida no primeiro erro. Nenhum lote posterior foi iniciado.</p>}
              {!!report.details.failed.length && (
                <ul>
                  {report.details.failed.map((item, index) => (
                    <li key={item.table + '-' + item.id + '-' + index}>
                      {item.table} #{item.id}: {item.reason}
                    </li>
                  ))}
                </ul>
              )}
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
