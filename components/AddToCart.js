'use client';
import { useState } from 'react';
function variantsOf(value) {
  return (Array.isArray(value) ? value : []).map((item) => {
    if (typeof item === 'string') {
      const name = item.trim();
      return { name, abbreviation: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4), hex: '', sku: '' };
    }
    return { name: String(item?.name || '').trim(), abbreviation: String(item?.abbreviation || ''), hex: String(item?.hex || item?.color || item?.hexColor || ''), sku: String(item?.sku || '') };
  }).filter((item) => item.name);
}
function colorHex(name, explicitHex) {
  if (/^#[0-9a-f]{3,8}$/i.test(explicitHex || '')) return explicitHex;
  const key = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const colors = {
    branco:'#ffffff', branca:'#ffffff', white:'#ffffff', preto:'#171717', preta:'#171717', black:'#171717',
    roxo:'#7e3fb2', roxa:'#7e3fb2', lilas:'#b78ad5', violeta:'#7f00ff', amarelo:'#f4d21f', amarela:'#f4d21f',
    azul:'#2375d8', 'azul claro':'#83c9f4', 'azul marinho':'#142d57', vermelho:'#e53935', vermelha:'#e53935',
    rosa:'#ed78a8', verde:'#269653', laranja:'#f28c28', cinza:'#929292', marrom:'#80543b',
    dourado:'#c9a227', prata:'#c0c0c0', bege:'#d9c3a0'
  };
  return colors[key] || '#a0a0a0';
}
export default function AddToCart({ product }) {
  const minimum = Math.max(1, Number(product.min_quantity) || 1);
  const variants = variantsOf(product.colors);
  const [quantities, setQuantities] = useState({});
  const [singleQty, setSingleQty] = useState(String(minimum));
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const soldOut = Number(product.stock) <= 0;
  function add() {
    setError('');
    const additions = variants.length
      ? variants.map((variant) => ({ color: variant.name, variant, qty: Math.floor(Number(quantities[variant.name]) || 0) })).filter((item) => item.qty > 0)
      : [{ color: '', variant: null, qty: Math.floor(Number(singleQty) || 0) }];
    if (!additions.length) { setError('Informe a quantidade de pelo menos uma cor.'); return; }
    if (additions.some((item) => item.qty < minimum)) { setError('Cada cor selecionada precisa respeitar a quantidade mínima de ' + minimum + ' unidades.'); return; }
    const newTotal = additions.reduce((sum, item) => sum + item.qty, 0);
    try {
      const cart = JSON.parse(localStorage.getItem('bp_cart') || '[]');
      const alreadyInCart = cart.filter((item) => Number(item.id) === Number(product.id)).reduce((sum, item) => sum + Number(item.qty || 0), 0);
      if (alreadyInCart + newTotal > Number(product.stock)) {
        setError('Estoque insuficiente. Disponível: ' + Math.max(0, Number(product.stock) - alreadyInCart) + ' unidade(s).'); return;
      }
      for (const addition of additions) {
        const existing = cart.find((item) => Number(item.id) === Number(product.id) && String(item.color || '') === addition.color);
        if (existing) existing.qty = Number(existing.qty || 0) + addition.qty;
        else {
          const abbreviation = addition.variant?.abbreviation || '';
          const variantSku = addition.variant?.sku || (product.sku && abbreviation ? product.sku + '-' + abbreviation : product.sku || '');
          cart.push({ id:product.id, name:product.name, price:product.price, image:product.image_url || '', qty:addition.qty,
            color:addition.color, color_abbreviation:abbreviation, variant_sku:variantSku, min_quantity:minimum });
        }
      }
      localStorage.setItem('bp_cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart-changed'));
      setAdded(true); setQuantities({}); setSingleQty(String(minimum));
      setTimeout(() => setAdded(false), 1500);
    } catch { setError('Não foi possível adicionar o produto ao carrinho.'); }
  }
  if (soldOut) return <span className="muted">Sem estoque</span>;
  return (
    <div className="add-row" style={{ flexWrap:'wrap', alignItems:'end' }}>
      {variants.length > 0 ? (
        <div className="field color-variant-picker" style={{ width:'100%' }}>
          <span className="color-variant-title">Escolha as cores e quantidades</span>
          <div style={{ display:'grid', gap:10 }}>
            {variants.map((variant) => (
              <label key={variant.name} style={{ display:'flex', alignItems:'center', gap:10, margin:0 }}>
                <span aria-hidden="true" style={{ display:'inline-block', width:24, height:24, minWidth:24, borderRadius:'50%',
                  border:'1px solid #bdbdbd', background:colorHex(variant.name, variant.hex) }} />
                <span style={{ flex:1 }}>{variant.name}</span>
                <input type="number" min="0" max={product.stock} step="1" value={quantities[variant.name] ?? ''} placeholder="0"
                  onChange={(e) => setQuantities((current) => ({ ...current, [variant.name]:e.target.value }))}
                  aria-label={'Quantidade ' + variant.name} style={{ width:88 }} />
              </label>
            ))}
          </div>
          <small className="muted">Mínimo de {minimum} unidades por cor selecionada. Estoque total: {product.stock}.</small>
        </div>
      ) : (
        <label className="field" style={{ minWidth:110 }}>
          <span>Quantidade (mín. {minimum})</span>
          <input type="number" min={minimum} max={product.stock} value={singleQty} onChange={(e) => setSingleQty(e.target.value)} aria-label="Quantidade" />
        </label>
      )}
      {error && <div className="msg error" style={{ width:'100%' }}>{error}</div>}
      <button type="button" className="btn small" onClick={add} disabled={soldOut}>{added ? 'Adicionado ✓' : 'Adicionar ao carrinho'}</button>
    </div>
  );
}
