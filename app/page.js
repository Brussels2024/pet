import Link from 'next/link';
import { query } from '@/lib/db';
import { getUser, canSeePrices } from '@/lib/auth';
import CategoryMenu from '@/components/CategoryMenu';
import BannerCarousel from '@/components/BannerCarousel';
import ProductCarousel, { ProductRail } from '@/components/ProductCarousel';

export const dynamic = 'force-dynamic';

// Featured rails use the category name when linked to a category.

export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const q = String(sp?.q || '').trim();
  const catId = Number(sp?.cat) || null;

  const user = await getUser();
  const showPrice = canSeePrices(user);

  const [cats, banners, collections] = await Promise.all([
    query('SELECT id, name, parent_id FROM categories WHERE active = true ORDER BY position, name, id'),
    query('SELECT id, position, title, image_url, active FROM banners WHERE active = true ORDER BY position'),
    (!q && !catId) ? query(
      `SELECT fc.id, c.name AS title
         FROM featured_collections fc
         JOIN categories c ON c.id = fc.category_id AND c.active = true
        WHERE fc.active = true AND fc.category_id IS NOT NULL
        ORDER BY c.position, c.name, c.id`
    ) : Promise.resolve([]),
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
    // Usa o vínculo atual de múltiplas categorias e mantém compatibilidade
    // com produtos antigos que ainda possuem apenas products.category_id.
    where.push(
      `(EXISTS (
        SELECT 1
          FROM product_categories pc
          JOIN categories linked_category ON linked_category.id = pc.category_id
         WHERE pc.product_id = p.id
           AND (pc.category_id = $${n} OR linked_category.parent_id = $${n})
      ) OR p.category_id = $${n} OR p.category_id IN (SELECT id FROM categories WHERE parent_id = $${n}))`
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
     ORDER BY p.priority DESC, p.name`,
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
  const storefrontProducts = showPrice ? products : products.map(({ price, ...product }) => product);
  const priorityProducts = storefrontProducts.filter((product) => product.priority);

  const activeName = catId ? cats.find((c) => c.id === catId)?.name : null;
  const collectionProducts = collections.length ? await query(
    `SELECT fcp.collection_id, p.id, p.name, p.sku, p.price, p.stock, p.image_url
       FROM featured_collection_products fcp
       JOIN products p ON p.id = fcp.product_id AND p.active = true
      WHERE fcp.collection_id = ANY($1::int[])
      ORDER BY fcp.collection_id, fcp.position, p.name`,
    [collections.map((item) => item.id)]
  ) : [];
  const collectionImages = collectionProducts.length ? await query(
    'SELECT product_id, image_url, position FROM product_images WHERE product_id = ANY($1::int[]) ORDER BY product_id, position',
    [collectionProducts.map((item) => item.id)]
  ) : [];
  const collectionImagesByProduct = new Map();
  for (const image of collectionImages) {
    if (!collectionImagesByProduct.has(image.product_id)) collectionImagesByProduct.set(image.product_id, []);
    collectionImagesByProduct.get(image.product_id).push(image.image_url);
  }
  const collectionProductsById = new Map();
  for (const product of collectionProducts) {
    const images = collectionImagesByProduct.get(product.id) || (product.image_url ? [product.image_url] : []);
    const item = { ...product, images, image_url: images[0] || '' };
    if (!showPrice) delete item.price;
    if (!collectionProductsById.has(product.collection_id)) collectionProductsById.set(product.collection_id, []);
    collectionProductsById.get(product.collection_id).push(item);
  }
  const collectionProductIds = [...new Set(collectionProducts.map((product) => product.id))];

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

          {!q && !catId && collections.map((collection) => (
            <ProductRail key={collection.id} title={collection.title} products={collectionProductsById.get(collection.id) || []} showPrice={showPrice} />
          ))}
          <ProductCarousel
            products={storefrontProducts}
            priorityProducts={priorityProducts}
            excludedIds={!q && !catId ? collectionProductIds : []}
            showPrice={showPrice}
          />
        </section>
      </div>
    </>
  );
}
