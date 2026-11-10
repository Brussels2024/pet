import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Acesso administrativo — Brussels Pet',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="admin-login-page">
      <div className="auth-box card">
        <h1>Administrador Brussels Pet</h1>
        <p className="muted">Acesso restrito ao painel administrativo.</p>
        <LoginForm scope="admin" />
      </div>
    </div>
  );
}
