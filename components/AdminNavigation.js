'use client';
import Link from 'next/link';
import { useState } from 'react';
import AdminNotifications from '@/components/AdminNotifications';

export default function AdminNavigation() {
  const [open, setOpen] = useState(false);
  return <nav className={'admin-nav' + (open ? ' menu-open' : '')}>
    <div className="wrap admin-nav-inner">
      <button type="button" className="admin-menu-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}><span>☰</span> Menu administrativo</button>
      <div className="admin-nav-links">
        <Link href="/admin" onClick={() => setOpen(false)}>Painel</Link>
        <Link href="/admin/clientes" onClick={() => setOpen(false)}>Clientes</Link>
        <Link href="/admin/produtos" onClick={() => setOpen(false)}>Produtos e estoque</Link>
        <Link href="/admin/banners" onClick={() => setOpen(false)}>Banners</Link>
        <Link href="/admin/pedidos" onClick={() => setOpen(false)}>Pedidos</Link>
        <Link href="/admin/configuracoes" onClick={() => setOpen(false)}>Configurações</Link>
        <AdminNotifications />
        <form action="/api/logout" method="post"><button type="submit" className="link-btn">Sair</button></form>
      </div>
    </div>
  </nav>;
}
