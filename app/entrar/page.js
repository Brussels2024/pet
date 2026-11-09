import Link from 'next/link';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default async function EntrarPage({ searchParams }) {
  const sp = await searchParams;
  const next = typeof sp?.next === 'string' ? sp.next : '/';

  return (
    <div className="wrap page">
      <div className="auth-box card">
        <h1>Entrar</h1>
        <LoginForm next={next} />
        <p className="center muted" style={{ marginTop: 16 }}>
          Ainda não tem conta? <Link href="/cadastro"><b>Cadastre sua empresa</b></Link>
        </p>
      </div>
    </div>
  );
}
