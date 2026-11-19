'use client';

import { useEffect, useState } from 'react';

export default function BlobMigrationTool() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/migracao-blob', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível consultar a migração.');
        if (active) setData(result);
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

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
          <p className="msg warn" style={{ marginTop: 16 }}>
            A execução está bloqueada. Esta tela apenas consulta os nomes e as contagens; nenhuma imagem foi enviada ou alterada.
          </p>
          <button className="btn" type="button" disabled={!data.executionEnabled || !data.ready}>
            Executar piloto — bloqueado até aprovação
          </button>
        </>
      )}
    </section>
  );
}
