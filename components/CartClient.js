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
  const [checkoutKey, setCheckoutKey] = useState('');

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
    setCheckoutKey('');
    try {
      localStorage.setItem('bp_cart', JSON.stringify(next));
      window.dispatchEvent(new Event('cart-changed'));
    } catch {
      // sem localStorage
    }
  }

  const changeQty = (id, value) => {
    const qty = Math.max(1, Math.floor(Number(value) || 1));
    save(cart.map((i) => (i.id === id ? { ...i, qty } : i)));
  };
  const remove = (id) => save(cart.filter((i) => i.id !== id));

  const total = cart.reduce((sum, i) => sum + Number(i.price) * i.qty, 0);
  const belowMin = total < minOrder;

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
            {cart.map((i) => (
              <tr key={i.id}>
                <td>{i.name}{Array.isArray(i.variants) && i.variants.length > 0 && <div className="muted">{i.variants.map(v => <div key={v.colorId}>• {v.color} (SKU {v.colorSku || '—'}): {v.qty} un.</div>)}</div>}</td>
                <td>{brl(i.price)}</td>
                <td style={{ width: 100 }}>{Array.isArray(i.variants) && i.variants.length > 0 ? <b>{i.qty}</b> : <input type="number" min="1" value={i.qty} onChange={(e) => changeQty(i.id, e.target.value)} />}</td>
                <td>{brl(Number(i.price) * i.qty)}</td>
                <td>
                  <button type="button" className="btn small outline" onClick={() => remove(i.id)}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
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
          <label>Pagamento</label>
          <p className="muted">Pagamento seguro pelo Asaas. Na próxima etapa, você poderá escolher uma das modalidades habilitadas na conta: Pix, boleto ou cartão de crédito.</p>
        </div>
        <div className="field">
          <label htmlFor="notes">Observações</label>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
