'use client';

import { useState } from 'react';
import { unzipSync } from 'fflate';

function titleCase(value) {
  return value.split(/\s+/).filter(Boolean).map((word) => {
    if (/^(af|n[1-5]|big|g|m|p)$/i.test(word)) return word.toUpperCase();
    return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1).toLocaleLowerCase('pt-BR');
  }).join(' ');
}

function productDescription(name) {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('comedouro') || normalized.includes('bebedouro')) {
    return `${name}. Acessório para a rotina de alimentação ou hidratação dos pets, com formato prático para o uso diário. Uma opção para organizar o momento das refeições do animal.`;
  }
  if (['bandeja', 'sanitario', 'pa de gato', 'rastelo', 'escova'].some((word) => normalized.includes(word))) {
    return `${name}. Acessório para auxiliar nos cuidados e na higiene do ambiente dos pets, ajudando a tornar a rotina de limpeza mais prática.`;
  }
  if (normalized.includes('ratinho') || normalized.includes('ratinhos')) {
    return `${name}. Brinquedo para gatos que estimula a curiosidade e incentiva momentos de brincadeira e atividade, enriquecendo a rotina do pet.`;
  }
  if (['anemona', 'anilha', 'bola', 'frisbee', 'halteres', 'osso', 'pneu', 'puxador', 'spinner', 'carambola', 'pote bola'].some((word) => normalized.includes(word))) {
    return `${name}. Brinquedo para pets pensado para proporcionar momentos de diversão e atividade. Seu formato favorece brincadeiras e ajuda a enriquecer a rotina do animal. Supervisione o uso.`;
  }
  if (normalized.includes('kit')) {
    return `${name}. Kit de acessórios para auxiliar nos cuidados diários com o pet, reunindo itens práticos para a rotina.`;
  }
  return `${name}. Produto para pets pensado para complementar os cuidados e a rotina do animal. Consulte as informações do modelo antes da utilização.`;
}

function imageAsJpeg(bytes) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' }));
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 720 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('Não foi possível preparar uma das fotos.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL('image/jpeg', 0.48);
      if (data.length > 650000) data = canvas.toDataURL('image/jpeg', 0.36);
      if (data.length > 650000) data = canvas.toDataURL('image/jpeg', 0.26);
      URL.revokeObjectURL(url);
      if (data.length > 650000) reject(new Error('Uma das fotos ficou maior que o limite permitido.'));
      else resolve(data);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir uma das fotos do arquivo ZIP.'));
    };
    image.src = url;
  });
}

function getProductName(folder, parent) {
  let name = folder.replace(/^\S+\s+/, '').trim() || parent.trim();
  if (name.toLowerCase() === 'bola black cravo 75' && parent.toLowerCase().includes('85')) {
    name = parent;
  }
  return titleCase(name);
}

export default function ImportarCatalogoClient() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState('');

  async function importZip(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult('');
    setProgress('Lendo o arquivo ZIP...');
    try {
      const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const groups = new Map();
      for (const [path, bytes] of Object.entries(archive)) {
        if (!/\.gif$/i.test(path) || path.split('/').length < 4) continue;
        const parts = path.split('/');
        const key = parts.slice(0, 3).join('/');
        if (!groups.has(key)) groups.set(key, { parent: parts[1], folder: parts[2], bytes });
      }

      const prepared = [];
      const usedNames = new Set();
      const entries = [...groups.values()].sort((a, b) => `${a.parent}/${a.folder}`.localeCompare(`${b.parent}/${b.folder}`, 'pt-BR'));
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        let name = getProductName(entry.folder, entry.parent);
        if (usedNames.has(name.toLocaleLowerCase('pt-BR'))) name = titleCase(entry.parent);
        if (usedNames.has(name.toLocaleLowerCase('pt-BR'))) name = `${name} ${index + 1}`;
        usedNames.add(name.toLocaleLowerCase('pt-BR'));
        const image = await imageAsJpeg(entry.bytes);
        prepared.push({ name, description: productDescription(name), image });
        setProgress(`Preparando fotos: ${index + 1} de ${entries.length}`);
      }

      let added = 0;
      let skipped = 0;
      const batchSize = 5;
      for (let start = 0; start < prepared.length; start += batchSize) {
        const response = await fetch('/api/admin/importar-catalogo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: prepared.slice(start, start + batchSize) }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Falha ao salvar os produtos.');
        added += Number(data.added || 0);
        skipped += Number(data.skipped || 0);
        setProgress(`Cadastrando produtos: ${Math.min(start + batchSize, prepared.length)} de ${prepared.length}`);
      }
      setResult(`Importação concluída: ${added} produtos cadastrados e ${skipped} ignorados por já existirem ou não passarem na validação.`);
      setProgress('Concluído.');
    } catch (error) {
      setResult(error?.message || 'Não foi possível importar o arquivo.');
      setProgress('Importação interrompida.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  return (
    <section className="card" style={{ maxWidth: 760 }}>
      <h2>Importar catálogo de produtos</h2>
      <p className="muted">Selecione o ZIP com as fotos separadas por produto. O sistema cria um cadastro separado para cada uma das 145 pastas de modelo. Usa o nome da pasta do produto e somente a primeira foto encontrada como capa. As demais fotos ficam para você adicionar depois na edição. As fotos GIF são convertidas e reduzidas para JPEG para facilitar o envio pelo iPhone.</p>
      <p className="muted">Os produtos entram ocultos na loja, com SKU, preço e estoque em branco/zero, para você completar e publicar depois. Você poderá editar cada produto e adicionar até mais cinco fotos.</p>
      <div className="field">
        <label htmlFor="catalog-zip">Arquivo ZIP do catálogo</label>
        <input id="catalog-zip" type="file" accept=".zip,application/zip" onChange={importZip} disabled={busy} />
      </div>
      {busy && <p aria-live="polite">{progress}</p>}
      {result && <p role="status">{result}</p>}
      <p className="muted">As imagens são preparadas no navegador e enviadas em pequenos lotes; o arquivo ZIP inteiro não é enviado ao servidor.</p>
    </section>
  );
}