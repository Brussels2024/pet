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

function ProductRail({ title, subtitle, products, showPrice, randomize = false }) {
  const [page, setPage] = useState(0);
  const [randomProducts, setRandomProducts] = useState(products);
  const ordered = randomize ? randomProducts : products;
  const pages = Math.max(1, Math.ceil(ordered.length / 4));

  useEffect(() => {
    if (randomize) setRandomProducts(shuffle(products));
  }, [products, randomize]);

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

  if (!ordered.length) return null;
  const visible = ordered.slice(page * 4, page * 4 + 4);
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
            <button type="button" onClick={() => move(-1)} aria-label="Quatro produtos anteriores">‹</button>
            <span>{page + 1} / {pages}</span>
            <button type="button" onClick={() => move(1)} aria-label="Próximos quatro produtos">›</button>
          </div>
        )}
      </div>
      <div className="products showcase-products">
        {visible.map((p) => (
          <article className="product" key={p.id}>
            <Link className="product-detail-link" href={'/produto/' + p.id} aria-label={'Ver detalhes de ' + p.name}>
              <div className="photo">
                {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" /> : 'Sem foto'}
              </div>
              <div className="info">
                <div className="name">{p.name}</div>
                {p.sku && <div className="sku">Cód. {p.sku}</div>}
              </div>
            </Link>
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
    </section>
  );
}

export default function ProductCarousel({ products = [], priorityProducts = [], showPrice }) {
  const featured = useMemo(() => priorityProducts.slice(0, 8), [priorityProducts]);
  const featuredIds = new Set(featured.map((product) => product.id));
  const regular = products.filter((product) => !featuredIds.has(product.id));

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
        title={featured.length ? 'Mais produtos' : 'Produtos'}
        subtitle="Confira outros produtos da nossa loja."
        products={regular}
        showPrice={showPrice}
        randomize
      />
    </>
  );
}
