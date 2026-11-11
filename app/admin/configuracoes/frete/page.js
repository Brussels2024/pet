import Link from 'next/link';
import { query } from '@/lib/db';
import { addShippingCity, toggleShippingCity, deleteShippingCity } from '../../actions';
export const dynamic = 'force-dynamic';
export default async function FretePage() {
 const cities = await query('SELECT id, city, uf, free_shipping FROM shipping_cities ORDER BY city, uf');
 return <>
  <p className="muted"><Link href="/admin/configuracoes">← Configurações</Link></p>
  <h1>Cidades com frete grátis</h1>
  <p className="muted">As cidades começam sem frete grátis. Ative apenas as que terão entrega gratuita. Você também pode cadastrar outras cidades.</p>
  <form action={addShippingCity} className="card inline-form" style={{marginBottom:18}}>
   <input name="city" placeholder="Nome da cidade" required/>
   <input name="uf" defaultValue="SP" maxLength={2} placeholder="UF" required style={{width:75}}/>
   <button className="btn">Adicionar cidade</button>
  </form>
  <div className="card"><p><b>{cities.filter(c=>c.free_shipping).length}</b> com frete grátis · {cities.length} cadastradas</p>
   {cities.map(c=><div key={c.id} className="inline-form" style={{justifyContent:'space-between',padding:'10px 0',borderTop:'1px solid var(--border,#ddd)'}}>
    <div><b>{c.city}/{c.uf}</b><div className="muted">{c.free_shipping?'Frete grátis ativo':'Frete sob consulta'}</div></div>
    <div className="inline-form">
     <form action={toggleShippingCity}><input type="hidden" name="id" value={c.id}/><button className={c.free_shipping?'btn small secondary':'btn small'}>{c.free_shipping?'Retirar grátis':'Liberar grátis'}</button></form>
     <form action={deleteShippingCity}><input type="hidden" name="id" value={c.id}/><button className="btn small outline">Excluir</button></form>
    </div>
   </div>)}
  </div>
 </>;
}