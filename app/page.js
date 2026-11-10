import Link from 'next/link';
import { query } from '@/lib/db';
import { getUser, canSeePrices } from '@/lib/auth';
import CategoryMenu from '@/components/CategoryMenu';
import BannerCarousel from '@/components/BannerCarousel';
import ProductCarousel from '@/components/ProductCarousel';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const q = String(sp?.q || '').trim();
  const catId = Number(sp?.cat) || null;

  const user = await getUser();
  const showPrice = canSeePrices(user);

  const [cats, banners] = await Promise.all([
    query('SELECT id, name, parent_id FROM categories WHERE active = true ORDER BY position, name, id'),
    query('SELECT id, position, title, image_url, active FROM banners WHERE active = true ORDER BY position'),
  ]);
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
    `SELECT p.id, p.name, p.description, p.sku, p.price, p.stock, p.image_url, p.priority
     FROM products p
     WHERE ${where.join(' AND ')}
     ORDER BY p.priority DESC, p.name
     LIMIT 120`,
    params
  );

  const imageRows = rows.length
    ? await query('SELECT product_id, image_url, position FROM product_images WHERE product_id = ANY($1::int[]) ORDER BY product_id, position', [rows.map((product) => product.id)])
    : [];
  const imagesByProduct = new Map();
  for (const image of imageRows) {
    if (!imagesByProduct.has(image.product_id)) imagesByProduct.set(image.product_id, []);
    imagesByProduct.get(image.product_id).push(image.image_url);
  }
  const products = rows.map((product) => ({
    ...product,
    images: imagesByProduct.get(product.id) || (product.image_url ? [product.image_url] : []),
    image_url: (imagesByProduct.get(product.id) || [product.image_url])[0] || '',
  }));
  const priorityProducts = products.filter((product) => product.priority);

  const activeName = catId ? cats.find((c) => c.id === catId)?.name : null;

  return (
    <>
      <div className="wrap home-banner-wrap">
        <BannerCarousel banners={banners} />
      </div>
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

          <ProductCarousel products={products} priorityProducts={priorityProducts} showPrice={showPrice} />
        </section>
      </div>
    </>
  );
}
