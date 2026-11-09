import Link from 'next/link';
import { getUser } from '@/lib/auth';
import CartCount from './CartCount';
import Logo from './Logo';

export default async function Header() {
  let user = null;
  try {
    user = await getUser();
  } catch {
    user = null;
  }

  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link href="/" className="logo-link" aria-label="Brussels Pet — página inicial">
          <Logo />
        </Link>

        <form action="/" method="get" className="search">
          <input name="q" placeholder="Buscar produtos..." aria-label="Buscar produtos" />
          <button type="submit">Buscar</button>
        </form>

        <nav className="nav">
          <CartCount />
          {user ? (
            <>
              {user.role === 'admin' && <Link href="/admin">Admin</Link>}
              <Link href="/conta">Minha conta</Link>
              <form action="/api/logout" method="post">
                <button type="submit" className="link-btn">Sair</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/entrar">Entrar</Link>
              <Link href="/cadastro" className="btn small">Cadastrar empresa</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
