'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { brl } from '@/lib/format';
import AddToCart from '@/components/AddToCart';

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function ProductRail({ title, subtitle, products, showPrice, randomize = false }) {
  const [randomProducts, setRandomProducts] = useState(products);
  const [page, setPage] = useState(0);
  const ordered = randomize ? randomProducts : products;
  const pageSize = randomize ? 25 : ordered.length;
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));
  const visibleProducts = randomize
    ? ordered.slice(page * pageSize, (page + 1) * pageSize)
    : ordered;

  useEffect(() => {
    if (randomize) setRandomProducts(shuffle(products));
    else setRandomProducts(products);
    setPage(0);
  }, [products, randomize]);

  useEffect(() => {
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  if (!ordered.length) return null;

  const movePage = (direction) => {
    setPage((current) => Math.min(pageCount - 1, Math.max(0, current + direction)));
  };

  return (
    <section className="product-showcase" aria-label={title}>
      <div className="showcase-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </div>
      <div className="products showcase-products">
        {visibleProducts.map((p) => (
          <article className="product product-clickable" key={p.id}>
            <Link
              className="product-detail-link"
              href={`/produto/${encodeURIComponent(String(p.id))}`}
              aria-label={'Ver detalhes de ' + p.name}
              title={'Ver detalhes de ' + p.name}
            />
            <div className="photo">
              {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" /> : 'Sem foto'}
            </div>
            <div className="info">
              <div className="name">{p.name}</div>
              {p.sku && <div className="sku">Cód. {p.sku}</div>}
            </div>
            <div className="info product-purchase-info">
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
      {randomize && pageCount > 1 && (
        <nav className="showcase-pagination" aria-label="Páginas de mais produtos">
          <button type="button" onClick={() => movePage(-1)} disabled={page === 0} aria-label="Página anterior">‹</button>
          <span>Página {page + 1} de {pageCount}</span>
          <button type="button" onClick={() => movePage(1)} disabled={page === pageCount - 1} aria-label="Próxima página">›</button>
        </nav>
      )}
    </section>
  );
}

export default function ProductCarousel({
  products = [],
  priorityProducts = [],
  excludedIds = [],
  showPrice,
}) {
  const featured = useMemo(() => priorityProducts.slice(0, 8), [priorityProducts]);
  const featuredIds = new Set(featured.map((product) => product.id));
  const excluded = new Set([...featuredIds, ...excludedIds]);
  const regular = products.filter((product) => !excluded.has(product.id));

  if (!products.length && !priorityProducts.length) {
    return <p className="muted">Nenhum produto encontrado.</p>;
  }

  return (
    <>
      <ProductRail
        title="Produtos em destaque"
        subtitle="Anúncios priorizados pela Brussels Pet."
        products={featured}
        showPrice={showPrice}
      />
      <ProductRail
        title="Mais produtos"
        subtitle="Confira outros produtos da nossa loja."
        products={regular}
        showPrice={showPrice}
        randomize
      />
    </>
  );
}
