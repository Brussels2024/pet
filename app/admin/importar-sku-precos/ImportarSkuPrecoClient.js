'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';

function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let raw = String(value ?? '').trim().replace(/R\\$/gi, '').replace(/\\s/g, '');
  if (!raw) return null;
  if (raw.includes(',') && raw.includes('.')) raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  else if (raw.includes(',')) raw = raw.replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
function readDescriptionRows(matrix) {
  for (let headerIndex = 0; headerIndex < Math.min(matrix.length, 10); headerIndex++) {
    const header = matrix[headerIndex] || [];
    const nameIndex = header.findIndex((value) => normalize(value) === 'nome do produto');
    const descriptionIndex = header.findIndex((value) => normalize(value) === 'descricao');
    if (nameIndex < 0 || descriptionIndex < 0) continue;

    const rows = [];
    for (let index = headerIndex + 1; index < matrix.length; index++) {
      const row = matrix[index] || [];
      const name = String(row[nameIndex] ?? '').trim();
      const description = String(row[descriptionIndex] ?? '').trim();
      if (!name && !description) continue;
      rows.push({ name, description });
    }
    if (!rows.length) throw new Error('Encontrei as colunas Nome do produto e Descrição, mas não há produtos preenchidos.');
    return rows;
  }
  return null;
}
function defaultColors(category) {
  const key = normalize(category);
  if (key.includes('black')) return ['Preto'];
  if (key.includes('comedouros') || key.includes('bebedouros')) return ['Azul', 'Rosa', 'Vermelho', 'Preto'];
  if (key.includes('neon')) return ['Roxo', 'Rosa', 'Laranja', 'Amarelo', 'Verde'];
  return [];
}
function colorsFromNote(note, category) {
  const raw = String(note ?? '').trim();
  if (!raw) return defaultColors(category);
  const upper = raw.toLocaleUpperCase('pt-BR');
  if (upper.includes('CORES VARIADAS')) return ['Cores variadas'];
  if (upper.includes('CORES SORTIDAS')) return ['Cores sortidas'];
  const match = upper.match(/(?:DISPON[IÍ]VEIS NAS CORES|CORES(?: NEON)?):?\\s*(.*)/);
  if (!match) return defaultColors(category);
  return match[1].split(/[,;]|\\s+E\\s+/).map((v) => v.trim()).filter(Boolean)
    .map((v) => v.toLocaleLowerCase('pt-BR').replace(/(^|[ -])([a-záéíóúãõç])/g, (_, sep, c) => sep + c.toLocaleUpperCase('pt-BR')));
}
function readCatalog(matrix) {
  const header = matrix[3] || [];
  if (normalize(header[0]) !== 'produto' || normalize(header[1]) !== 'codigo') {
    throw new Error('Não reconheci o formato da planilha. Use a tabela original ou um arquivo com as colunas Nome do produto e Descrição.');
  }
  let category = '';
  const rows = [];
  const errors = [];
  for (let index = 4; index < matrix.length; index++) {
    const row = matrix[index] || [];
    const name = String(row[0] ?? '').trim();
    const skuValue = row[1];
    if (!name) continue;
    const sku = String(skuValue ?? '').trim();
    if (!sku) {
      category = name;
      continue;
    }
    const price = parseNumber(row[4]);
    const minQuantity = parseNumber(row[5]);
    const packagePrice = parseNumber(row[6]);
    if (!category || price === null || minQuantity === null || packagePrice === null || !Number.isInteger(minQuantity) || minQuantity < 1) {
      errors.push({ name, reason: 'Faltou categoria ou há preço/quantidade mínima inválidos na linha ' + (index + 1) + '.' });
      continue;
    }
    rows.push({ name, sku, category, price, minQuantity, packagePrice, colors: colorsFromNote(row[7], category) });
  }
  if (!rows.length) throw new Error('Não encontrei produtos válidos na primeira aba da planilha.');
  if (errors.length) throw new Error('A planilha tem ' + errors.length + ' linha(s) com dados incompletos. Corrija antes de importar. Primeiro item: ' + errors[0].name + ' — ' + errors[0].reason);
  return rows;
}

