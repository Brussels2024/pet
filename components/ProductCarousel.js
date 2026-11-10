'use client';

import { useEffect, useState } from 'react';
import { brl } from '@/lib/format';
import AddToCart from '@/components/AddToCart';

export default function ProductCarousel({ products = [], showPrice }) {
  const [start, setStart] = useState(0);
  const total = products.length;
  const pages = Math.max(1, Math.ceil(total / 4));

  useEffect(() => {
    if (pages < 2) return;
    const timer = window.setInterval(() => {
      setStart((current) => ((Math.floor(current / 4) + 1) % pages) * 4);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [pages]);

  if (!total) return <p className="muted">Nenhum produto encontrado.</p>;

  const move = (direction) => {
    setStart((current) => ((Math.floor(current / 4) + direction + pages) % pages) * 4);
  };
  const visible = products.slice(start, start + 4);

  return (
    <section className="product-showcase" aria-label="Vitrine de produtos">
      <div className="showcase-heading">
        <div>
          <h2>Produtos em destaque</h2>
          <p className="muted">Confira nossa seleção de produtos para sua empresa.</p>
        </div>
        {pages > 1 && (
          <div className="showcase-controls">
            <button type="button" onClick={() => move(-1)} aria-label="Quatro produtos anteriores">‹</button>
            <span>{Math.floor(start / 4) + 1} / {pages}</span>
            <button type="button" onClick={() => move(1)} aria-label="Próximos quatro produtos">›</button>
          </div>
        )}
      </div>
      <div className="products showcase-products">
        {visible.map((p) => (
          <article className="product" key={p.id}>
            <div className="photo">
              {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" /> : 'Sem foto'}
            </div>
            <div className="info">
              <div className="name">{p.name}</div>
              {p.sku && <div className="sku">Cód. {p.sku}</div>}
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
