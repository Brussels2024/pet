import Link from 'next/link';
import CadastroForm from '@/components/CadastroForm';

export const dynamic = 'force-dynamic';

export default function CadastroPage() {
  return (
    <div className="wrap page">
      <div className="auth-box wide card">
        <h1>Cadastro empresarial</h1>
        <p className="muted">
          Informe o CNPJ da sua empresa. Se a situação cadastral estiver ativa, sua conta é liberada na hora
          e os preços ficam visíveis.
        </p>
        <CadastroForm />
        <p className="center muted" style={{ marginTop: 16 }}>
          Já tem conta? <Link href="/entrar"><b>Entrar</b></Link>
        </p>
      </div>
    </div>
  );
}
