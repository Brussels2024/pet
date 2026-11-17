'use client';

import { useState } from 'react';

function variantsOf(value) {
  return (Array.isArray(value) ? value : []).map((item) => {
    if (typeof item === 'string') return { name: item, abbreviation: item.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2) };
    return { name: String(item?.name || ''), abbreviation: String(item?.abbreviation || ''), sku: String(item?.sku || '') };
  }).filter((item) => item.name);
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
        <label className="field" style={{ minWidth: 150, flex: 1 }}>
          <span>Cor</span>
          <select value={color} onChange={(e) => setColor(e.target.value)} aria-label="Escolha a cor">
            {variants.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.abbreviation})</option>)}
          </select>
          {selected && <small className="muted">Cor: {selected.name} ({selected.abbreviation}) · SKU: {variantSku}</small>}
        </label>
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
