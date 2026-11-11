import Link from 'next/link';
import { getSetting } from '@/lib/db';
import { saveSettings } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ConfiguracoesPage() {
  const minOrder = await getSetting('min_order', '300');
  const whatsapp = await getSetting('whatsapp', '');

  return (
    <>
      <h1>Configurações</h1>

      <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Categorias</h2>
        <p className="muted">Crie, renomeie, ordene e ative ou desative categorias e subcategorias do menu lateral.</p>
        <Link className="btn" href="/admin/configuracoes/categorias">Gerenciar categorias</Link>
      </div>

      <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Frete grátis por cidade</h2>
        <p className="muted">Ative somente as cidades que terão frete grátis. Nas demais, o cliente consulta o valor pelo WhatsApp.</p>
        <Link className="btn" href="/admin/configuracoes/frete">Gerenciar cidades</Link>
      </div>

      <form action={saveSettings} className="card" style={{ maxWidth: 560 }}>
        <h2 style={{ marginTop: 0 }}>Loja</h2>
        <div className="field">
          <label htmlFor="min_order">Pedido mínimo (R$)</label>
          <input id="min_order" name="min_order" inputMode="decimal" defaultValue={minOrder} required />
        </div>
        <div className="field">
          <label htmlFor="whatsapp">WhatsApp de atendimento (com DDD, ex.: 11999998888)</label>
          <input id="whatsapp" name="whatsapp" defaultValue={whatsapp} inputMode="tel" />
        </div>
        <button className="btn" type="submit">Salvar configurações</button>
      </form>
    </>
  );
}
