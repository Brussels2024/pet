'use client';

import { useMemo, useState } from 'react';

function abbreviation(name) {
  const parts = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().match(/[A-Z0-9]+/g) || [];
  if (!parts.length) return '';
  return (parts.length > 1 ? parts.map((part) => part[0]).join('') : parts[0].slice(0, 2)).slice(0, 4);
}
function normalize(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (typeof item === 'string') return { name: item, abbreviation: abbreviation(item), manualAbbreviation: false };
    return { name: String(item?.name || ''), abbreviation: String(item?.abbreviation || abbreviation(item?.name)), manualAbbreviation: Boolean(item?.abbreviation) };
  }).filter((item) => item.name);
}
export default function ProductVariantEditor({ initialColors = [], baseSku = '' }) {
  const [items, setItems] = useState(() => normalize(initialColors));
  const serialized = useMemo(() => JSON.stringify(items.map(({ manualAbbreviation, ...item }) => item)), [items]);
  function update(index, key, value) {
    setItems((current) => current.map((item, i) => {
      if (i !== index) return item;
      if (key === 'name') return { ...item, name: value, abbreviation: item.manualAbbreviation ? item.abbreviation : abbreviation(value) };
      return { ...item, abbreviation: value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4), manualAbbreviation: true };
    }));
  }
  function add() { setItems((current) => [...current, { name: '', abbreviation: '', manualAbbreviation: false }]); }
  function remove(index) { setItems((current) => current.filter((_, i) => i !== index)); }
  return (
    <div className="field">
      <label>Cores e variações</label>
      <input type="hidden" name="colors_json" value={serialized} />
      <p className="muted">A sigla é sugerida automaticamente. O SKU de cada cor será o SKU principal mais a sigla.</p>
      {items.map((item, index) => (
        <div className="grid2" key={index} style={{ alignItems: 'end', marginBottom: 8 }}>
          <div className="field">
            <label htmlFor={'variant-name-' + index}>Cor</label>
            <input id={'variant-name-' + index} value={item.name} onChange={(e) => update(index, 'name', e.target.value)} placeholder="Ex.: Azul" />
          </div>
          <div className="field">
            <label htmlFor={'variant-abbr-' + index}>Sigla</label>
            <input id={'variant-abbr-' + index} value={item.abbreviation} onChange={(e) => update(index, 'abbreviation', e.target.value)} placeholder="AZ" maxLength={4} />
            <small className="muted">SKU da variação: {baseSku ? baseSku + (item.abbreviation ? '-' + item.abbreviation : '') : 'Informe o SKU principal'}</small>
          </div>
          <button type="button" className="btn danger small" onClick={() => remove(index)}>Remover</button>
        </div>
      ))}
      <button type="button" className="btn outline small" onClick={add}>Adicionar cor</button>
    </div>
  );
}
