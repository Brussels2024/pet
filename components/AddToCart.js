'use client';

import { useState } from 'react';

function colorName(item) {
  return typeof item === 'string'
    ? item.trim()
    : String(item?.name || item?.color || item?.cor || '').trim();
}

function colorSku(item) {
  return typeof item === 'object' && item
    ? String(item.sku || item.abbreviation || item.sigla || '').trim()
    : '';
}

export default function AddToCart({ product }) {
  const minimum = Math.max(1, Number(product.min_quantity) || 1);
  const colors = Array.isArray(product.colors)
    ? product.colors.map((item) => ({ name: colorName(item), sku: colorSku(item) })).filter((item) => item.name)
    : [];
  const [qty, setQty] = useState(String(minimum));
  const [quantities, setQuantities] = useState({});
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const soldOut = Number(product.stock) <= 0;
  const selectedTotal = Object.values(quantities).reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0);

  function add() {
    const cartQty = colors.length ? selectedTotal : Math.max(minimum, Math.floor(Number(qty) || minimum));
    if (cartQty < minimum) {
      setError('A quantidade mínima deste produto é de ' + minimum + ' unidades.');
      return;
    }
    if (cartQty > Number(product.stock)) {
      setError('A quantidade selecionada ultrapassa o estoque disponível.');
      return;
    }

    try {
      const cart = JSON.parse(localStorage.getItem('bp_cart') || '[]');
      const existing = cart.find((item) => item.id === product.id);

      if (colors.length) {
        const variants = colors
          .filter((color) => Number(quantities[color.name]) > 0)
          .map((color) => ({
            color: color.name,
            colorSku: color.sku,
            qty: Math.floor(Number(quantities[color.name])),
          }));

        if (!variants.length) {
          setError('Escolha ao menos uma cor e informe a quantidade.');
          return;
        }

        if (existing) {
          const currentVariants = Array.isArray(existing.variants)
            ? existing.variants
            : (existing.color ? [{ color: existing.color, colorSku: '', qty: Number(existing.qty) || 0 }] : []);
          for (const variant of variants) {
            const previous = currentVariants.find((item) => item.color === variant.color);
            if (previous) previous.qty = Number(previous.qty || 0) + variant.qty;
            else currentVariants.push(variant);
          }
          const combinedQty = currentVariants.reduce((sum, item) => sum + Number(item.qty || 0), 0);
          if (combinedQty > Number(product.stock)) {
            setError('A quantidade total no carrinho ultrapassa o estoque disponível.');
            return;
          }
          existing.variants = currentVariants;
          existing.qty = combinedQty;
          delete existing.color;
        } else {
          cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image_url || '',
            qty: cartQty,
            variants,
          });
        }
      } else {
        if (existing) existing.qty = Number(existing.qty || 0) + cartQty;
        else cart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image_url || '',
          qty: cartQty,
          min_quantity: minimum,
        });
        const saved = cart.find((item) => item.id === product.id);
        if (Number(saved.qty) > Number(product.stock)) {
          setError('A quantidade total no carrinho ultrapassa o estoque disponível.');
          return;
        }
      }

      localStorage.setItem('bp_cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart-changed'));
      setError('');
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1500);
    } catch {
      setError('Não foi possível adicionar o produto. Tente novamente.');
    }
  }

  if (soldOut) return <span className="muted">Sem estoque</span>;

  return (
    <div className="add-row add-to-cart-colors" style={{ flexWrap: 'wrap' }}>
      {colors.length > 0 ? (
        <div style={{ width: '100%' }}>
          <p><b>Escolha as cores e as quantidades desejadas.</b></p>
          {colors.map((color) => (
            <label key={color.name} className="field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>{color.name}</span>
              <input
                type="number"
                min="0"
                max={product.stock}
                value={quantities[color.name] ?? 0}
                onChange={(event) => {
                  setQuantities((current) => ({
                    ...current,
                    [color.name]: Math.min(Number(product.stock), Math.max(0, Math.floor(Number(event.target.value) || 0))),
                  }));
                  setError('');
                }}
                aria-label={'Quantidade ' + color.name}
                style={{ maxWidth: 90 }}
              />
            </label>
          ))}
          <p className="muted">Total selecionado: <b>{selectedTotal}</b> · Mínimo: {minimum}</p>
        </div>
      ) : (
        <label className="field" style={{ minWidth: 110 }}>
          <span>Quantidade (mín. {minimum})</span>
          <input
            type="number"
            min={minimum}
            max={product.stock}
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            aria-label="Quantidade"
          />
        </label>
      )}
      {error && <p className="msg error">{error}</p>}
      <button type="button" className="btn small" onClick={add}>
        {added ? 'Adicionado ✓' : 'Adicionar'}
      </button>
    </div>
  );
}
