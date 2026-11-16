import Link from 'next/link';
import ImportarSkuPrecoClient from './ImportarSkuPrecoClient';

export const dynamic = 'force-dynamic';

export default function ImportarSkuPrecosPage() {
  return (
    <>
      <div className="row-actions" style={{ marginBottom: 16 }}>
        <Link className="btn outline" href="/admin/produtos">Voltar para produtos</Link>
      </div>
      <h1>Importar catálogo completo</h1>
      <ImportarSkuPrecoClient />
    </>
  );
}
