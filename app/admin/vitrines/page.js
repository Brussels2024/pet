import { query } from '@/lib/db';
import { saveFeaturedCategories } from '../actions';

export const dynamic = 'force-dynamic';

export default async function FeaturedCategoriesPage() {
  const [categories, selected] = await Promise.all([
    query('SELECT id, name, parent_id FROM categories WHERE active = true ORDER BY position, name, id'),
    query('SELECT category_id FROM featured_categories WHERE active = true ORDER BY position, id'),
  ]);
  const selectedIds = new Set(selected.map((item) => Number(item.category_id)));
  const labels = new Map();
  for (const parent of categories.filter((item) => !item.parent_id)) {
    labels.set(parent.id, parent.name);
    for (const child of categories.filter((item) => item.parent_id === parent.id)) labels.set(child.id, parent.name + ' › ' + child.name);
  }
  const ordered = [...categories.filter((item) => !item.parent_id), ...categories.filter((item) => item.parent_id)];
  return (
    <>
      <h1>Categorias em destaque</h1>
      <p className="muted">Marque as categorias que devem ganhar uma seção própria na página inicial. A seção usa o nome da categoria e mostra automaticamente todos os anúncios ativos associados a ela. Cada esteira exibe quatro anúncios, avança a cada 10 segundos e reinicia ao chegar ao fim.</p>
      <form action={saveFeaturedCategories} className="card" style={{ maxWidth: 760 }}>
        <h2 style={{ marginTop: 0 }}>Escolher categorias para a página inicial</h2>
        {ordered.length ? (
          <div className="line-product-picker">
            {ordered.map((category) => (
              <label className="line-product-option" key={category.id}>
                <input type="checkbox" name="category_ids" value={category.id} defaultChecked={selectedIds.has(Number(category.id))} />
                <span><b>{labels.get(category.id) || category.name}</b></span>
              </label>
            ))}
          </div>
        ) : <p className="muted">Nenhuma categoria ativa cadastrada.</p>}
        <div className="row-actions" style={{ marginTop: 18 }}>
          <button className="btn" type="submit">Salvar categorias em destaque</button>
        </div>
      </form>
    </>
  );
}
