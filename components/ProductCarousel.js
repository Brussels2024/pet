'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { brl } from '@/lib/format';
import AddToCart from '@/components/AddToCart';

function ProductPhoto({ product }) {
  const images = useMemo(() => {
    const list = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
    return list.length ? list : (product.image_url ? [product.image_url] : []);
  }, [product.images, product.image_url]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [product.id, images.length]);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [images]);

  return (
    <div className="photo">
      {images.length ? <img src={images[index] || images[0]} alt={product.name} loading="lazy" /> : 'Sem foto'}
    </div>
  );
}

function ProductRail({ title, subtitle, products, showPrice }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(products.length / 4));

  useEffect(() => {
    setPage(0);
  }, [products.length]);

  useEffect(() => {
    if (pages < 2) return;
    const timer = window.setInterval(() => {
      setPage((current) => (current + 1) % pages);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [pages]);

  if (!products.length) return null;
  const visible = products.slice(page * 4, page * 4 + 4);
  const move = (direction) => setPage((current) => (current + direction + pages) % pages);

  return (
    <section className="product-showcase" aria-label={title}>
      <div className="showcase-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {pages > 1 && (
          <div className="showcase-controls">
            <button type="button" onClick={() => move(-1)} aria-label="Produtos em destaque anteriores">‹</button>
            <span>{page + 1} / {pages}</span>
            <button type="button" onClick={() => move(1)} aria-label="Próximos produtos em destaque">›</button>
          </div>
        )}
      </div>
      <div className="products showcase-products">
        {visible.map((p) => (
          <article className="product" key={p.id}>
            <Link className="product-detail-link" href={'/produto/' + p.id} aria-label={'Ver detalhes de ' + p.name}>
              <ProductPhoto product={p} />
              <div className="info">
                <div className="name">{p.name}</div>
                {p.sku && <div className="sku">Cód. {p.sku}</div>}
              </div>
            </Link>
            <div className="info product-purchase-info">
              {showPrice ? (
                <>
                  <div className="price">{brl(p.price)}</div>
                  {p.colors?.length ? <Link className="btn small" href={'/produto/' + p.id}>Escolher cores</Link> : <AddToCart
                    product={{
                      id: p.id,
                      name: p.name,
                      price: Number(p.price),
                      stock: Number(p.stock),
                      image_url: p.image_url,
                    }}
                  />}
                </>
              ) : (
                <div className="price-locked">Preço visível após cadastro empresarial aprovado</div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function ProductCarousel({
  products = [],
  priorityProducts = [],
  showPrice,
  page = 1,
  totalPages = 1,
  paginationBase = '/',
}) {
  const featured = useMemo(() => priorityProducts, [priorityProducts]);

  if (!products.length && !featured.length) {
    return <p className="muted">Nenhum produto encontrado.</p>;
  }

  return (
    <>
      <ProductRail
        title="Produtos em destaque"
        subtitle="Anúncios fixados na edição dos produtos."
        products={featured}
        showPrice={showPrice}
      />

      {products.length > 0 && (
        <section className="product-showcase">
          <div className="showcase-heading">
            <div>
              <h2>{featured.length ? 'Mais produtos' : 'Produtos'}</h2>
              <p className="muted">Página {page} de {Math.max(1, totalPages)} · Até 25 produtos por página</p>
            </div>
          </div>
          <div className="products">
            {products.map((p) => (
              <article className="product" key={p.id}>
                <Link className="product-detail-link" href={'/produto/' + p.id} aria-label={'Ver detalhes de ' + p.name}>
                  <ProductPhoto product={p} />
                  <div className="info">
                    <div className="name">{p.name}</div>
                    {p.sku && <div className="sku">Cód. {p.sku}</div>}
                  </div>
                </Link>
                <div className="info product-purchase-info">
                  {showPrice ? (
                    <>
                      <div className="price">{brl(p.price)}</div>
                      {p.colors?.length ? <Link className="btn small" href={'/produto/' + p.id}>Escolher cores</Link> : <AddToCart
                        product={{
                          id: p.id,
                          name: p.name,
                          price: Number(p.price),
                          stock: Number(p.stock),
                          image_url: p.image_url,
                        }}
                      />}
                    </>
                  ) : (
                    <div className="price-locked">Preço visível após cadastro empresarial aprovado</div>
                  )}
                </div>
              </article>
            ))}
          </div>
          {totalPages > 1 && (
            <nav className="product-pagination" aria-label="Paginação de produtos" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 22 }}>
              <Link
                className={'btn outline small' + (page <= 1 ? ' disabled' : '')}
                href={page <= 1 ? '#' : paginationBase + (paginationBase.includes('?') ? '&' : '?') + 'page=' + (page - 1)}
                aria-disabled={page <= 1}
                style={page <= 1 ? { opacity: 0.45, pointerEvents: "none" } : undefined}
                tabIndex={page <= 1 ? -1 : 0}
              >‹ Anterior</Link>
              <span>Página {page} de {totalPages}</span>
              <Link
                className={'btn outline small' + (page >= totalPages ? ' disabled' : '')}
                href={page >= totalPages ? '#' : paginationBase + (paginationBase.includes('?') ? '&' : '?') + 'page=' + (page + 1)}
                aria-disabled={page >= totalPages}
                style={page >= totalPages ? { opacity: 0.45, pointerEvents: "none" } : undefined}
                tabIndex={page >= totalPages ? -1 : 0}
              >Próxima ›</Link>
            </nav>
          )}
        </section>
      )}
    </>
  );
}
