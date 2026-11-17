'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
export default function CartClient({ minOrder, status }) {
  const [cart,setCart] = useState([]), [ready,setReady] = useState(false), [notes,setNotes] = useState('');
  const [error,setError] = useState(''), [busy,setBusy] = useState(false), [checkoutKey,setCheckoutKey] = useState('');
  useEffect(() => { try { setCart(JSON.parse(localStorage.getItem('bp_cart') || '[]')); } catch { setCart([]); } setReady(true); }, []);
  function save(next) {
    setCart(next); setCheckoutKey('');
    try { localStorage.setItem('bp_cart',JSON.stringify(next)); window.dispatchEvent(new Event('cart-changed')); } catch {}
  }
  const keyOf = (item) => String(item.id) + '::' + String(item.color || '');
  const changeQty = (key,value) => {
    const item = cart.find((i) => keyOf(i) === key), minimum = Math.max(1,Number(item?.min_quantity)||1);
    const qty = Math.max(minimum,Math.floor(Number(value)||minimum));
    save(cart.map((i) => keyOf(i) === key ? {...i,qty} : i));
  };
  const remove = (key) => save(cart.filter((i) => keyOf(i) !== key));
  const total = cart.reduce((sum,i) => sum + Number(i.price)*i.qty,0), belowMin = total < minOrder;
  async function finish() {
    setError(''); setBusy(true);
    const requestKey = checkoutKey || crypto.randomUUID();
    if (!checkoutKey) setCheckoutKey(requestKey);
    try {
      const res = await fetch('/api/pedidos',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({items:cart.map((i)=>({id:i.id,qty:i.qty,color:i.color||''})),notes,checkoutKey:requestKey})});
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Não foi possível iniciar o pagamento.'); setBusy(false); return; }
      if (!data.invoiceUrl) { setError('O Asaas não retornou o link de pagamento. Não refaça o pedido; entre em contato com a Brussels Pet.'); setBusy(false); return; }
      localStorage.removeItem('bp_cart'); window.dispatchEvent(new Event('cart-changed')); window.location.href = data.invoiceUrl;
    } catch { setError('Erro de conexão. Tente novamente.'); setBusy(false); }
  }
  if (!ready) return null;
  if (!cart.length) return <p>Seu carrinho está vazio. <Link href="/"><b>Ver produtos</b></Link></p>;
  return <>
    <div className="table-wrap"><table><thead><tr><th>Produto</th><th>Cor</th><th>Preço</th><th>Qtd.</th><th>Subtotal</th><th></th></tr></thead>
      <tbody>{cart.map((i)=><tr key={keyOf(i)}><td>{i.name}</td><td>{i.color||'—'}</td><td>{brl(i.price)}</td>
        <td style={{width:100}}><input type="number" min={Math.max(1,Number(i.min_quantity)||1)} value={i.qty} onChange={(e)=>changeQty(keyOf(i),e.target.value)} /></td>
        <td>{brl(Number(i.price)*i.qty)}</td><td><button type="button" className="btn small outline" onClick={()=>remove(keyOf(i))}>Remover</button></td></tr>)}</tbody>
    </table></div>
    <div className="card" style={{marginTop:16}}>
      <p style={{fontSize:20,margin:'0 0 8px'}}>Total: <b>{brl(total)}</b></p>
      <p className="muted" style={{marginTop:0}}>Pedido mínimo: {brl(minOrder)}. O frete é combinado após a confirmação do pedido.</p>
      {belowMin && <div className="msg warn">Faltam {brl(minOrder-total)} para atingir o pedido mínimo.</div>}
      <div className="field"><label>Pagamento</label><p className="muted">Você será direcionado ao ambiente seguro do Asaas para concluir o pagamento.</p></div>
      <div className="field"><label htmlFor="notes">Observações</label><textarea id="notes" rows={3} value={notes} onChange={(e)=>setNotes(e.target.value)} /></div>
      {status==='guest' && <div className="msg warn"><Link href="/entrar?next=/carrinho"><b>Entre</b></Link> ou <Link href="/cadastro"><b>cadastre sua empresa</b></Link> para finalizar.</div>}
      {status==='pendente' && <div className="msg warn">Sua conta ainda está em análise. Você poderá comprar assim que for aprovada.</div>}
      {status==='bloqueado' && <div className="msg error">Conta bloqueada. Fale com a Brussels Pet.</div>}
      {error && <div className="msg error">{error}</div>}
      <button type="button" className="btn" onClick={finish} disabled={busy||belowMin||status!=='ok'} style={{width:'100%'}}>{busy?'Abrindo Asaas...':'Finalizar pagamento'}</button>
    </div>
  </>;
}
