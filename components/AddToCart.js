'use client';

import { useState } from 'react';

export default function AddToCart({ product }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const soldOut = product.stock <= 0;

  function add() {
    try {
      const cart = JSON.parse(localStorage.getItem('bp_cart') || '[]');
      const existing = cart.find((item) => item.id === product.id);
      const amount = Math.max(1, Number(qty) || 1);
      if (existing) {
        existing.qty += amount;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image_url || '',
          qty: amount,
        });
      }
      localStorage.setItem('bp_cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart-changed'));
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } catch {
      // navegador sem localStorage
    }
  }

  if (soldOut) return <span className="muted">Sem estoque</span>;

  return (
    <div className="add-row">
      <input
        type="number"
        min="1"
        max={product.stock}
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        aria-label="Quantidade"
      />
      <button type="button" className="btn small" onClick={add}>
        {added ? 'Adicionado ✓' : 'Adicionar'}
      </button>
    </div>
  );
}
