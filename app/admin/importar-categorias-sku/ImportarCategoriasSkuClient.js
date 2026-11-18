'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().replace(/\\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function readRows(matrix) {
  const headerIndex = matrix.findIndex((row) => {
    const values = (row || []).map(normalize);
    return values.includes('sku') && values.includes('categoria') && values.includes('subcategoria');
  });
  if (headerIndex < 0) throw new Error('Não encontrei os cabeçalhos SKU, Categoria e Subcategoria na planilha.');
  const header = matrix[headerIndex].map(normalize);
  const skuIndex = header.indexOf('sku');
  const categoryIndex = header.indexOf('categoria');
  const subcategoryIndex = header.indexOf('subcategoria');
  const rows = [];
  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const row = matrix[i] || [];
    const sku = String(row[skuIndex] ?? '').trim();
    const category = String(row[categoryIndex] ?? '').trim();
    const subcategory = String(row[subcategoryIndex] ?? '').trim();
    if (!sku && !category && !subcategory) continue;
    if (!sku || !category) throw new Error('Linha ' + (i + 1) + ': preencha SKU e Categoria. Subcategoria pode ficar vazia.');
    rows.push({ sku, category, subcategory });
  }
  if (!rows.length) throw new Error('A planilha não contém linhas para importar.');
  return rows;
}

export default function ImportarCategoriasSkuClient() {
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(null);

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setFileName(file.name);
    setMessage('Lendo e conferindo a planilha...');
    setSummary(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('A planilha está vazia.');
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
      const rows = readRows(matrix);
      setMessage('Enviando ' + rows.length + ' vínculos para o sistema...');
      const response = await fetch('/api/admin/importar-categorias-sku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível importar as categorias.');
      setSummary(data);
      setMessage('Importação concluída.');
    } catch (error) {
      setMessage(error?.message || 'Não foi possível ler essa planilha.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  return (
    <section className="card" style={{ maxWidth: 760 }}>
      <h2>Adicionar categorias aos produtos existentes</h2>
      <p className="muted">Envie uma planilha Excel com três colunas: SKU, Categoria e Subcategoria. O SKU identifica o produto já cadastrado. Deixe Subcategoria vazia quando quiser vincular somente à categoria principal.</p>
      <p className="muted">Para colocar um produto em várias categorias, repita o SKU em outras linhas, informando cada categoria e subcategoria. A importação acrescenta os vínculos sem remover as categorias que o produto já possui. Categorias e subcategorias que ainda não existirem serão criadas automaticamente.</p>
      <div className="field">
        <label htmlFor="categories-sku-file">Planilha Excel (.xlsx ou .xls)</label>
        <input id="categories-sku-file" type="file" accept=".xlsx,.xls" onChange={importFile} disabled={busy} />
      </div>
      {fileName && <p className="muted">Arquivo: {fileName}</p>}
      {busy && <p aria-live="polite">{message}</p>}
      {!busy && message && <p role="status">{message}</p>}
      {summary && (
        <div style={{ marginTop: 16 }}>
          <h3>Resultado da importação</h3>
          <p><b>{summary.linked}</b> vínculos de categoria adicionados ou já existentes.</p>
          <p><b>{summary.productsFound}</b> produtos encontrados pelo SKU.</p>
          <p><b>{summary.categoriesCreated}</b> categorias e <b>{summary.subcategoriesCreated}</b> subcategorias criadas.</p>
          <p><b>{summary.notFound}</b> linhas ignoradas porque o SKU não foi encontrado.</p>
          {summary.details?.length > 0 && <details><summary>Ver SKUs não encontrados</summary><ul>{summary.details.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
        </div>
      )}
      <p className="muted" style={{ marginTop: 16 }}>Depois da importação, os produtos ativos ficam disponíveis automaticamente nas categorias correspondentes da loja, sem precisar editar cada anúncio.</p>
    </section>
  );
}
