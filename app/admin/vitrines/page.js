import { query } from '@/lib/db';
import { saveFeaturedCollection, deleteFeaturedCollection } from '../actions';

export const dynamic = 'force-dynamic';

export default async function FeaturedCollectionsPage() {
  const categories = await query('SELECT id, name FROM categories ORDER BY position, name, id');

  // Cada categoria cadastrada ganha sua própria vitrine de destaque, sem duplicar as existentes.
  for (const category of categories) {
    await query(
      'INSERT INTO featured_collections (title, position, active, category_id) VALUES ($1, $2, true, $3) ON CONFLICT (category_id) WHERE category_id IS NOT NULL DO NOTHING',
      [category.name, category.id, category.id]
    );
  }

  const [collections, products, assignments] = await Promise.all([
    query('SELECT id, title, active, position, category_id FROM featured_collections WHERE category_id IS NOT NULL ORDER BY position, id'),
    query('SELECT id, name, sku, image_url FROM products WHERE active = true ORDER BY name LIMIT 500'),
    query('SELECT collection_id, product_id FROM featured_collection_products'),
  ]);
  const selectedByCollection = new Map();
  for (const item of assignments) {
    if (!selectedByCollection.has(item.collection_id)) selectedByCollection.set(item.collection_id, new Set());
    selectedByCollection.get(item.collection_id).add(item.product_id);
  }
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <>
      <h1>Vitrines por categoria</h1>
      <p className="muted">Escolha uma categoria cadastrada e marque os produtos que devem ficar em destaque nela. O mesmo produto pode ser destacado em várias categorias; salvar uma vitrine não altera as outras.</p>
      {collections.length === 0 ? <p className="muted">Cadastre uma categoria primeiro para criar sua vitrine de destaque.</p> : collections.map((collection) => {
        const selected = selectedByCollection.get(collection.id) || new Set();
        const category = categoryById.get(collection.category_id);
        return (
          <section className="card" key={collection.id} style={{ marginBottom: 18 }}>
            <form action={saveFeaturedCollection}>
              <input type="hidden" name="id" value={collection.id} />
              <input type="hidden" name="title" value={category?.name || collection.title} />
              <div className="grid2">
                <div className="field">
                  <label>Nome da vitrine / categoria</label>
                  <strong>{category?.name || collection.title}</strong>
                </div>
                <div className="field" style={{ alignSelf: 'end' }}>
                  <label><input type="checkbox" name="active" defaultChecked={collection.active} /> Exibir na página inicial</label>
                </div>
              </div>
              <h2>Produtos em destaque ({selected.size} selecionados)</h2>
              <p className="muted">Marque os produtos desta categoria. Eles podem também aparecer em outras vitrines.</p>
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
                <button className="btn" type="submit">Salvar destaque desta categoria</button>
              </div>
            </form>
          </section>
        );
      })}
    </>
  );
}
