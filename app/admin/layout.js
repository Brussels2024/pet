import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Painel administrativo — Brussels Pet',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }) {
  const user = await getUser();
  if (!user || user.role !== 'admin') redirect('/admin-login');

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
          <form action="/api/logout" method="post">
            <button type="submit" className="link-btn">Sair</button>
          </form>
        </div>
      </nav>
      <div className="wrap page">{children}</div>
    </>
  );
}
