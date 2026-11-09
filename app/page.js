import Link from 'next/link';
import { query } from '@/lib/db';
import { getUser, canSeePrices } from '@/lib/auth';
import { brl } from '@/lib/format';
import CategoryMenu from '@/components/CategoryMenu';
import AddToCart from '@/components/AddToCart';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const q = String(sp?.q || '').trim();
  const catId = Number(sp?.cat) || null;

  const user = await getUser();
  const showPrice = canSeePrices(user);

  const cats = await query(
    'SELECT id, name, parent_id FROM categories WHERE active = true ORDER BY position, name, id'
  );
  const tree = cats
    .filter((c) => !c.parent_id)
    .map((parent) => ({
      id: parent.id,
      name: parent.name,
      children: cats
        .filter((c) => c.parent_id === parent.id)
        .map((c) => ({ id: c.id, name: c.name })),
    }));

  const where = ['p.active = true'];
  const params = [];
  if (catId) {
    params.push(catId);
    const n = params.length;
    where.push(
      `(p.category_id = $${n} OR p.category_id IN (SELECT id FROM categories WHERE parent_id = $${n}))`
    );
  }
  if (q) {
    params.push(`%${q}%`);
    const n = params.length;
    where.push(`(p.name ILIKE $${n} OR p.sku ILIKE $${n} OR p.description ILIKE $${n})`);
  }

  const rows = await query(
    `SELECT p.id, p.name, p.description, p.sku, p.price, p.stock, p.image_url
     FROM products p
     WHERE ${where.join(' AND ')}
     ORDER BY p.name
     LIMIT 120`,
    params
  );

  const activeName = catId ? cats.find((c) => c.id === catId)?.name : null;

  return (
    <div className="wrap shop">
      <CategoryMenu tree={tree} activeId={catId} />

      <section>
        <h1>{q ? `Resultados para “${q}”` : activeName || 'Todos os produtos'}</h1>

        {!showPrice && (
          <div className="msg warn">
            Os preços são exclusivos para empresas. <Link href="/cadastro"><b>Cadastre seu CNPJ</b></Link> ou{' '}
            <Link href="/entrar"><b>entre</b></Link> para ver os valores e comprar.
          </div>
        )}

        {rows.length === 0 ? (
          <p className="muted">Nenhum produto encontrado.</p>
        ) : (
          <div className="products">
            {rows.map((p) => (
              <article className="product" key={p.id}>
                <div className="photo">
                  {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" /> : 'Sem foto'}
                </div>
                <div className="info">
                  <div className="name">{p.name}</div>
                  {p.sku && <div className="sku">Cód. {p.sku}</div>}
                  {showPrice ? (
                    <>
                      <div className="price">{brl(p.price)}</div>
                      <AddToCart
                        product={{
                          id: p.id,
                          name: p.name,
                          price: Number(p.price),
                          stock: Number(p.stock),
                          image_url: p.image_url,
                        }}
                      />
                    </>
                  ) : (
                    <div className="price-locked">Preço visível após cadastro empresarial aprovado</div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
