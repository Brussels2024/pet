'use client';

import { useState } from 'react';

export default function AddToCart({ product }) {
  const minimum = Math.max(1, Number(product.min_quantity) || 1);
  const colors = Array.isArray(product.colors)
    ? product.colors.map((item) => typeof item === 'string' ? item : String(item?.name || item?.color || item?.cor || '')).filter(Boolean)
    : [];
  const [qty, setQty] = useState(String(minimum));
  const [color, setColor] = useState(colors[0] || '');
  const [added, setAdded] = useState(false);
  const soldOut = product.stock <= 0;

  function add() {
    const amount = Math.max(minimum, Math.floor(Number(qty) || minimum));
    if (amount > Number(product.stock)) return;
    if (colors.length && !colors.includes(color)) return;
    try {
      const cart = JSON.parse(localStorage.getItem('bp_cart') || '[]');
      const existing = cart.find((item) => item.id === product.id && String(item.color || '') === color);
      if (existing) existing.qty += amount;
      else cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image_url || '',
        qty: amount,
        color,
        min_quantity: minimum,
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
      {colors.length > 0 && (
        <label className="field" style={{ minWidth: 150, flex: 1 }}>
          <span>Cor</span>
          <select value={color} onChange={(e) => setColor(e.target.value)} aria-label="Escolha a cor">
            {colors.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      )}
      <label className="field" style={{ minWidth: 110 }}>
        <span>Quantidade (mín. {minimum})</span>
        <input
          type="number"
          min={minimum}
          max={product.stock}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          aria-label="Quantidade"
        />
      </label>
      <button type="button" className="btn small" onClick={add} disabled={Number(qty) < minimum || Number(qty) > Number(product.stock) || (colors.length > 0 && !color)}>
        {added ? 'Adicionado ✓' : 'Adicionar'}
      </button>
    </div>
  );
}
