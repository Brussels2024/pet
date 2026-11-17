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
  const ordered = randomize ? randomProducts : products;

  useEffect(() => {
    if (randomize) setRandomProducts(shuffle(products));
    else setRandomProducts(products);
  }, [products, randomize]);

  if (!ordered.length) return null;

  return (
    <section className="product-showcase" aria-label={title}>
      <div className="showcase-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </div>
      <div className="products showcase-products">
        {ordered.map((p) => (
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
