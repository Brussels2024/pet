'use client';

import { useState } from 'react';

export default function AddToCart({ product }) {
  const minimum = Math.max(1, Number(product.min_quantity) || 1);
  const colors = Array.isArray(product.colors)
    ? product.colors.map((item) => typeof item === 'string' ? item : String(item?.name || item?.color || item?.cor || '')).filter(Boolean)
    : [];
  const [qty, setQty] = useState('1');
  const [color, setColor] = useState(colors[0] || '');
  const [colorQty, setColorQty] = useState({});
  const [added, setAdded] = useState(false);
  const soldOut = Number(product.stock) <= 0;

  const selectedColors = colors
    .map((name) => ({ name, qty: Math.max(0, Math.floor(Number(colorQty[name]) || 0)) }))
    .filter((item) => item.qty > 0);
  const selectedTotal = selectedColors.reduce((sum, item) => sum + item.qty, 0);
  const missing = Math.max(0, minimum - selectedTotal);
  const exceedsStock = selectedTotal > Number(product.stock);

  function add() {
    const lines = colors.length
      ? selectedColors
      : [{ name: color, qty: Math.max(1, Math.floor(Number(qty) || 1)) }];

    if (colors.length && (selectedTotal < minimum || exceedsStock || !selectedColors.length)) return;
    if (!colors.length && (lines[0].qty > Number(product.stock) || (color && !colors.includes(color)))) return;

    try {
      const cart = JSON.parse(localStorage.getItem('bp_cart') || '[]');
      for (const line of lines) {
        const existing = cart.find((item) => String(item.id) === String(product.id) && String(item.color || '') === line.name);
        if (existing) {
          existing.qty = (Number(existing.qty) || 0) + line.qty;
          existing.min_quantity = minimum;
        } else {
          cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image_url || '',
            qty: line.qty,
            color: line.name,
            min_quantity: minimum,
          });
        }
      }
      localStorage.setItem('bp_cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart-changed'));
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
      if (colors.length) setColorQty({});
    } catch {}
  }

  if (soldOut) return <span className="muted">Sem estoque</span>;

  return (
    <div className="add-row" style={{ flexWrap: 'wrap' }}>
      {colors.length > 0 ? (
        <div className="field" style={{ minWidth: 150, flex: 1 }}>
          <span>Escolha a quantidade por cor</span>
          <div style={{ display: 'grid', gap: 8 }}>
            {colors.map((item) => (
              <label key={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span>{item}</span>
                <input
                  type="number"
                  min={0}
                  max={product.stock}
                  value={colorQty[item] ?? '0'}
                  onChange={(e) => setColorQty((current) => ({ ...current, [item]: e.target.value }))}
                  aria-label={'Quantidade na cor ' + item}
                  style={{ width: 84 }}
                />
              </label>
            ))}
          </div>
          <span className="muted">
            Selecionado: {selectedTotal} de {minimum} unidade(s) mínimas
          </span>
          {selectedTotal < minimum && (
            <span className="muted" role="status">
              Faltam {missing} {missing === 1 ? 'unidade' : 'unidades'} para poder adicionar.
            </span>
          )}
          {exceedsStock && (
            <span className="muted" role="alert">
              Quantidade acima do estoque disponível ({product.stock}).
            </span>
          )}
        </div>
      ) : (
        <label className="field" style={{ minWidth: 110 }}>
          <span>Quantidade</span>
          <input
            type="number"
            min={1}
            max={product.stock}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            aria-label="Quantidade"
          />
        </label>
      )}
      <button
        type="button"
        className="btn"
        style={{ width: 'fit-content', minWidth: 0, padding: '4px 6px', height: 32, minHeight: 0, flex: '0 0 auto' }}
        onClick={add}
        disabled={colors.length
          ? selectedTotal < minimum || exceedsStock || selectedTotal === 0
          : Number(qty) < 1 || Number(qty) > Number(product.stock)}
      >
        {added ? 'Adicionado ✓' : 'Adicionar'}
      </button>
    </div>
  );
}
