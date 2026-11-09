import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Acesso restrito',
  robots: { index: false, follow: false },
};

// Endereço secreto do administrador. Não existe link para ele em nenhuma página do site.
export default async function AcessoRestritoPage() {
  const user = await getUser();
  if (user && user.role === 'admin') redirect('/admin');

  return (
    <div className="wrap page">
      <div className="auth-box card">
        <h1>Acesso restrito</h1>
        <LoginForm scope="admin" />
      </div>
    </div>
  );
}
