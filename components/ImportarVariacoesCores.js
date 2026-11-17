'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

function isSkuHeader(value) {
  const header = normalize(value).replace(/[^a-z0-9]/g, '');
  return ['sku', 'skuproduto', 'codigosku', 'codigodosku', 'referencias ku', 'referenciasku'].includes(header);
}

function isColorHeader(value) {
  const header = normalize(value);
  return /^(cores?|colors?|cor\s*\d+|cores?\s*\d+|color\s*\d+|colors?\s*\d+|variacoes?\s*(de\s*)?cores?|tonalidades?)$/.test(header);
}

function splitColors(value) {
  if (Array.isArray(value)) return value.flatMap(splitColors);
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  return raw
    .split(/[,;\n|]+|\s+e\s+/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readRows(workbook) {
  const sheet = workbook.Sheets['Planilha1'] || workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('Não encontrei uma aba válida na planilha.');

  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  let headerIndex = -1;
  let skuColumn = -1;
  let colorColumns = [];

  // Procura a linha de cabeçalho sem exigir uma estrutura fixa ou a coluna Produto.
  for (let i = 0; i < Math.min(matrix.length, 40); i++) {
    const headers = (matrix[i] || []).map(normalize);
    const foundSku = headers.findIndex(isSkuHeader);
    const foundColors = headers
      .map((header, index) => isColorHeader(header) ? index : -1)
      .filter((index) => index >= 0);
    if (foundSku >= 0 && foundColors.length) {
      headerIndex = i;
      skuColumn = foundSku;
      colorColumns = foundColors;
      break;
    }
  }

  if (headerIndex < 0) {
    throw new Error('Não encontrei na planilha uma coluna de SKU e pelo menos uma coluna identificando as cores. As demais colunas podem ter qualquer conteúdo.');
  }

  const grouped = new Map();
  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const row = matrix[i] || [];
    const sku = String(row[skuColumn] ?? '').trim();
    const colors = [...new Set(colorColumns.flatMap((column) => splitColors(row[column])))];
    if (!sku && !colors.length) continue;
    if (!sku) continue;
    if (!colors.length) continue;

    const key = sku.toLocaleLowerCase('pt-BR');
    if (!grouped.has(key)) grouped.set(key, { sku, colors: [] });
    const item = grouped.get(key);
    const known = new Set(item.colors.map(normalize));
    for (const color of colors) {
      if (!known.has(normalize(color))) {
        item.colors.push(color);
        known.add(normalize(color));
      }
    }
  }

  const rows = [...grouped.values()].filter((item) => item.colors.length);
  if (!rows.length) throw new Error('Não encontrei linhas com SKU e cores preenchidas na planilha.');
  return rows;
}

export default function ImportarVariacoesCores() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(null);

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage('Lendo SKUs e cores...');
    setSummary(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = readRows(workbook);
      setMessage('Encontrados ' + rows.length + ' produtos. Localizando as SKUs...');
      const response = await fetch('/api/admin/importar-variacoes-cores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível importar as cores.');
      setSummary(data);
      setMessage('Importação de cores concluída.');
    } catch (error) {
      setMessage(error?.message || 'Não foi possível ler esse arquivo.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  return (
    <section className="card" style={{ maxWidth: 760, marginTop: 16 }}>
      <h2>Adicionar variações de cores por SKU</h2>
      <p className="muted">Envie sua planilha original, mesmo que ela tenha várias colunas e outras informações. O sistema identifica a coluna SKU e uma ou mais colunas de cores, procura os produtos pela SKU principal e acrescenta somente as cores que ainda não existem, usando a mesma sigla automática do cadastro manual. Não altera nome, SKU principal, preço, estoque, fotos ou outras informações do produto.</p>
      <div className="field">
        <label htmlFor="color-variation-file">Planilha Excel de variações</label>
        <input id="color-variation-file" type="file" accept=".xlsx,.xls" onChange={importFile} disabled={busy} />
      </div>
      {busy && <p aria-live="polite">{message}</p>}
      {!busy && message && <p role="status">{message}</p>}
      {summary && <div style={{ marginTop: 12 }}>
        <p><b>{summary.matched}</b> produtos encontrados e processados.</p>
        <p><b>{summary.added}</b> variações adicionadas.</p>
        <p><b>{summary.unchanged}</b> cores já existentes, mantidas sem duplicação.</p>
        <p><b>{summary.notFound}</b> SKUs não encontradas; <b>{summary.ambiguous}</b> SKUs duplicadas no cadastro.</p>
        {summary.details?.length > 0 && <details><summary>Ver SKUs que precisam de conferência</summary><ul>{summary.details.map((item, index) => <li key={index}>{item.sku}: {item.reason}</li>)}</ul></details>}
      </div>}
    </section>
  );
}
