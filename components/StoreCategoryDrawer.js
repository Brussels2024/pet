'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function StoreCategoryDrawer({ tree = [] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState({});
  return (
    <div className="store-menu">
      <button className="store-menu-trigger" type="button" aria-label="Abrir menu de categorias" aria-expanded={open} onClick={() => setOpen(true)}><span></span><span></span><span></span></button>
      {open && <button type="button" className="store-menu-backdrop" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
      <aside className={'store-drawer' + (open ? ' is-open' : '')} aria-hidden={!open}>
        <div className="store-drawer-head"><strong>☰ MENU</strong><button type="button" aria-label="Fechar menu" onClick={() => setOpen(false)}>×</button></div>
        <div className="store-drawer-account"><Link href="/entrar" onClick={() => setOpen(false)}>Entrar / Minha conta</Link><Link href="/cadastro" onClick={() => setOpen(false)}>Cadastrar empresa</Link></div>
        <div className="store-drawer-list"><Link className="store-drawer-all" href="/" onClick={() => setOpen(false)}>☰ Todas as categorias</Link>
          {tree.map((cat) => <div className="store-drawer-category" key={cat.id}>
            <div className="store-drawer-category-row"><Link href={'/?cat=' + cat.id} onClick={() => setOpen(false)}>{cat.name}</Link>
              {cat.children.length > 0 && <button type="button" aria-label={'Abrir subcategorias de ' + cat.name} aria-expanded={!!expanded[cat.id]} onClick={() => setExpanded((v) => ({ ...v, [cat.id]: !v[cat.id] }))}>{expanded[cat.id] ? '⌃' : '⌄'}</button>}
            </div>
            {expanded[cat.id] && <div className="store-drawer-sub">{cat.children.map((sub) => <Link key={sub.id} href={'/?cat=' + sub.id} onClick={() => setOpen(false)}>{sub.name}</Link>)}</div>}
          </div>)}
        </div>
      </aside>
    </div>
  );
}
