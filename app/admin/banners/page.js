import Link from 'next/link';
import { query } from '@/lib/db';
import { saveBanner, deleteBanner } from '../actions';
import ImagePicker from '@/components/ImagePicker';

export const dynamic = 'force-dynamic';

export default async function BannersPage() {
  const banners = await query('SELECT id, position, title, image_url, active FROM banners ORDER BY position');
  const byPosition = new Map(banners.map((banner) => [Number(banner.position), banner]));

  return (
    <>
      <p className="muted"><Link href="/admin">← Painel</Link></p>
      <h1>Banners da página inicial</h1>
      <p className="muted">Cadastre até três imagens. A loja alterna os banners automaticamente a cada 30 segundos e também permite avançar pelas setas.</p>
      <div className="msg warn" style={{ maxWidth: 760 }}>
        <b>Formato recomendado: 1920 × 800 pixels (proporção 12:5).</b>
        Use uma única imagem para computador e celular. A loja ajusta automaticamente a exibição para a largura da tela. Mantenha textos, logotipo e produtos importantes centralizados para evitar cortes nas laterais.
      </div>
      <div className="banner-admin-grid">
        {[1, 2, 3].map((position) => {
          const banner = byPosition.get(position);
          return (
            <div className="card banner-admin-card" key={position}>
              <form action={saveBanner}>
                <input type="hidden" name="position" value={position} />
                <h2>Banner {position}</h2>
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
    </>
  );
}
