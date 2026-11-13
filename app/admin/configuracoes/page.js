import Link from 'next/link';
import { getSetting, query } from '@/lib/db';
import { saveSettings, saveStoreLogo, saveBanner, deleteBanner } from '../actions';
import ImagePicker from '@/components/ImagePicker';

export const dynamic = 'force-dynamic';

export default async function ConfiguracoesPage() {
  const [minOrder, whatsapp, storeLogo, banners] = await Promise.all([
    getSetting('min_order', '300'),
    getSetting('whatsapp', ''),
    getSetting('store_logo', ''),
    query('SELECT id, position, title, image_url, active FROM banners ORDER BY position'),
  ]);
  const byPosition = new Map(banners.map((banner) => [Number(banner.position), banner]));

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

      <section id="banners" style={{ maxWidth: 900, marginBottom: 20 }}>
        <h2>Banners da página inicial</h2>
        <p className="muted">Gerencie aqui os banners da loja. Cadastre até três imagens; a loja alterna automaticamente e permite avançar pelas setas.</p>
        <div className="msg warn" style={{ marginBottom: 16 }}>
          <b>Formato recomendado: 1920 × 800 pixels (proporção 12:5).</b>
          {' '}Use uma única imagem para computador e celular. A loja ajusta automaticamente a exibição para a largura da tela. Mantenha textos, logotipo e produtos importantes centralizados.
        </div>
        <div className="banner-admin-grid">
          {[1, 2, 3].map((position) => {
            const banner = byPosition.get(position);
            return (
              <div className="card banner-admin-card" key={position}>
                <form action={saveBanner}>
                  <input type="hidden" name="position" value={position} />
                  <h3>Banner {position}</h3>
                  <div className="field">
                    <label htmlFor={`title-${position}`}>Título (opcional)</label>
                    <input id={`title-${position}`} name="title" defaultValue={banner?.title || ''} placeholder="Ex.: Ofertas especiais" />
                  </div>
                  <ImagePicker name="image_url" initialValue={banner?.image_url || ''} label="Imagem do banner" />
                  <div className="field banner-active-field">
                    <label>
                      <input type="checkbox" name="active" defaultChecked={banner ? banner.active : true} />
                      Exibir na loja
                    </label>
                  </div>
                  <button className="btn" type="submit">Salvar banner</button>
                </form>
                {banner && (
                  <form action={deleteBanner} className="banner-delete-form">
                    <input type="hidden" name="id" value={banner.id} />
                    <button className="btn danger" type="submit">Excluir banner</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>

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
