import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Painel',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }) {
  await requireAdmin();

  return (
    <>
      <nav className="admin-nav">
        <div className="wrap">
          <Link href="/admin">Painel</Link>
          <Link href="/admin/clientes">Clientes</Link>
          <Link href="/admin/produtos">Produtos e estoque</Link>
          <Link href="/admin/banners">Banners</Link>
          <Link href="/admin/pedidos">Pedidos</Link>
          <Link href="/admin/configuracoes">Configurações</Link>
        </div>
      </nav>
      <div className="wrap page">{children}</div>
    </>
  );
}
