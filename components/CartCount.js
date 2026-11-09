'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function CartCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const read = () => {
      try {
        const cart = JSON.parse(localStorage.getItem('bp_cart') || '[]');
        setCount(cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0));
      } catch {
        setCount(0);
      }
    };
    read();
    window.addEventListener('cart-changed', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('cart-changed', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  return (
    <Link href="/carrinho">
      Carrinho{count > 0 && <span className="badge">{count}</span>}
    </Link>
  );
}
