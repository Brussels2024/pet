import Link from 'next/link';
import ImportarCategoriasSkuClient from './ImportarCategoriasSkuClient';

export const dynamic = 'force-dynamic';

export default function ImportarCategoriasSkuPage() {
  return (
    <>
      <div className="row-actions" style={{ marginBottom: 16 }}>
        <Link className="btn outline" href="/admin/produtos">Voltar para produtos</Link>
      </div>
      <h1>Importar categorias por SKU</h1>
      <ImportarCategoriasSkuClient />
    </>
  );
}
