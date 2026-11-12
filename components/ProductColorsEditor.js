'use client';

import { useState } from 'react';

const blank = () => ({ name: '', sku: '', hex: '#888888', stock: 0, min_stock: 0 });
export default function ProductColorsEditor({ initialColors = [] }) {
  const [colors, setColors] = useState(initialColors.map(c => ({...c})));
  function change(index, key, value) {
    setColors(current => current.map((c, i) => i === index ? {...c, [key]: value} : c));
  }
  function add() { setColors(current => [...current, blank()]); }
  function remove(index) { setColors(current => current.filter((_, i) => i !== index)); }
  return <section className="field">
    <h2 style={{marginBottom:4}}>Cores e estoque por cor</h2>
    <p className="muted">Cadastre o SKU próprio de cada cor e controle o estoque e o mínimo individualmente.</p>
    <input type="hidden" name="colors_json" value={JSON.stringify(colors)} />
    {colors.map((c, i) => <div key={i} className="card" style={{marginBottom:10,padding:12}}>
      <div className="grid2">
        <div className="field"><label>Nome da cor</label><input value={c.name} onChange={e=>change(i,'name',e.target.value)} placeholder="Amarelo" required /></div>
        <div className="field"><label>SKU da cor</label><input value={c.sku} onChange={e=>change(i,'sku',e.target.value)} placeholder="POTE-AM" /></div>
      </div>
      <div className="grid2">
        <div className="field"><label>Estoque disponível</label><input type="number" min="0" value={c.stock} onChange={e=>change(i,'stock',Math.max(0,Number(e.target.value)||0))}/></div>
        <div className="field"><label>Estoque mínimo</label><input type="number" min="0" value={c.min_stock} onChange={e=>change(i,'min_stock',Math.max(0,Number(e.target.value)||0))}/></div>
      </div>
      <div className="inline-form"><label>Identificação visual <input type="color" value={c.hex||'#888888'} onChange={e=>change(i,'hex',e.target.value)}/></label><button type="button" className="btn small outline" onClick={()=>remove(i)}>Excluir cor</button></div>
    </div>)}
    <button type="button" className="btn outline" onClick={add}>+ Adicionar cor</button>
  </section>;
}