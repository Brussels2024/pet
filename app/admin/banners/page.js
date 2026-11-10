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
      <div className="banner-admin-grid">
        {[1, 2, 3].map((position) => {
          const banner = byPosition.get(position);
          return (
            <form action={saveBanner} className="card banner-admin-card" key={position}>
              <input type="hidden" name="position" value={position} />
              {banner && <input type="hidden" name="id" value={banner.id} />}
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
              <div className="row-actions">
                <button className="btn" type="submit">Salvar banner</button>
                {banner && (
                  <form action={deleteBanner}>
                    <input type="hidden" name="id" value={banner.id} />
                    <button className="btn danger" type="submit">Excluir</button>
                  </form>
                )}
              </div>
            </form>
          );
        })}
      </div>
    </>
  );
}
