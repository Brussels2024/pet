import Link from 'next/link';
import { getSetting } from '@/lib/db';
import { saveSettings, saveStoreLogo } from '../actions';
import ImagePicker from '@/components/ImagePicker';

export const dynamic = 'force-dynamic';

export default async function ConfiguracoesPage() {
  const [minOrder, whatsapp, storeLogo] = await Promise.all([
    getSetting('min_order', '300'),
    getSetting('whatsapp', ''),
    getSetting('store_logo', ''),
  ]);

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

      <form action={saveStoreLogo} className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Logo da loja</h2>
        <p className="muted">Altere a imagem que aparece no cabeçalho da loja. Se remover a imagem personalizada, a logo original Brussels Pet será restaurada.</p>
        <ImagePicker name="logo_image" initialValue={storeLogo} label="Nova logo" />
        <button className="btn" type="submit">Salvar logo</button>
      </form>

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
