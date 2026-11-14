'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
const brl=n=>(Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const digits=s=>String(s||'').replace(/\D/g,'');
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
export default function ShippingClient({user,freeCities,whatsapp}){
 const [address,setAddress]=useState({cep:user.cep||'',logradouro:user.logradouro||'',numero:user.numero||'',complemento:user.complemento||'',bairro:user.bairro||'',cidade:user.cidade||'',uf:user.uf||'SP'});
 const [cart,setCart]=useState([]),[notes,setNotes]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [checkoutKey,setCheckoutKey]=useState('');
 useEffect(()=>{try{setCart(JSON.parse(localStorage.getItem('bp_cart')||'[]'));setNotes(sessionStorage.getItem('bp_checkout_notes')||'');setCheckoutKey(sessionStorage.getItem('bp_checkout_key')||'');}catch{}},[]);
 const set=(k,v)=>setAddress(a=>({...a,[k]:v}));
 const isFree=freeCities.some(c=>norm(c.city)===norm(address.cidade)&&c.uf.toUpperCase()===address.uf.toUpperCase());
 const total=cart.reduce((s,i)=>s+Number(i.price)*Number(i.qty),0);
 async function cepLookup(){const cep=digits(address.cep);if(cep.length!==8)return;try{const r=await fetch('https://viacep.com.br/ws/'+cep+'/json/');const d=await r.json();if(!d.erro)setAddress(a=>({...a,logradouro:d.logradouro||a.logradouro,bairro:d.bairro||a.bairro,cidade:d.localidade||a.cidade,uf:d.uf||a.uf}));}catch{}}
 function quote(){
  const products=cart.map(i=>'- '+i.name+' | '+i.qty+' un. | '+brl(Number(i.price)*Number(i.qty))).join('\n');
  const msg='Olá, Brussels Pet! Gostaria de consultar o valor do frete deste pedido.\n\nCliente: '+(user.razao_social||user.nome_fantasia||user.email)+'\nTelefone: '+(user.telefone||'Não informado')+'\nCEP: '+address.cep+'\nEndereço: '+address.logradouro+', nº '+address.numero+(address.complemento?' - '+address.complemento:'')+'\nBairro: '+address.bairro+'\nCidade/UF: '+address.cidade+'/'+address.uf+'\n\nProdutos:\n'+products+'\nTotal dos produtos: '+brl(total)+'\nObservações: '+(notes||'Nenhuma');
  window.location.href='https://wa.me/'+digits(whatsapp||'5519995888333')+'?text='+encodeURIComponent(msg);
 }
 async function pay(){
  setError('');
  if(!address.cep||!address.logradouro||!address.numero||!address.bairro||!address.cidade||!address.uf){setError('Preencha CEP, rua, número, bairro, cidade e UF.');return;}
  if(!cart.length){setError('Seu carrinho está vazio.');return;}
  setBusy(true);
  try{
   const key=checkoutKey||crypto.randomUUID();
   if(!checkoutKey){setCheckoutKey(key);try{sessionStorage.setItem('bp_checkout_key',key)}catch{}}
   const r=await fetch('/api/pedidos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cart.map(i=>({id:i.id,qty:i.qty,variants:i.variants||[]})),notes,checkoutKey:key,shippingAddress:address})});
   const d=await r.json();
   if(!r.ok){setError(d.error||'Não foi possível iniciar o pagamento.');setBusy(false);return;}
   if(!d.invoiceUrl){setError('O pedido foi registrado, mas o link do pagamento não chegou. Fale com a Brussels Pet antes de tentar novamente.');setBusy(false);return;}
   localStorage.removeItem('bp_cart');sessionStorage.removeItem('bp_checkout_notes');sessionStorage.removeItem('bp_checkout_key');window.location.href=d.invoiceUrl;
  }catch{setError('Erro de conexão. Tente novamente.');setBusy(false);}
 }
 return <div className="card" style={{maxWidth:760}}>
  <p className="muted"><Link href="/carrinho">← Voltar ao carrinho</Link></p><h1>Endereço e frete</h1>
  <p className="muted">Confira o endereço de entrega. O frete grátis depende da cidade liberada pela Brussels Pet.</p>
  <div className="grid2">
   <div className="field"><label>CEP</label><input value={address.cep} onChange={e=>set('cep',e.target.value)} onBlur={cepLookup}/></div>
   <div className="field"><label>Rua / avenida</label><input value={address.logradouro} onChange={e=>set('logradouro',e.target.value)}/></div>
  </div>
  <div className="grid3">
   <div className="field"><label>Número</label><input value={address.numero} onChange={e=>set('numero',e.target.value)}/></div>
   <div className="field"><label>Complemento</label><input value={address.complemento} onChange={e=>set('complemento',e.target.value)}/></div>
   <div className="field"><label>Bairro</label><input value={address.bairro} onChange={e=>set('bairro',e.target.value)}/></div>
  </div>
  <div className="grid2">
   <div className="field"><label>Cidade</label><input value={address.cidade} onChange={e=>set('cidade',e.target.value)}/></div>
   <div className="field"><label>UF</label><input value={address.uf} maxLength={2} onChange={e=>set('uf',e.target.value.toUpperCase())}/></div>
  </div>
  <div className="field"><label>Telefone para contato</label><input value={user.telefone||''} readOnly/></div>
  <div className={isFree?'msg ok':'msg warn'}>{isFree?'Sua cidade possui frete grátis! Prazo de entrega: até 7 dias úteis após a confirmação do pagamento.':'Frete sob consulta. O WhatsApp será aberto com o endereço e os produtos preenchidos.'}</div>
  <p><b>Total dos produtos: {brl(total)}</b></p>{error&&<div className="msg error">{error}</div>}
  <button type="button" className="btn" disabled={busy||!cart.length} onClick={isFree?pay:quote} style={{width:'100%'}}>{busy?'Gerando pagamento...':isFree?'Seguir para pagamento':'Consultar frete pelo WhatsApp'}</button>
 </div>;
}
