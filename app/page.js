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
  const requestedCatId = Number(sp?.cat);
  const catId = Number.isSafeInteger(requestedCatId) && requestedCatId > 0
    ? requestedCatId
    : null;

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
  if (catId) {
    // catId foi validado como inteiro positivo; interpolar o número evita
    // o erro de bind 08P01 observado no driver Neon nesta rota.
    where.push(
      `(p.category_id = ${catId} OR p.category_id IN (SELECT id FROM categories WHERE parent_id = ${catId}) OR EXISTS (SELECT 1 FROM product_categories pc LEFT JOIN categories selected ON selected.id = pc.category_id WHERE pc.product_id = p.id AND (pc.category_id = ${catId} OR selected.parent_id = ${catId})))`
    );
  }
  if (q) {
    // Escapa aspas simples antes de montar o literal SQL da busca.
    const safeQ = q.replace(/'/g, "''");
    where.push(`(p.name ILIKE '%${safeQ}%' OR p.sku ILIKE '%${safeQ}%' OR p.description ILIKE '%${safeQ}%')`);
  }

  const rows = await query(
    `SELECT p.id, p.name, p.description, p.sku, p.price, p.stock, p.image_url, p.priority
     FROM products p
     WHERE ${where.join(' AND ')}
     ORDER BY p.priority DESC, p.name
     LIMIT 120`
  );

  const productIds = rows.map((product) => Number(product.id)).filter((id) => Number.isInteger(id) && id > 0);
  const idList = productIds.join(',');
  const imageRows = productIds.length
    ? await query(`SELECT product_id, image_url, position FROM product_images WHERE product_id IN (${idList}) ORDER BY product_id, position`)
    : [];
  const imagesByProduct = new Map();
  for (const image of imageRows) {
    if (!imagesByProduct.has(image.product_id)) imagesByProduct.set(image.product_id, []);
    imagesByProduct.get(image.product_id).push(image.image_url);
  }
  const colorRows = productIds.length ? await query(`SELECT id, product_id, name, sku, hex, stock, min_stock FROM product_colors WHERE product_id IN (${idList}) ORDER BY position, id`) : [];
  const colorsByProduct = new Map();
  for (const color of colorRows) {
    if (!colorsByProduct.has(color.product_id)) colorsByProduct.set(color.product_id, []);
    colorsByProduct.get(color.product_id).push(color);
  }
  const products = rows.map((product) => ({
    ...product,
    images: imagesByProduct.get(product.id) || (product.image_url ? [product.image_url] : []),
    image_url: (imagesByProduct.get(product.id) || [product.image_url])[0] || '',
  }));
  const storefrontProducts = showPrice ? products : products.map(({ price, ...product }) => product);
  const priorityProducts = storefrontProducts.filter((product) => product.priority);

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

          <ProductCarousel products={storefrontProducts} priorityProducts={priorityProducts} showPrice={showPrice} />
        </section>
      </div>
    </>
  );
}
