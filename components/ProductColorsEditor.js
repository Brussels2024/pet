'use client';
import { useEffect, useState } from 'react';
const PALETTE = [
{name:'Preto',hex:'#111111'},{name:'Branco',hex:'#ffffff'},{name:'Cinza',hex:'#888888'},{name:'Prata',hex:'#c0c0c0'},
{name:'Vermelho',hex:'#e53935'},{name:'Vinho',hex:'#7b1e3a'},{name:'Laranja',hex:'#fb8c00'},{name:'Amarelo',hex:'#fdd835'},
{name:'Dourado',hex:'#d4af37'},{name:'Verde',hex:'#43a047'},{name:'Verde claro',hex:'#9ccc65'},{name:'Azul',hex:'#1e88e5'},
{name:'Azul marinho',hex:'#17365d'},{name:'Azul claro',hex:'#81d4fa'},{name:'Roxo',hex:'#8e24aa'},{name:'Lilás',hex:'#ce93d8'},
{name:'Rosa',hex:'#ec407a'},{name:'Marrom',hex:'#795548'},{name:'Bege',hex:'#d7c3a3'},{name:'Turquesa',hex:'#26a69a'}];
const CODES={preto:'PT',branco:'BR',cinza:'CZ',prata:'PR',vermelho:'VM',vinho:'VH',laranja:'LJ',amarelo:'AM',dourado:'DR',verde:'VD','verde claro':'VC',azul:'AZ','azul marinho':'AN','azul claro':'AC',roxo:'RX',lilas:'LL',rosa:'RS',marrom:'MR',bege:'BG',turquesa:'TQ'};
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const code=n=>CODES[norm(n)]||norm(n).replace(/[^a-z0-9]/g,'').slice(0,2).toUpperCase()||'CO';
const labelFor=hex=>PALETTE.find(x=>x.hex.toLowerCase()===String(hex||'').toLowerCase())?.name||'Outra cor';
export default function ProductColorsEditor({initialColors=[],baseSku:initialBaseSku=''}) {
 const [colors,setColors]=useState(initialColors.map(c=>({...c,name:c.name||labelFor(c.hex)})));
 const [baseSku,setBaseSku]=useState(initialBaseSku);
 useEffect(()=>{const input=document.querySelector('input[name="sku"]');if(!input)return;const sync=()=>setBaseSku(input.value.trim());input.addEventListener('input',sync);sync();return()=>input.removeEventListener('input',sync);},[]);
 const skuFor=name=>baseSku?baseSku+'-'+code(name):'Informe o SKU principal';
 function addColor(item){setColors(current=>current.some(c=>String(c.hex).toLowerCase()===item.hex.toLowerCase())?current:[...current,{name:item.name,sku:'',hex:item.hex,stock:0,min_stock:0}]);}
 function change(index,key,value){setColors(current=>current.map((c,i)=>i===index?{...c,[key]:value}:c));}
 function remove(index){setColors(current=>current.filter((_,i)=>i!==index));}
 const serialized=colors.map(c=>({...c,sku:skuFor(c.name)}));
 return <section className="field">
 <h2 style={{marginBottom:4}}>Cores e estoque por cor</h2><p className="muted">Clique nas cores da paleta. O SKU será gerado automaticamente a partir do SKU principal.</p>
 <div style={{display:'grid',gridTemplateColumns:'repeat(10,minmax(0,1fr))',gap:9,maxWidth:440,margin:'12px 0 18px'}}>
 {PALETTE.map(item=>{const selected=colors.some(c=>String(c.hex).toLowerCase()===item.hex.toLowerCase());return <button key={item.hex} type="button" title={item.name} aria-label={item.name} aria-pressed={selected} onClick={()=>addColor(item)} style={{width:30,height:30,padding:0,borderRadius:'50%',background:item.hex,border:selected?'3px solid #7c3aed':'1px solid #aaa',boxShadow:selected?'0 0 0 2px white, 0 0 0 4px #7c3aed':'none',cursor:selected?'default':'pointer',opacity:selected?.55:1}}/>;})}
 </div>
 <input type="hidden" name="colors_json" value={JSON.stringify(serialized)}/>
 {colors.length===0?<p className="muted">Nenhuma cor selecionada ainda.</p>:colors.map((color,index)=><div key={color.id||color.hex} className="card" style={{marginBottom:10,padding:12}}>
 <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}><span aria-label={labelFor(color.hex)} title={labelFor(color.hex)} style={{width:30,height:30,flex:'0 0 30px',borderRadius:'50%',background:color.hex||'#888',border:'1px solid #aaa'}}/><strong style={{flex:1}}>{color.name}</strong><button type="button" className="btn small outline" onClick={()=>remove(index)}>Remover</button></div>
 <div className="grid2"><div className="field"><label>SKU da cor (automático)</label><input value={skuFor(color.name)} readOnly aria-label={'SKU automático '+color.name}/></div><div className="field"><label>Quantidade em estoque</label><input type="number" min="0" value={color.stock??0} onChange={e=>change(index,'stock',Math.max(0,Number(e.target.value)||0))}/></div></div>
 <div className="field"><label>Quantidade mínima para compra</label><input type="number" min="0" value={color.min_stock??0} onChange={e=>change(index,'min_stock',Math.max(0,Number(e.target.value)||0))}/></div>
 </div>)}
 </section>;
}