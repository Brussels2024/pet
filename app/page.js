import Link from 'next/link';
import { query } from '@/lib/db';
import { getUser, canSeePrices } from '@/lib/auth';
import CategoryMenu from '@/components/CategoryMenu';
import BannerCarousel from '@/components/BannerCarousel';
import ProductCarousel, { ProductRail } from '@/components/ProductCarousel';

export const dynamic = 'force-dynamic';

function attachImages(rows, imagesByProduct) {
  return rows.map((product) => {
    const images = imagesByProduct.get(product.id) || (product.image_url ? [product.image_url] : []);
    return { ...product, images, image_url: images[0] || '' };
  });
}

export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const q = String(sp?.q || '').trim();
  const catId = Number(sp?.cat) || null;
  const isHome = !q && !catId;
  const user = await getUser();
  const showPrice = canSeePrices(user);

  const [cats, banners, featuredCategories] = await Promise.all([
    query('SELECT id, name, parent_id FROM categories WHERE active = true ORDER BY position, name, id'),
    query('SELECT id, position, title, image_url, active FROM banners WHERE active = true ORDER BY position'),
    isHome ? query('SELECT fc.category_id, c.name FROM featured_categories fc JOIN categories c ON c.id = fc.category_id WHERE fc.active = true AND c.active = true ORDER BY fc.position, fc.id') : Promise.resolve([]),
  ]);
  const tree = cats.filter((c) => !c.parent_id).map((parent) => ({
    id: parent.id, name: parent.name,
    children: cats.filter((c) => c.parent_id === parent.id).map((c) => ({ id: c.id, name: c.name })),
  }));

  let priorityRows = [];
  let generalRows = [];
  if (isHome) {
    [priorityRows, generalRows] = await Promise.all([
      query('SELECT p.id, p.name, p.description, p.sku, p.price, p.stock, p.image_url, p.priority, p.colors FROM products p WHERE p.active = true AND p.priority = true ORDER BY p.name LIMIT 8'),
      query(`SELECT p.id, p.name, p.description, p.sku, p.price, p.stock, p.image_url, p.priority, p.colors
               FROM products p
              WHERE p.active = true AND p.priority = false
                AND NOT EXISTS (
                  SELECT 1 FROM product_categories pc
                  JOIN featured_categories fc ON fc.category_id = pc.category_id AND fc.active = true
                  WHERE pc.product_id = p.id
                )
                AND NOT EXISTS (
                  SELECT 1 FROM featured_categories fc
                  WHERE fc.active = true AND fc.category_id = p.category_id
                )
              ORDER BY random() LIMIT 500`),
    ]);
  } else {
    const where = ['p.active = true'];
    const params = [];
    if (catId) {
      params.push(catId);
      const n = params.length;
      where.push(`(EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = p.id AND (pc.category_id = $${n} OR pc.category_id IN (SELECT id FROM categories WHERE parent_id = $${n}))) OR p.category_id = $${n})`);
    }
    if (q) {
      params.push('%' + q + '%');
      const n = params.length;
      where.push(`(p.name ILIKE $${n} OR p.sku ILIKE $${n} OR p.description ILIKE $${n})`);
    }
    generalRows = await query(
      `SELECT p.id, p.name, p.description, p.sku, p.price, p.stock, p.image_url, p.priority, p.colors
         FROM products p WHERE ${where.join(' AND ')}
        ORDER BY p.priority DESC, p.name LIMIT 300`,
      params
    );
    priorityRows = generalRows.filter((product) => product.priority);
  }

  const featuredProductRows = featuredCategories.length ? await query(
    `SELECT fc.category_id, p.id, p.name, p.sku, p.price, p.stock, p.image_url, p.colors
       FROM featured_categories fc
       JOIN product_categories pc ON pc.category_id = fc.category_id
       JOIN products p ON p.id = pc.product_id AND p.active = true
       JOIN categories c ON c.id = fc.category_id AND c.active = true
      WHERE fc.active = true
      ORDER BY fc.position, p.name`
  ) : [];

  const allIds = [...new Set([...priorityRows.map((p) => p.id), ...generalRows.map((p) => p.id), ...featuredProductRows.map((p) => p.id)])];
  const imageRows = allIds.length
    ? await query('SELECT product_id, image_url, position FROM product_images WHERE product_id = ANY($1::int[]) ORDER BY product_id, position', [allIds])
    : [];
  const imagesByProduct = new Map();
  for (const image of imageRows) {
    if (!imagesByProduct.has(image.product_id)) imagesByProduct.set(image.product_id, []);
    imagesByProduct.get(image.product_id).push(image.image_url);
  }

  const products = attachImages(generalRows, imagesByProduct);
  const storefrontProducts = showPrice ? products : products.map(({ price, ...product }) => product);
  const priorityProducts = attachImages(priorityRows, imagesByProduct).map((product) => {
    if (!showPrice) { const { price, ...safe } = product; return safe; }
    return product;
  });

  const productsByCategory = new Map();
  for (const product of attachImages(featuredProductRows, imagesByProduct)) {
    if (!productsByCategory.has(product.category_id)) productsByCategory.set(product.category_id, []);
    const item = { ...product };
    if (!showPrice) delete item.price;
    productsByCategory.get(product.category_id).push(item);
  }
  const activeName = catId ? cats.find((c) => c.id === catId)?.name : null;

  return <>
    <div className="wrap home-banner-wrap"><BannerCarousel banners={banners} /></div>
    <div className="wrap shop">
      <CategoryMenu tree={tree} activeId={catId} />
      <section>
        <h1>{q ? `Resultados para “${q}”` : activeName || 'Todos os produtos'}</h1>
        {!showPrice && <div className="msg warn">
          Os preços são exclusivos para empresas. <Link href="/cadastro"><b>Cadastre seu CNPJ</b></Link> ou{' '}
          <Link href="/entrar"><b>entre</b></Link> para ver os valores e comprar.
        </div>}
        {isHome && featuredCategories.map((category) => (
          <ProductRail key={category.category_id} title={category.name} products={productsByCategory.get(category.category_id) || []} showPrice={showPrice} />
        ))}
        <ProductCarousel products={storefrontProducts} priorityProducts={priorityProducts} showPrice={showPrice} />
      </section>
    </div>
  </>;
}
