'use client';

import { useState } from 'react';

const PALETTE = [
  { name: 'Preto', hex: '#111111' }, { name: 'Branco', hex: '#ffffff' },
  { name: 'Cinza', hex: '#888888' }, { name: 'Prata', hex: '#c0c0c0' },
  { name: 'Vermelho', hex: '#e53935' }, { name: 'Vinho', hex: '#7b1e3a' },
  { name: 'Laranja', hex: '#fb8c00' }, { name: 'Amarelo', hex: '#fdd835' },
  { name: 'Dourado', hex: '#d4af37' }, { name: 'Verde', hex: '#43a047' },
  { name: 'Verde claro', hex: '#9ccc65' }, { name: 'Azul', hex: '#1e88e5' },
  { name: 'Azul marinho', hex: '#17365d' }, { name: 'Azul claro', hex: '#81d4fa' },
  { name: 'Roxo', hex: '#8e24aa' }, { name: 'Lilás', hex: '#ce93d8' },
  { name: 'Rosa', hex: '#ec407a' }, { name: 'Marrom', hex: '#795548' },
  { name: 'Bege', hex: '#d7c3a3' }, { name: 'Turquesa', hex: '#26a69a' },
];

function labelFor(hex) {
  return PALETTE.find(item => item.hex.toLowerCase() === String(hex || '').toLowerCase())?.name || 'Outra cor';
}

export default function ProductColorsEditor({ initialColors = [] }) {
  const [colors, setColors] = useState(initialColors.map(c => ({ ...c, name: c.name || labelFor(c.hex) })));

  function addColor(item) {
    setColors(current => {
      if (current.some(color => String(color.hex).toLowerCase() === item.hex.toLowerCase())) return current;
      return [...current, { name: item.name, sku: '', hex: item.hex, stock: 0, min_stock: 0 }];
    });
  }

  function change(index, key, value) {
    setColors(current => current.map((color, i) => i === index ? { ...color, [key]: value } : color));
  }

  function remove(index) {
    setColors(current => current.filter((_, i) => i !== index));
  }

  return <section className="field">
    <h2 style={{ marginBottom: 4 }}>Cores e estoque por cor</h2>
    <p className="muted">Clique nas cores da paleta. Depois informe o SKU, o estoque e o mínimo de compra.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: 9, maxWidth: 440, margin: '12px 0 18px' }}>
      {PALETTE.map(item => {
        const selected = colors.some(color => String(color.hex).toLowerCase() === item.hex.toLowerCase());
        return <button key={item.hex} type="button" title={item.name} aria-label={item.name} aria-pressed={selected} onClick={() => addColor(item)}
          style={{ width: 30, height: 30, padding: 0, borderRadius: '50%', background: item.hex, border: selected ? '3px solid #7c3aed' : '1px solid #aaa', boxShadow: selected ? '0 0 0 2px white, 0 0 0 4px #7c3aed' : 'none', cursor: selected ? 'default' : 'pointer', opacity: selected ? .55 : 1 }} />;
      })}
    </div>
    <input type="hidden" name="colors_json" value={JSON.stringify(colors)} />
    {colors.length === 0 ? <p className="muted">Nenhuma cor selecionada ainda.</p> : colors.map((color, index) => (
      <div key={color.id || color.hex} className="card" style={{ marginBottom: 10, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span aria-label={labelFor(color.hex)} title={labelFor(color.hex)} style={{ width: 30, height: 30, flex: '0 0 30px', borderRadius: '50%', background: color.hex || '#888', border: '1px solid #aaa', boxShadow: '0 0 0 2px #fff, 0 0 0 3px #ddd' }} />
          <strong style={{ flex: 1 }}>Cor selecionada</strong>
          <button type="button" className="btn small outline" onClick={() => remove(index)}>Remover</button>
        </div>
        <div className="grid2">
          <div className="field"><label>SKU</label><input value={color.sku || ''} onChange={event => change(index, 'sku', event.target.value)} placeholder="SKU desta cor" /></div>
          <div className="field"><label>Quantidade em estoque</label><input type="number" min="0" value={color.stock ?? 0} onChange={event => change(index, 'stock', Math.max(0, Number(event.target.value) || 0))} /></div>
        </div>
        <div className="field"><label>Quantidade mínima para compra</label><input type="number" min="0" value={color.min_stock ?? 0} onChange={event => change(index, 'min_stock', Math.max(0, Number(event.target.value) || 0))} /></div>
      </div>
    ))}
  </section>;
}
