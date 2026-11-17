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
            p.priority, p.min_quantity, p.package_price, p.colors, c.name AS category
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1 AND p.active = true
      LIMIT 1`,
    [productId]
  );
  if (!rows.length) notFound();

  const product = rows[0];
  let productColors = product.colors;
  if (typeof productColors === 'string') {
    try { productColors = JSON.parse(productColors); } catch { productColors = []; }
  }
  productColors = (Array.isArray(productColors) ? productColors : []).map((item) =>
    typeof item === 'string' ? { name: item } : item
  ).filter((item) => String(item?.name || '').trim());
  const categoryRows = await query(
    'SELECT c.name FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = $1 ORDER BY c.position, c.name',
    [productId]
  );
  const categoryNames = categoryRows.map((item) => item.name);
  if (!categoryNames.length && product.category) categoryNames.push(product.category);
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
      <p className="product-breadcrumb"><Link href="/">Início</Link> / {categoryNames[0] || 'Produtos'} / {product.name}</p>
      <div className="product-detail-grid">
        <ProductGallery images={images} name={product.name} />
        <section className="product-detail-info">
          {product.priority && <span className="tag product-featured-tag">Anúncio em destaque</span>}
          <h1>{product.name}</h1>
          {product.sku && <p className="muted">Código: {product.sku}</p>}
          {categoryNames.length > 0 && <p className="muted">Categorias: {categoryNames.join(', ')}</p>}
          <div className="product-detail-description">
            <h2>Descrição</h2>
            {product.description
              ? <p>{product.description}</p>
              : <p className="muted">Nenhuma descrição informada para este produto.</p>}
          </div>
          {showPrice ? (
            <div className="product-detail-buy">
              <div className="price">{brl(product.price)} <span className="muted">/ unidade</span></div>
              {product.package_price !== null && product.package_price !== undefined && <p className="muted">Preço do pacote: {brl(product.package_price)}</p>}
              <p className="muted">Quantidade mínima: {Math.max(1, Number(product.min_quantity) || 1)} unidades no total, somando todas as cores</p>
              <AddToCart
                product={{
                  id: product.id,
                  name: product.name,
                  sku: product.sku,
                  price: Number(product.price),
                  stock: Number(product.stock),
                  image_url: images[0] || '',
                  min_quantity: Number(product.min_quantity) || 1,
                  colors: Array.isArray(product.colors) ? product.colors : [],
                }}
              />
            </div>
          ) : (
            <>
              <div className="msg warn product-price-notice">
                Os preços são exclusivos para empresas com cadastro aprovado.
                <div className="product-auth-links">
                  <Link className="btn" href="/cadastro">Cadastrar empresa</Link>
                  <Link className="btn outline" href="/entrar">Entrar</Link>
                </div>
              </div>
              {productColors.length > 0 && (
                <div className="field color-variant-picker" style={{ width: '100%', marginTop: 18 }}>
                  <span className="color-variant-title">Cores disponíveis</span>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {productColors.map((color, index) => (
                      <div key={String(color.sku || color.name) + '-' + index} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span aria-hidden="true" style={{
                          display: 'inline-block', width: 24, height: 24, minWidth: 24, borderRadius: '50%',
                          border: '1px solid #bdbdbd',
                          background: /^#[0-9a-f]{3,8}$/i.test(String(color.hex || color.color || ''))
                            ? (color.hex || color.color)
                            : ({
                                branco:'#ffffff', preta:'#171717', preto:'#171717', amarelo:'#f4d21f',
                                verde:'#269653', azul:'#2375d8', vermelho:'#e53935', roxo:'#7e3fb2',
                                rosa:'#ed78a8', laranja:'#f28c28', cinza:'#929292', marrom:'#80543b',
                                bege:'#d9c3a0', lilas:'#b78ad5', dourado:'#c9a227', prata:'#c0c0c0'
                              }[String(color.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()] || '#a0a0a0')
                        }} />
                        <span>{color.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <Link className="btn outline product-back-link" href="/">Voltar para a loja</Link>
        </section>
      </div>
    </div>
  );
}
