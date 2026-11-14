'use client';
import { useState } from 'react';
export default function AddToCart({ product }) {
 const colors=Array.isArray(product.colors)?product.colors:[]; const [qty,setQty]=useState(1); const [quantities,setQuantities]=useState({}); const [added,setAdded]=useState(false); const [error,setError]=useState('');
 const soldOut=colors.length?colors.every(c=>Number(c.stock)<=0):Number(product.stock)<=0;
 function add(){try{const cart=JSON.parse(localStorage.getItem('bp_cart')||'[]');
 if(colors.length){const variants=colors.filter(c=>Number(quantities[c.id])>0).map(c=>({colorId:c.id,color:c.name,colorSku:c.sku||'',qty:Math.floor(Number(quantities[c.id]))}));
 if(!variants.length){setError('Escolha ao menos uma cor e informe a quantidade.');return;}
 for(const v of variants){const color=colors.find(c=>c.id===v.colorId);if(v.qty>Number(color.stock)){setError('Quantidade maior que o estoque da cor '+color.name+'.');return;}}
 const existing=cart.find(item=>item.id===product.id);
 if(existing){for(const variant of variants){const previous=existing.variants?.find(v=>v.colorId===variant.colorId);const color=colors.find(c=>c.id===variant.colorId);if((Number(previous?.qty)||0)+variant.qty>Number(color.stock)){setError('O carrinho ultrapassaria o estoque da cor '+color.name+'.');return;}if(previous)previous.qty+=variant.qty;else existing.variants=[...(existing.variants||[]),variant];}existing.qty=existing.variants.reduce((sum,v)=>sum+v.qty,0);}
 else cart.push({id:product.id,name:product.name,price:product.price,image:product.image_url||'',qty:variants.reduce((sum,v)=>sum+v.qty,0),variants});
 }else{const amount=Math.max(1,Math.floor(Number(qty)||1));if(amount>Number(product.stock)){setError('Quantidade maior que o estoque disponível.');return;}const existing=cart.find(item=>item.id===product.id);if(existing)existing.qty+=amount;else cart.push({id:product.id,name:product.name,price:product.price,image:product.image_url||'',qty:amount});}
 localStorage.setItem('bp_cart',JSON.stringify(cart));window.dispatchEvent(new Event('cart-changed'));setError('');setAdded(true);window.setTimeout(()=>setAdded(false),1800);
 }catch{}}
 if(soldOut)return <span className="muted">Sem estoque</span>;
 return <div className="add-row add-to-cart-colors">{colors.length>0?<><p><b>Escolha as cores e as quantidades desejadas.</b></p>{colors.map(color=><div key={color.id} className="color-quantity-row"><span className="color-swatch" style={{backgroundColor:color.hex||'#888'}}/><span className="color-quantity-name">{color.name}<small>{color.stock} disponíveis</small></span><input type="number" min="0" max={color.stock} value={quantities[color.id]||0} disabled={Number(color.stock)<=0} onChange={e=>{setQuantities(current=>({...current,[color.id]:Math.min(Number(color.stock),Math.max(0,Math.floor(Number(e.target.value)||0)))}));setError('');}} aria-label={'Quantidade '+color.name}/></div>)}<p className="muted">Total de unidades: <b>{Object.values(quantities).reduce((sum,v)=>sum+Math.max(0,Number(v)||0),0)}</b></p></>:<input type="number" min="1" max={product.stock} value={qty} onChange={e=>setQty(e.target.value)} aria-label="Quantidade"/>}{error&&<p className="msg error">{error}</p>}<button type="button" className="btn small" onClick={add}>{added?'Adicionado ✓':'Adicionar ao carrinho'}</button></div>;
}