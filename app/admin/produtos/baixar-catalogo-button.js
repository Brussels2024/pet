'use client';

import { useState } from 'react';

export default function BaixarCatalogoButton() {
  const [loading, setLoading] = useState(false);

  async function baixarCatalogo() {
    if (loading) return;
    setLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90000);

    try {
      const response = await fetch('/api/admin/catalogo', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = 'Não foi possível gerar o catálogo PDF.';
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
        } catch {}
        throw new Error(message);
      }

      const blob = await response.blob();
      if (!blob.size || (blob.type && !blob.type.includes('pdf'))) {
        throw new Error('O catálogo não retornou um arquivo PDF válido.');
      }

      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'catalogo-brussels-pet.pdf';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      const message = error?.name === 'AbortError'
        ? 'A geração do catálogo demorou demais. Tente novamente; o sistema encerrou a solicitação para não deixar o botão travado.'
        : (error?.message || 'Erro ao baixar o catálogo PDF.');
      window.alert(message);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  return (
    <button className="btn outline" type="button" onClick={baixarCatalogo} disabled={loading}>
      {loading ? 'Gerando PDF...' : 'Baixar catálogo PDF'}
    </button>
  );
}
