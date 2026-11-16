import Link from 'next/link';
import { getUser, getAdminUser } from '@/lib/auth';
import { query } from '@/lib/db';
import CartCount from './CartCount';
import Logo from './Logo';
import StoreCategoryDrawer from './StoreCategoryDrawer';
import LogoutButton from './LogoutButton';

export default async function Header() {
  let user = null;
  let adminUser = null;
  let tree = [];
  try {
    user = await getUser();
    adminUser = await getAdminUser();
    const cats = await query('SELECT id, name, parent_id FROM categories WHERE active = true ORDER BY position, name, id');
    tree = cats.filter((c) => !c.parent_id).map((parent) => ({ id: parent.id, name: parent.name, children: cats.filter((c) => c.parent_id === parent.id).map((c) => ({ id: c.id, name: c.name })) }));
  } catch { user = null; }
  return (
    <header className="site-header"><div className="wrap header-inner">
      <StoreCategoryDrawer tree={tree} />
      <Link href="/" className="logo-link" aria-label="Brussels Pet — página inicial"><Logo /></Link>
      <form action="/" method="get" className="search"><input name="q" placeholder="Buscar produtos..." aria-label="Buscar produtos" /><button type="submit">Buscar</button></form>
      <nav className="nav"><CartCount />
        {user ? <><Link href="/conta">Minha conta</Link><LogoutButton /></> : <><Link href="/entrar">Entrar</Link><Link href="/cadastro" className="btn small">Cadastrar empresa</Link></>}
      </nav>
    </div></header>
  );
}
