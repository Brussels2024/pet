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

function ProductPhoto({ product }) {
  const images = Array.isArray(product.images) && product.images.length ? product.images : (product.image_url ? [product.image_url] : []);
  const [active, setActive] = useState(0);
  useEffect(() => {
    setActive(0);
    if (images.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % images.length), 5000);
    return () => window.clearInterval(timer);
  }, [images.length, product.id]);
  return <div className="photo">{images.length ? <img src={images[active] || images[0]} alt={product.name} loading="lazy" /> : 'Sem foto'}</div>;
}

export function ProductRail({ title, subtitle, products, showPrice, randomize = false, maxProducts, pageSize = 4, listMode = false, controlsAtBottom = false, autoAdvance = true }) {
  const [page, setPage] = useState(0);
  const [randomProducts, setRandomProducts] = useState(products);
  const ordered = randomize ? randomProducts : products;
  const pages = Math.max(1, Math.ceil(ordered.length / pageSize));

  useEffect(() => {
    if (randomize) {
      const shuffled = shuffle(products);
      setRandomProducts(Number.isInteger(maxProducts) ? shuffled.slice(0, maxProducts) : shuffled);
    } else setRandomProducts(products);
  }, [products, randomize, maxProducts]);

  useEffect(() => { setPage(0); }, [products.length, title]);
  useEffect(() => {
    if (!autoAdvance || pages < 2) return;
    const timer = window.setInterval(() => setPage((current) => (current + 1) % pages), 10000);
    return () => window.clearInterval(timer);
  }, [pages, autoAdvance]);

  if (!ordered.length) return null;
  const visible = ordered.slice(page * pageSize, page * pageSize + pageSize);
  const move = (direction) => setPage((current) => (current + direction + pages) % pages);

  return (
    <section className="product-showcase" aria-label={title}>
      <div className="showcase-heading">
        <div><h2>{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}</div>
        {pages > 1 && !controlsAtBottom && <div className="showcase-controls">
          <button type="button" onClick={() => move(-1)} aria-label="Página anterior de produtos">‹</button>
          <span>{page + 1} / {pages}</span>
          <button type="button" onClick={() => move(1)} aria-label="Próxima página de produtos">›</button>
        </div>}
      </div>
      <div className={`products showcase-products${listMode ? " showcase-products-list" : ""}`}>
        {visible.map((p) => (
          <article className="product" key={p.id}>
            <Link className="product-detail-link" href={'/produto/' + p.id} aria-label={'Ver detalhes de ' + p.name}>
              <ProductPhoto product={p} />
              <div className="info"><div className="name">{p.name}</div>{p.sku && <div className="sku">Cód. {p.sku}</div>}</div>
            </Link>
            <div className="info product-purchase-info">
              {showPrice ? <>
                <div className="price">{brl(p.price)}</div>
                <AddToCart product={{ id: p.id, name: p.name, sku: p.sku, price: Number(p.price), stock: Number(p.stock), image_url: p.image_url, colors: p.colors || [] }} />
              </> : <div className="price-locked">Preço visível após cadastro empresarial aprovado</div>}
            </div>
          </article>
        ))}
      </div>
      {pages > 1 && controlsAtBottom && <div className="showcase-controls showcase-controls-bottom">
        <button type="button" onClick={() => move(-1)} aria-label="Produtos anteriores">‹</button>
        <span>{page + 1} / {pages}</span>
        <button type="button" onClick={() => move(1)} aria-label="Próximos produtos">›</button>
      </div>}
    </section>
  );
}

export default function ProductCarousel({ products = [], priorityProducts = [], excludedIds = [], limitGeneral = false, showPrice }) {
  const featured = useMemo(() => priorityProducts.slice(0, 8), [priorityProducts]);
  const excluded = new Set([...featured.map((product) => product.id), ...excludedIds]);
  const regular = products.filter((product) => !excluded.has(product.id));
  if (!products.length && !priorityProducts.length) return <p className="muted">Nenhum produto encontrado.</p>;
  return <>
    <ProductRail title="Produtos em destaque" subtitle="Anúncios priorizados pela Brussels Pet." products={featured} showPrice={showPrice} />
    <ProductRail title="Mais produtos" subtitle="Confira outros produtos da nossa loja." products={regular} showPrice={showPrice} randomize maxProducts={limitGeneral ? 20 : undefined} pageSize={20} listMode controlsAtBottom autoAdvance={false} />
  </>;
}
