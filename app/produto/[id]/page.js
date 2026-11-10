import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { getUser, canSeePrices } from '@/lib/auth';
import { brl } from '@/lib/format';
import AddToCart from '@/components/AddToCart';
import ProductGallery from '@/components/ProductGallery';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({ params }) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId < 1) notFound();

  const rows = await query(
    `SELECT p.id, p.name, p.description, p.sku, p.price, p.stock, p.image_url,
            p.priority, c.name AS category
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1 AND p.active = true
      LIMIT 1`,
    [productId]
  );
  if (!rows.length) notFound();

  const product = rows[0];
  const savedImages = await query(
    'SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY position LIMIT 6',
    [productId]
  );
  const images = savedImages.length
    ? savedImages.map((image) => image.image_url)
    : (product.image_url ? [product.image_url] : []);
  const user = await getUser();
  const showPrice = canSeePrices(user);

  return (
    <div className="wrap product-detail-page">
      <p className="product-breadcrumb"><Link href="/">Início</Link> / {product.category || 'Produtos'} / {product.name}</p>
      <div className="product-detail-grid">
        <ProductGallery images={images} name={product.name} />
        <section className="product-detail-info">
          {product.priority && <span className="tag product-featured-tag">Anúncio em destaque</span>}
          <h1>{product.name}</h1>
          {product.sku && <p className="muted">Código: {product.sku}</p>}
          {product.category && <p className="muted">Categoria: {product.category}</p>}
          <div className="product-detail-description">
            <h2>Descrição</h2>
            {product.description
              ? <p>{product.description}</p>
              : <p className="muted">Nenhuma descrição informada para este produto.</p>}
          </div>
          {showPrice ? (
            <div className="product-detail-buy">
              <div className="price">{brl(product.price)}</div>
              <p className="muted">{Number(product.stock) > 0 ? 'Disponível em estoque' : 'Sem estoque no momento'}</p>
              <AddToCart
                product={{
                  id: product.id,
                  name: product.name,
                  price: Number(product.price),
                  stock: Number(product.stock),
                  image_url: images[0] || '',
                }}
              />
            </div>
          ) : (
            <div className="msg warn product-price-notice">
              Os preços são exclusivos para empresas com cadastro aprovado.
              <div className="product-auth-links">
                <Link className="btn" href="/cadastro">Cadastrar empresa</Link>
                <Link className="btn outline" href="/entrar">Entrar</Link>
              </div>
            </div>
          )}
          <Link className="btn outline product-back-link" href="/">Voltar para a loja</Link>
        </section>
      </div>
    </div>
  );
}
