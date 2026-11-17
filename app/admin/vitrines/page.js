import { query } from '@/lib/db';
import { createFeaturedCollection, saveFeaturedCollection, deleteFeaturedCollection } from '../actions';

export const dynamic = 'force-dynamic';

export default async function FeaturedCollectionsPage() {
  const [collections, products, assignments] = await Promise.all([
    query('SELECT id, title, active, position FROM featured_collections ORDER BY position, id'),
    query('SELECT id, name, sku, image_url FROM products WHERE active = true ORDER BY name LIMIT 500'),
    query('SELECT collection_id, product_id FROM featured_collection_products'),
  ]);
  const selectedByCollection = new Map();
  for (const item of assignments) {
    if (!selectedByCollection.has(item.collection_id)) selectedByCollection.set(item.collection_id, new Set());
    selectedByCollection.get(item.collection_id).add(item.product_id);
  }

  return (
    <>
      <h1>Vitrines por linha</h1>
      <p className="muted">Crie seções como Linha Black, Linha Neon ou Premium. Marque manualmente os produtos que devem aparecer em cada vitrine. Cada seção mostra quatro produtos por vez e troca automaticamente a cada 10 segundos.</p>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Criar nova linha</h2>
        <form action={createFeaturedCollection} className="inline-form">
          <input name="title" required maxLength={80} placeholder="Ex.: Linha Black" aria-label="Nome da linha" />
          <button className="btn" type="submit">Criar vitrine</button>
        </form>
      </div>
      {collections.length === 0 ? <p className="muted">Nenhuma vitrine criada ainda.</p> : collections.map((collection) => {
        const selected = selectedByCollection.get(collection.id) || new Set();
        return (
          <section className="card" key={collection.id} style={{ marginBottom: 18 }}>
            <form action={saveFeaturedCollection}>
              <input type="hidden" name="id" value={collection.id} />
              <div className="grid2">
                <div className="field">
                  <label htmlFor={`line-title-${collection.id}`}>Nome da vitrine</label>
                  <input id={`line-title-${collection.id}`} name="title" defaultValue={collection.title} required maxLength={80} />
                </div>
                <div className="field" style={{ alignSelf: 'end' }}>
                  <label><input type="checkbox" name="active" defaultChecked={collection.active} /> Exibir na página inicial</label>
                </div>
              </div>
              <h2>Escolher produtos ({selected.size} selecionados)</h2>
              <p className="muted">Selecione quantos quiser. A loja exibirá quatro por vez e avançará para os próximos quatro a cada 10 segundos.</p>
              <div className="line-product-picker">
                {products.map((product) => (
                  <label className="line-product-option" key={product.id}>
                    <input type="checkbox" name="product_ids" value={product.id} defaultChecked={selected.has(product.id)} />
                    {product.image_url ? <img src={product.image_url} alt="" /> : <span className="line-product-no-image">Foto</span>}
                    <span><b>{product.name}</b>{product.sku && <small>Cód. {product.sku}</small>}</span>
                  </label>
                ))}
              </div>
              <div className="row-actions" style={{ marginTop: 16 }}>
                <button className="btn" type="submit">Salvar vitrine</button>
              </div>
            </form>
            <form action={deleteFeaturedCollection} style={{ marginTop: 10 }}>
              <input type="hidden" name="id" value={collection.id} />
              <button className="btn danger small" type="submit">Excluir esta vitrine</button>
            </form>
          </section>
        );
      })}
    </>
  );
}
