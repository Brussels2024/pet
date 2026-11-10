'use client';

import { useEffect, useState } from 'react';

export default function BannerCarousel({ banners = [] }) {
  const slides = banners.filter((banner) => banner.active && banner.image_url);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  if (!slides.length) return null;

  const move = (direction) => {
    setActive((current) => (current + direction + slides.length) % slides.length);
  };

  return (
    <section className="banner-carousel-shell" aria-label="Destaques da Brussels Pet">
      {slides.length > 1 && (
        <button type="button" className="banner-arrow prev" onClick={() => move(-1)} aria-label="Banner anterior">‹</button>
      )}
      <div className="banner-carousel">
        {slides.map((banner, index) => (
          <div
            className={`banner-slide${index === active ? ' active' : ''}`}
            key={banner.id || banner.position}
            aria-hidden={index !== active}
          >
            <img src={banner.image_url} alt={banner.title || 'Destaque Brussels Pet'} />
            {banner.title && <span className="banner-caption">{banner.title}</span>}
          </div>
        ))}
        {slides.length > 1 && (
          <div className="banner-dots">
            {slides.map((banner, index) => (
              <button
                key={banner.id || banner.position}
                type="button"
                className={index === active ? 'selected' : ''}
                onClick={() => setActive(index)}
                aria-label={`Ir para banner ${index + 1}`}
                aria-current={index === active ? 'true' : undefined}
              />
            ))}
          </div>
        )}
      </div>
      {slides.length > 1 && (
        <button type="button" className="banner-arrow next" onClick={() => move(1)} aria-label="Próximo banner">›</button>
      )}
    </section>
  );
}
