'use client';

import { useState } from 'react';

export default function AddToCart({ product }) {
  const colors = Array.isArray(product.colors) ? product.colors : [];
  const minimum = Math.max(1, Number(product.min_quantity) || 1);
  const [qty, setQty] = useState(String(minimum));
  const [quantities, setQuantities] = useState({});
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const soldOut = colors.length ? colors.every((color) => Number(color.stock) <= 0) : Number(product.stock) <= 0;

  function add() {
    try {
      const cart = JSON.parse(localStorage.getItem('bp_cart') || '[]');
      const existing = cart.find((item) => item.id === product.id);

      if (colors.length) {
        const variants = colors
          .filter((color) => Number(quantities[color.id]) > 0)
          .map((color) => ({
            colorId: color.id,
            color: color.name,
            colorSku: color.sku || '',
            qty: Math.floor(Number(quantities[color.id])),
          }));
        const amount = variants.reduce((sum, variant) => sum + variant.qty, 0);
        if (amount < minimum) {
          setError('A quantidade mínima deste produto é de ' + minimum + ' unidades.');
          return;
        }
        if (!variants.length) {
          setError('Escolha ao menos uma cor e informe a quantidade.');
          return;
        }
        for (const variant of variants) {
          const color = colors.find((item) => item.id === variant.colorId);
          const previous = existing?.variants?.find((item) => item.colorId === variant.colorId);
          if (variant.qty + (Number(previous?.qty) || 0) > Number(color.stock)) {
            setError('Quantidade maior que o estoque da cor ' + color.name + '.');
            return;
          }
        }
        if (existing) {
          for (const variant of variants) {
            const previous = existing.variants?.find((item) => item.colorId === variant.colorId);
            if (previous) previous.qty += variant.qty;
            else existing.variants = [...(existing.variants || []), variant];
          }
          existing.qty = existing.variants.reduce((sum, variant) => sum + variant.qty, 0);
        } else {
          cart.push({
            id: product.id, name: product.name, price: product.price,
            image: product.image_url || '', qty: amount, variants,
          });
        }
      } else {
        const amount = Math.max(minimum, Math.floor(Number(qty) || minimum));
        if (amount > Number(product.stock)) {
          setError('Quantidade maior que o estoque disponível.');
          return;
        }
        if (existing) {
          if (existing.qty + amount > Number(product.stock)) {
            setError('O carrinho ultrapassaria o estoque disponível.');
            return;
          }
          existing.qty += amount;
        } else {
          cart.push({ id: product.id, name: product.name, price: product.price, image: product.image_url || '', qty: amount });
        }
      }

      localStorage.setItem('bp_cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart-changed'));
      setError('');
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1800);
    } catch {}
  }

  if (soldOut) return <span className="muted">Sem estoque</span>;

  return (
    <div className="add-row add-to-cart-colors">
      {colors.length > 0 ? (
        <>
          <p><b>Escolha as cores e as quantidades desejadas.</b></p>
          <p className="muted">Quantidade mínima total: {minimum} unidades.</p>
          {colors.map((color) => (
            <div key={color.id} className="color-quantity-row">
              <span className="color-swatch" style={{ backgroundColor: color.hex || '#888' }} />
              <span className="color-quantity-name">{color.name}<small>{color.stock} disponíveis</small></span>
              <input
                type="number" min="0" max={color.stock} value={quantities[color.id] || 0}
                disabled={Number(color.stock) <= 0}
                onChange={(event) => {
                  setQuantities((current) => ({
                    ...current,
                    [color.id]: Math.min(Number(color.stock), Math.max(0, Math.floor(Number(event.target.value) || 0))),
                  }));
                  setError('');
                }}
                aria-label={'Quantidade ' + color.name}
              />
            </div>
          ))}
          <p className="muted">Total de unidades: <b>{Object.values(quantities).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)}</b></p>
        </>
      ) : (
        <label className="field">
          <span>Quantidade (mín. {minimum})</span>
          <input type="number" min={minimum} max={product.stock} value={qty} onChange={(event) => setQty(event.target.value)} aria-label="Quantidade" />
        </label>
      )}
      {error && <p className="msg error">{error}</p>}
      <button type="button" className="btn small" onClick={add}>{added ? 'Adicionado ✓' : 'Adicionar ao carrinho'}</button>
    </div>
  );
}
