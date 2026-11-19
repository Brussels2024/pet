import BlobMigrationTool from '@/components/BlobMigrationTool';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Migração de imagens — Brussels Pet', robots: { index: false, follow: false } };

export default function BlobMigrationPage() {
  return (
    <>
      <p className="muted">Painel administrativo / Migração de imagens</p>
      <h1>Migração de imagens para o Blob</h1>
      <p className="muted">Ferramenta temporária de conferência e migração. A conexão com Neon e o token do Blob permanecem somente no servidor.</p>
      <BlobMigrationTool />
    </>
  );
}
