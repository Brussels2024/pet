'use client';

import { useState } from 'react';

function variantsOf(value) {
  return (Array.isArray(value) ? value : []).map((item) => {
    if (typeof item === 'string') return { name: item, abbreviation: item.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2) };
    return { name: String(item?.name || ''), abbreviation: String(item?.abbreviation || ''), sku: String(item?.sku || '') };
  }).filter((item) => item.name);
}


function colorHex(name) {
  const key = String(name || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
  const colors = {
    branco: '#ffffff', branca: '#ffffff', white: '#ffffff',
    preto: '#171717', preta: '#171717', black: '#171717',
    roxo: '#7e3fb2', roxa: '#7e3fb2', lilas: '#b78ad5', violeta: '#7f00ff',
    amarelo: '#f4d21f', amarela: '#f4d21f',
    azul: '#2375d8', 'azul claro': '#83c9f4', 'azul marinho': '#142d57',
    vermelho: '#e53935', vermelha: '#e53935', rosa: '#ed78a8',
    verde: '#269653', verde: '#269653', laranja: '#f28c28',
    cinza: '#929292', cinza: '#929292', marrom: '#80543b',
    dourado: '#c9a227', prata: '#c0c0c0', bege: '#d9c3a0',
    transparente: 'linear-gradient(135deg, #fff 0 45%, #bbb 45% 55%, #fff 55%)'
  };
  return colors[key] || '#a0a0a0';
}

export default function AddToCart({ product }) {
  const minimum = Math.max(1, Number(product.min_quantity) || 1);
  const variants = variantsOf(product.colors);
  const [qty, setQty] = useState(String(minimum));
  const [color, setColor] = useState(variants[0]?.name || '');
  const [added, setAdded] = useState(false);
  const soldOut = product.stock <= 0;
  const selected = variants.find((item) => item.name === color);
  const variantSku = selected?.sku || (selected && product.sku ? product.sku + '-' + selected.abbreviation : product.sku || '');

  function add() {
    const amount = Math.max(minimum, Math.floor(Number(qty) || minimum));
    if (amount > Number(product.stock)) return;
    if (variants.length && !selected) return;
    try {
      const cart = JSON.parse(localStorage.getItem('bp_cart') || '[]');
      const existing = cart.find((item) => item.id === product.id && String(item.color || '') === color);
      if (existing) existing.qty += amount;
      else cart.push({
        id: product.id, name: product.name, price: product.price,
        image: product.image_url || '', qty: amount, color,
        color_abbreviation: selected?.abbreviation || '',
        variant_sku: variantSku, min_quantity: minimum,
      });
      localStorage.setItem('bp_cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart-changed'));
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } catch {}
  }

  if (soldOut) return <span className="muted">Sem estoque</span>;

  return (
    <div className="add-row" style={{ flexWrap: 'wrap' }}>
      {variants.length > 0 && (
        <div className="field color-variant-picker" style={{ minWidth: 150, flex: 1 }}>
          <span className="color-variant-title">Escolha a cor</span>
          <div className="color-variant-swatches" role="group" aria-label="Escolha a cor">
            {variants.map((item) => (
              <button
                key={item.name}
                type="button"
                className={`color-variant-swatch${color === item.name ? ' selected' : ''}`}
                style={{ '--swatch-color': colorHex(item.name) }}
                onClick={() => setColor(item.name)}
                aria-label={item.name}
                aria-pressed={color === item.name}
                title={item.name}
              />
            ))}
          </div>
          {selected && <div className="color-variant-summary">
            <strong>{selected.name} ({selected.abbreviation})</strong>
            <span>SKU: {variantSku}</span>
          </div>}
        </div>
      )}
      <label className="field" style={{ minWidth: 110 }}>
        <span>Quantidade (mín. {minimum})</span>
        <input type="number" min={minimum} max={product.stock} value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantidade" />
      </label>
      <button type="button" className="btn small" onClick={add} disabled={Number(qty) < minimum || Number(qty) > Number(product.stock) || (variants.length > 0 && !selected)}>
        {added ? 'Adicionado ✓' : 'Adicionar'}
      </button>
    </div>
  );
}
