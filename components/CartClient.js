'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CartClient({ minOrder, status }) {
  const [cart, setCart] = useState([]);
  const [ready, setReady] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem('bp_cart') || '[]'));
    } catch {
      setCart([]);
    }
    setReady(true);
  }, []);

  function save(next) {
    setCart(next);
    try {
      localStorage.setItem('bp_cart', JSON.stringify(next));
      window.dispatchEvent(new Event('cart-changed'));
    } catch {
      // sem localStorage
    }
  }

  const changeQty = (id, value) => {
    const qty = Math.max(1, Math.floor(Number(value) || 1));
    save(cart.map(item => (item.id === id ? { ...item, qty } : item)));
  };

  const remove = id => save(cart.filter(item => item.id !== id));

  const removeVariant = (id, colorId) => {
    const next = cart.flatMap(item => {
      if (item.id !== id || !Array.isArray(item.variants)) return [item];
      const variants = item.variants.filter(variant => variant.colorId !== colorId);
      if (!variants.length) return [];
      return [{
        ...item,
        variants,
        qty: variants.reduce((sum, variant) => sum + Number(variant.qty || 0), 0),
      }];
    });
    save(next);
  };

  const total = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
  const belowMin = total < minOrder;
  const rows = cart.flatMap(item => (
    Array.isArray(item.variants) && item.variants.length
      ? item.variants.map(variant => ({ ...item, variant, rowKey: item.id + '-' + variant.colorId }))
      : [{ ...item, variant: null, rowKey: String(item.id) }]
  ));

  function finish() {
    try { sessionStorage.setItem('bp_checkout_notes', notes); } catch {}
    window.location.href = '/frete';
  }

  if (!ready) return null;
  if (cart.length === 0) {
    return (
      <p>
        Seu carrinho está vazio. <Link href="/"><b>Ver produtos</b></Link>
      </p>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Preço</th>
              <th>Qtd.</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(item => {
              const variant = item.variant;
              const lineQty = variant ? Number(variant.qty) : Number(item.qty);
              return (
                <tr key={item.rowKey}>
                  <td>
                    <b>{item.name}</b>
                    {variant && (
                      <div className="muted">
                        Cor: {variant.color}
                        {variant.colorSku ? ' · SKU: ' + variant.colorSku : ''}
                      </div>
                    )}
                  </td>
                  <td>{brl(item.price)}</td>
                  <td style={{ width: 100 }}>
                    {variant ? <b>{lineQty}</b> : (
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={event => changeQty(item.id, event.target.value)}
                      />
                    )}
                  </td>
                  <td>{brl(Number(item.price) * lineQty)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn small outline"
                      onClick={() => variant ? removeVariant(item.id, variant.colorId) : remove(item.id)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p style={{ fontSize: 20, margin: '0 0 8px' }}>
          Total: <b>{brl(total)}</b>
        </p>
        <p className="muted" style={{ marginTop: 0 }}>
          Pedido mínimo: {brl(minOrder)}. O frete é combinado após a confirmação do pedido.
        </p>
        {belowMin && (
          <div className="msg warn">
            Faltam {brl(minOrder - total)} para atingir o pedido mínimo.
          </div>
        )}

        <div className="field">
          <label htmlFor="notes">Observações</label>
          <textarea id="notes" rows={3} value={notes} onChange={event => setNotes(event.target.value)} />
        </div>

        {status === 'guest' && (
          <div className="msg warn">
            <Link href="/entrar?next=/carrinho"><b>Entre</b></Link> ou <Link href="/cadastro"><b>cadastre sua empresa</b></Link> para finalizar.
          </div>
        )}
        {status === 'pendente' && (
          <div className="msg warn">Sua conta ainda está em análise. Você poderá comprar assim que for aprovada.</div>
        )}
        {status === 'bloqueado' && <div className="msg error">Conta bloqueada. Fale com a Brussels Pet.</div>}
        {error && <div className="msg error">{error}</div>}

        <button
          type="button"
          className="btn"
          onClick={finish}
          disabled={busy || belowMin || status !== 'ok'}
          style={{ width: '100%' }}
        >
          {busy ? 'Gerando pagamento...' : 'Confirmar compra e calcular frete'}
        </button>
      </div>
    </>
  );
}
