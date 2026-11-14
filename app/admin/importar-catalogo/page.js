import Link from 'next/link';
import ImportarCatalogoClient from './ImportarCatalogoClient';

export const dynamic = 'force-dynamic';

export default function ImportarCatalogoPage() {
  return (
    <>
      <div className="row-actions" style={{ marginBottom: 16 }}>
        <Link className="btn outline" href="/admin/produtos">Voltar para produtos</Link>
      </div>
      <h1>Importação inicial do catálogo</h1>
      <ImportarCatalogoClient />
    </>
  );
}