export default function ImportarSkuPrecoClient() {
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(null);

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setFileName(file.name); setMessage('Lendo e identificando o formato da planilha...'); setSummary(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('A planilha está vazia.');
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      const descriptionRows = readDescriptionRows(matrix);
      if (descriptionRows) {
        setMessage('Arquivo de descrições identificado. Conferindo os nomes dos produtos...');
        const response = await fetch('/api/admin/importar-descricoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: descriptionRows }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível importar as descrições.');
        setSummary({ ...data, mode: 'descriptions' });
        setMessage('Conferência das descrições concluída.');
        return;
      }

      const rows = readCatalog(matrix);
      setMessage('Planilha de catálogo identificada. Conferidos ' + rows.length + ' produtos. Cadastrando no sistema...');
      const response = await fetch('/api/admin/importar-sku-precos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível importar a planilha.');
      setSummary({ ...data, mode: 'catalog' }); setMessage('Importação do catálogo concluída.');
    } catch (error) { setMessage(error?.message || 'Não foi possível ler esse arquivo.'); }
    finally { setBusy(false); event.target.value = ''; }
  }

  return (
    <section className="card" style={{ maxWidth: 760 }}>
      <h2>Importar planilha de produtos</h2>
      <p className="muted">O sistema identifica automaticamente o tipo de arquivo. A tabela original com Produto, Código/SKU, preços e demais dados continua usando a importação completa. Uma planilha com as colunas Nome do produto e Descrição será tratada como atualização somente de descrições: o sistema procura o nome exato já cadastrado e altera exclusivamente a descrição. SKU, preço, estoque, fotos, categorias e demais dados não são modificados.</p>
      <div className="field">
        <label htmlFor="sku-price-file">Arquivo Excel (.xlsx ou .xls)</label>
        <input id="sku-price-file" type="file" accept=".xlsx,.xls" onChange={importFile} disabled={busy} />
      </div>
      {fileName && <p className="muted">Arquivo: {fileName}</p>}
      {busy && <p aria-live="polite">{message}</p>}
      {!busy && message && <p role="status">{message}</p>}
      {summary?.mode === 'descriptions' && <div style={{ marginTop: 16 }}>
        <h3>Resultado da atualização de descrições</h3>
        <p><b>{summary.total}</b> linhas lidas.</p>
        <p><b>{summary.updated}</b> descrições adicionadas.</p>
        <p><b>{summary.notFound}</b> produtos não encontrados pelo nome exato.</p>
        <p><b>{summary.alreadyDescribed}</b> produtos já tinham descrição e foram preservados.</p>
        <p><b>{summary.ambiguous}</b> nomes duplicados no cadastro, ignorados por segurança.</p>
        <p><b>{summary.invalid}</b> linhas inválidas ou repetidas.</p>
        {summary.details?.length > 0 && <details><summary>Ver itens não atualizados e motivos</summary><ul>{summary.details.map((item, index) => <li key={index}>{item.name}: {item.reason}</li>)}</ul></details>}
      </div>}
      {summary?.mode === 'catalog' && <div style={{ marginTop: 16 }}>
        <h3>Resultado da importação</h3>
        <p><b>{summary.total}</b> linhas de produtos conferidas.</p>
        <p><b>{summary.created}</b> produtos novos cadastrados com estoque inicial de 1.000 unidades no total por produto.</p>
        <p><b>{summary.updated}</b> produtos existentes atualizados; estoque e fotos atuais preservados.</p>
        <p><b>{summary.variantsCreated}</b> opções de cores criadas.</p>
        <p><b>{summary.categoriesCreated}</b> categorias criadas automaticamente.</p>
        <p><b>{summary.invalid}</b> linhas inválidas ignoradas.</p>
        {summary.details?.length > 0 && <details><summary>Ver itens que precisam de conferência</summary><ul>{summary.details.map((item, index) => <li key={index}>{item.name}: {item.reason}</li>)}</ul></details>}
      </div>}
      <p className="muted" style={{ marginTop: 16 }}>Na importação de descrições, produtos que já possuem descrição são preservados. Se o nome não corresponder exatamente a um único produto cadastrado, o sistema não altera nada e mostra o motivo no resultado.</p>
    </section>
  );
}
