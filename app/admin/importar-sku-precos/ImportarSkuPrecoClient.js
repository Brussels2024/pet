'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().replace(/\\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
function parsePrice(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  let raw = String(value ?? '').trim().replace(/R\\$/gi, '').replace(/\\s/g, '');
  if (!raw) return null;
  if (raw.includes(',') && raw.includes('.')) raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  else if (raw.includes(',')) raw = raw.replace(',', '.');
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function parseStock(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 ? value : null;
  const raw = String(value ?? '').trim();
  if (!raw || !/^\\d+$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
function findColumn(headers, aliases) {
  return headers.find((header) => aliases.includes(normalize(header)));
}
export default function ImportarSkuPrecoClient() {
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(null);
  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setFileName(file.name); setMessage('Lendo a planilha...'); setSummary(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error('A planilha está vazia.');
      const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
      const headerIndex = matrix.findIndex((row) => row.some((cell) => ['nome', 'produto', 'name'].includes(normalize(cell))));
      if (headerIndex < 0) throw new Error('Não encontrei a coluna Nome ou Produto na primeira aba.');
      const headers = matrix[headerIndex].map((cell) => String(cell ?? '').trim());
      const nameColumn = findColumn(headers, ['nome', 'produto', 'name']);
      const skuColumn = findColumn(headers, ['sku', 'codigo', 'codigo do produto', 'cod produto', 'referencia', 'ref']);
      const priceColumn = findColumn(headers, ['preco', 'valor', 'price']);
      const stockColumn = findColumn(headers, ['estoque', 'quantidade', 'quantidade em estoque', 'qtd', 'saldo']);
      const categoryColumn = findColumn(headers, ['categoria', 'category', 'linha', 'grupo']);
      if (!nameColumn || !skuColumn || !priceColumn || !stockColumn || !categoryColumn) {
        throw new Error('A planilha precisa ter as colunas Nome/Produto, SKU/Código, Preço, Quantidade em estoque e Categoria.');
      }
      const nameIndex = headers.indexOf(nameColumn), skuIndex = headers.indexOf(skuColumn);
      const priceIndex = headers.indexOf(priceColumn), stockIndex = headers.indexOf(stockColumn);
      const categoryIndex = headers.indexOf(categoryColumn);
      const rows = [];
      for (const row of matrix.slice(headerIndex + 1)) {
        const name = String(row[nameIndex] ?? '').trim();
        if (name) rows.push({
          name,
          sku: String(row[skuIndex] ?? '').trim(),
          price: parsePrice(row[priceIndex]),
          stock: parseStock(row[stockIndex]),
          category: String(row[categoryIndex] ?? '').trim(),
        });
      }
      if (!rows.length) throw new Error('Não encontrei produtos preenchidos na planilha.');
      if (rows.length > 5000) throw new Error('O arquivo tem mais de 5.000 linhas. Divida em arquivos menores.');
      setMessage('Localizando os produtos cadastrados e atualizando SKU, preço, estoque e categoria...');
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
    <section className="card" style={{ maxWidth: 760 }}>
      <h2>Atualizar produtos por planilha</h2>
      <p className="muted">Envie uma planilha Excel (.xlsx, .xls) ou CSV. O sistema procura cada produto pelo nome entre os já cadastrados e atualiza somente SKU, preço, quantidade em estoque e categoria. Nenhum produto novo será criado.</p>
      <div className="field"><label htmlFor="sku-price-file">Arquivo de atualização</label><input id="sku-price-file" type="file" accept=".xlsx,.xls,.csv,.ods" onChange={importFile} disabled={busy} /></div>
      {fileName && <p className="muted">Arquivo: {fileName}</p>}
      {busy && <p aria-live="polite">{message}</p>}
      {!busy && message && <p role="status">{message}</p>}
      {summary && <div style={{ marginTop: 16 }}>
        <h3>Resultado da importação</h3>
        <p><b>{summary.updated}</b> produtos atualizados.</p>
        <p><b>{summary.categoriesCreated}</b> categorias criadas automaticamente.</p>
        <p><b>{summary.notFound}</b> nomes não encontrados (não adicionados).</p>
        <p><b>{summary.ambiguous}</b> nomes repetidos no cadastro (não alterados).</p>
        <p><b>{summary.invalid}</b> linhas inválidas ou duplicadas (ignoradas).</p>
        {summary.details?.length > 0 && <details style={{ marginTop: 12 }}><summary>Ver itens que precisam de conferência</summary><ul>{summary.details.map((item, index) => <li key={index}>{item.name}: {item.reason}</li>)}</ul></details>}
      </div>}
      <p className="muted" style={{ marginTop: 16 }}>Colunas aceitas: Nome/Produto, SKU/Código, Preço/Valor, Estoque/Quantidade em estoque e Categoria/Linha/Grupo. A comparação de nomes ignora maiúsculas, minúsculas, acentos e espaços duplicados. Produtos que não existirem no cadastro serão ignorados.</p>
    </section>
  );
}
