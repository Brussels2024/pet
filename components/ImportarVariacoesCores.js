'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().replace(/\\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function readRows(workbook) {
  const sheet = workbook.Sheets['Planilha1'] || workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('Não encontrei a primeira aba da planilha.');
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headerIndex = matrix.findIndex((row) => {
    const headers = (row || []).map(normalize);
    return headers.includes('produto') && headers.includes('sku') && headers.includes('cores');
  });
  if (headerIndex < 0) throw new Error('A primeira aba precisa conter as colunas Produto, SKU e CORES.');
  const headers = matrix[headerIndex].map(normalize);
  const rows = [];
  const seen = new Set();
  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const row = matrix[i] || [];
    const name = String(row[headers.indexOf('produto')] ?? '').trim();
    const sku = String(row[headers.indexOf('sku')] ?? '').trim();
    const rawColors = String(row[headers.indexOf('cores')] ?? '').trim();
    if (!name && !sku && !rawColors) continue;
    if (!sku || !rawColors) throw new Error('Linha ' + (i + 1) + ': SKU ou cores vazias.');
    const colors = rawColors.split(/\\s*,\\s*|\\s+E\\s+/i).map((v) => v.trim()).filter(Boolean);
    const key = sku.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) throw new Error('A SKU ' + sku + ' aparece mais de uma vez na planilha.');
    seen.add(key);
    rows.push({ name, sku, colors });
  }
  if (!rows.length) throw new Error('Não encontrei produtos com cores na planilha.');
  return rows;
}

export default function ImportarVariacoesCores() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(null);

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setMessage('Lendo SKUs e cores...'); setSummary(null);
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
      <p className="muted">Envie a planilha com as colunas Produto, SKU e CORES. O sistema procura cada SKU principal já cadastrada e acrescenta somente as cores que ainda não existem, usando a mesma sigla automática do cadastro manual. Não altera nome, SKU principal, preço, estoque, fotos ou outras informações do produto.</p>
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
