'use client';

import { useState } from 'react';

export default function ProductGallery({ images = [], name = '' }) {
  const [active, setActive] = useState(0);
  if (!images.length) {
    return <div className="product-gallery-empty">Produto sem foto</div>;
  }
  return (
    <div className="product-gallery">
      <div className="product-gallery-main">
        <button
          type="button"
          className="gallery-arrow previous"
          onClick={() => setActive((current) => (current - 1 + images.length) % images.length)}
          aria-label="Foto anterior"
          disabled={images.length < 2}
        >‹</button>
        <img src={images[active]} alt={name + ' — foto ' + (active + 1)} />
        <button
          type="button"
          className="gallery-arrow next"
          onClick={() => setActive((current) => (current + 1) % images.length)}
          aria-label="Próxima foto"
          disabled={images.length < 2}
        >›</button>
      </div>
      {images.length > 1 && (
        <div className="product-gallery-thumbs">
          {images.map((src, index) => (
            <button
              type="button"
              key={index}
              className={index === active ? 'selected' : ''}
              onClick={() => setActive(index)}
              aria-label={'Abrir foto ' + (index + 1)}
              aria-pressed={index === active}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
      <p className="muted gallery-count">Foto {active + 1} de {images.length}</p>
    </div>
  );
}
