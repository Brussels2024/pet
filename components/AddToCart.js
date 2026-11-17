'use client';

import { useState } from 'react';

const KNOWN_COLORS = {
  preto: '#111111', branco: '#ffffff', cinza: '#888888', prata: '#c0c0c0',
  vermelho: '#e53935', vinho: '#7b1e3a', laranja: '#fb8c00', amarelo: '#fdd835',
  dourado: '#d4af37', verde: '#43a047', 'verde claro': '#9ccc65',
  azul: '#1e88e5', 'azul marinho': '#17365d', 'azul claro': '#81d4fa',
  roxo: '#8e24aa', lilas: '#ce93d8', rosa: '#ec407a', marrom: '#795548',
  bege: '#d7c3a3', turquesa: '#26a69a',
};

function getColorHex(color) {
  const name = String(color.name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ').trim().toLowerCase().replace(/\s+/g, ' ');
  const savedHex = String(color.hex || '').trim();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(savedHex) && savedHex.toLowerCase() !== '#888888') {
    return savedHex;
  }
  return KNOWN_COLORS[name] || (savedHex || '#888888');
}

export default function AddToCart({ product }) {
  const colors = Array.isArray(product.colors) ? product.colors : [];
  const [qty, setQty] = useState(1);
  const [quantities, setQuantities] = useState({});
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const soldOut = colors.length
    ? colors.every(color => Number(color.stock) <= 0)
    : Number(product.stock) <= 0;
  const minRequired = colors.length
    ? Math.max(0, ...colors.map(color => Number(color.min_stock) || 0))
    : 1;
  const selectedTotal = Object.values(quantities)
    .reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);

  function add() {
    try {
      const cart = JSON.parse(localStorage.getItem('bp_cart') || '[]');

      if (colors.length) {
        const variants = colors
          .filter(color => Number(quantities[color.id]) > 0)
          .map(color => ({
            colorId: color.id,
            color: color.name,
            colorSku: color.sku || '',
            qty: Math.floor(Number(quantities[color.id])),
          }));

        if (!variants.length) {
          setError('Escolha ao menos uma cor e informe a quantidade.');
          return;
        }
        if (selectedTotal < minRequired) {
          setError(`A quantidade mínima deste produto é de ${minRequired} unidades. Selecione mais ${minRequired - selectedTotal}.`);
          return;
        }
        for (const variant of variants) {
          const color = colors.find(item => item.id === variant.colorId);
          if (variant.qty > Number(color.stock)) {
            setError('Quantidade maior que o estoque da cor ' + color.name + '.');
            return;
          }
        }

        const existing = cart.find(item => item.id === product.id);
        if (existing) {
          for (const variant of variants) {
            const previous = existing.variants?.find(item => item.colorId === variant.colorId);
            const color = colors.find(item => item.id === variant.colorId);
            if ((Number(previous?.qty) || 0) + variant.qty > Number(color.stock)) {
              setError('O carrinho ultrapassaria o estoque da cor ' + color.name + '.');
              return;
            }
            if (previous) previous.qty += variant.qty;
            else existing.variants = [...(existing.variants || []), variant];
          }
          existing.qty = existing.variants.reduce((sum, item) => sum + item.qty, 0);
        } else {
          cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image_url || '',
            qty: variants.reduce((sum, item) => sum + item.qty, 0),
            variants,
          });
        }
      } else {
        const amount = Math.max(1, Math.floor(Number(qty) || 1));
        if (amount > Number(product.stock)) {
          setError('Quantidade maior que o estoque disponível.');
          return;
        }
        const existing = cart.find(item => item.id === product.id);
        if (existing) existing.qty += amount;
        else cart.push({
          id: product.id, name: product.name, price: product.price,
          image: product.image_url || '', qty: amount,
        });
      }

      localStorage.setItem('bp_cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart-changed'));
      setError('');
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1800);
    } catch {
      setError('Não foi possível adicionar o produto. Tente novamente.');
    }
  }

  if (soldOut) return <span className="muted">Sem estoque</span>;

  return (
    <div className="add-row add-to-cart-colors">
      {colors.length > 0 ? (
        <>
          <p><b>Escolha as cores e as quantidades desejadas.</b></p>
          {colors.map(color => (
            <div key={color.id} className="color-quantity-row">
              <span
                className="color-swatch"
                style={{ backgroundColor: getColorHex(color) }}
                aria-label={color.name}
                title={color.name}
              />
              <span className="color-quantity-name">
                {color.name}
                <small>{color.stock} disponíveis</small>
              </span>
              <input
                type="number"
                min="0"
                max={color.stock}
                value={quantities[color.id] ?? 0}
                disabled={Number(color.stock) <= 0}
                onChange={event => {
                  setQuantities(current => ({
                    ...current,
                    [color.id]: Math.min(
                      Number(color.stock),
                      Math.max(0, Math.floor(Number(event.target.value) || 0))
                    ),
                  }));
                  setError('');
                }}
                aria-label={'Quantidade ' + color.name}
              />
            </div>
          ))}
          <p className="muted">
            Total de unidades: <b>{selectedTotal}</b>
            {minRequired > 1 ? ` · Mínimo: ${minRequired}` : ''}
          </p>
        </>
      ) : (
        <input
          type="number"
          min="1"
          max={product.stock}
          value={qty}
          onChange={event => setQty(event.target.value)}
          aria-label="Quantidade"
        />
      )}
      {error && <p className="msg error">{error}</p>}
      <button type="button" className="btn small" onClick={add}>
        {added ? 'Adicionado ✓' : 'Adicionar ao carrinho'}
      </button>
    </div>
  );
}
