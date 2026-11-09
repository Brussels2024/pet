'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function CategoryMenu({ tree, activeId }) {
  const initiallyOpen = {};
  for (const parent of tree) {
    if (parent.id === activeId || parent.children.some((c) => c.id === activeId)) {
      initiallyOpen[parent.id] = true;
    }
  }
  const [open, setOpen] = useState(initiallyOpen);

  const toggle = (id) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside className="sidebar">
      <h3>Categorias</h3>
      <ul className="cat-list">
        <li>
          <div className={`cat-row${!activeId ? ' active' : ''}`}>
            <Link href="/">Todos os produtos</Link>
          </div>
        </li>
        {tree.map((cat) => (
          <li key={cat.id}>
            <div className={`cat-row${activeId === cat.id ? ' active' : ''}`}>
              <Link href={`/?cat=${cat.id}`}>{cat.name}</Link>
              {cat.children.length > 0 && (
                <button
                  type="button"
                  className={`arrow${open[cat.id] ? ' open' : ''}`}
                  onClick={() => toggle(cat.id)}
                  aria-label={open[cat.id] ? `Recolher ${cat.name}` : `Expandir ${cat.name}`}
                  aria-expanded={!!open[cat.id]}
                >
                  ▶
                </button>
              )}
            </div>
            {open[cat.id] && cat.children.length > 0 && (
              <ul className="sub-list">
                {cat.children.map((sub) => (
                  <li key={sub.id}>
                    <div className={`cat-row${activeId === sub.id ? ' active' : ''}`}>
                      <Link href={`/?cat=${sub.id}`}>{sub.name}</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
