'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import ImportarVariacoesCores from '@/components/ImportarVariacoesCores';

function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let raw = String(value ?? '').trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!raw) return null;
  if (raw.includes(',') && raw.includes('.')) raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  else if (raw.includes(',')) raw = raw.replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
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
  const match = upper.match(/(?:DISPON[IÍ]VEIS NAS CORES|CORES(?: NEON)?):?\s*(.*)/);
  if (!match) return defaultColors(category);
  const parsed = match[1].split(/[,;]|\s+E\s+/).map((v) => v.trim()).filter(Boolean);
  return parsed.map((v) => v.toLocaleLowerCase('pt-BR').replace(/(^|[ -])([a-záéíóúãõç])/g, (_, sep, c) => sep + c.toLocaleUpperCase('pt-BR')));
}
function readCatalog(matrix) {
  const header = matrix[3] || [];
  if (normalize(header[0]) !== 'produto' || normalize(header[1]) !== 'codigo') {
    throw new Error('Não reconheci o formato da tabela. Confira se é o arquivo original da Brussels Pet.');
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
    setBusy(true); setFileName(file.name); setMessage('Lendo e conferindo todos os produtos...'); setSummary(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('A planilha está vazia.');
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const rows = readCatalog(matrix);
      setMessage('Conferidos ' + rows.length + ' produtos. Cadastrando no sistema...');
      const response = await fetch('/api/admin/importar-sku-precos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível importar a planilha.');
      setSummary(data); setMessage('Importação concluída.');
    } catch (error) { setMessage(error?.message || 'Não foi possível ler esse arquivo.'); }
    finally { setBusy(false); event.target.value = ''; }
  }

  return (
    <>
    <section className="card" style={{ maxWidth: 760 }}>
      <h2>Importar catálogo completo por planilha</h2>
      <p className="muted">Importa os produtos da tabela original, criando os que ainda não existem e atualizando os que já possuem o mesmo SKU e nome. Lê nome, código, preço unitário, quantidade mínima, preço do pacote, categoria e cores.</p>
      <div className="field">
        <label htmlFor="sku-price-file">Arquivo Excel original</label>
        <input id="sku-price-file" type="file" accept=".xlsx,.xls" onChange={importFile} disabled={busy} />
      </div>
      {fileName && <p className="muted">Arquivo: {fileName}</p>}
      {busy && <p aria-live="polite">{message}</p>}
      {!busy && message && <p role="status">{message}</p>}
      {summary && <div style={{ marginTop: 16 }}>
        <h3>Resultado da importação</h3>
        <p><b>{summary.total}</b> linhas de produtos conferidas.</p>
        <p><b>{summary.created}</b> produtos novos cadastrados com estoque inicial de 1.000 unidades.</p>
        <p><b>{summary.updated}</b> produtos existentes atualizados; estoque e fotos atuais preservados.</p>
        <p><b>{summary.categoriesCreated}</b> categorias criadas automaticamente.</p>
        <p><b>{summary.invalid}</b> linhas inválidas ignoradas.</p>
        {summary.details?.length > 0 && <details><summary>Ver itens que precisam de conferência</summary><ul>{summary.details.map((item, index) => <li key={index}>{item.name}: {item.reason}</li>)}</ul></details>}
      </div>}
      <p className="muted" style={{ marginTop: 16 }}>Produtos novos entram sem fotos para que você possa adicionar as imagens depois. Reimportar a tabela não zera o estoque nem apaga fotos de produtos existentes.</p>
    </section>
    <ImportarVariacoesCores />
    </>
  );
}
