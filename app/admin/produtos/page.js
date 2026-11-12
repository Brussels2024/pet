import Link from 'next/link';
import { query } from '@/lib/db';
import { brl } from '@/lib/format';
import { setStock } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ProdutosPage({ searchParams }) {
  const sp = await searchParams;
  const q = String(sp?.q || '').trim();

  const params = [];
  let where = '';
  if (q) {
    params.push(`%${q}%`);
    where = 'WHERE p.name ILIKE $1 OR p.sku ILIKE $1';
  }

  const products = await query(
    `SELECT p.id, p.name, p.sku, p.price, p.stock, p.active, p.image_url, p.priority, c.name AS category
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.name
       LIMIT 300`,
    params
  );

  return (
    <>
      <h1>Produtos e estoque</h1>
      <div className="inline-form" style={{ marginBottom: 16 }}>
        <Link className="btn" href="/admin/produtos/novo">Novo produto</Link>
        <Link className="btn outline" href="/admin/importar-catalogo">Importar catálogo ZIP</Link>
        <form action="/admin/produtos" method="get" className="inline-form">
          <input name="q" defaultValue={q} placeholder="Buscar por nome ou código" />
          <button className="btn outline" type="submit">Buscar</button>
        </form>
      </div>

      {products.length === 0 ? (
        <p className="muted">Nenhum produto cadastrado.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Foto</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Preço</th>
                <th>Estoque</th>
                <th>Destaque</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td style={{ width: 64 }}>
                    {p.image_url ? (
                      <img src={p.image_url} alt="" width={48} height={48} style={{ objectFit: 'cover', borderRadius: 6 }} />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <b>{p.name}</b>
                    {p.sku && <div className="muted">Cód. {p.sku}</div>}
                  </td>
                  <td>{p.category || <span className="muted">Sem categoria</span>}</td>
                  <td>{brl(p.price)}</td>
                  <td>
                    <form action={setStock} className="inline-form">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="stock" type="number" min="0" defaultValue={p.stock} style={{ width: 90 }} />
                      <button className="btn small outline" type="submit">Salvar</button>
                    </form>
                  </td>
                  <td>{p.priority ? <span className="tag product-featured-tag">Prioritário</span> : <span className="muted">—</span>}</td>
                  <td>{p.active ? <span className="tag ativo">Ativo</span> : <span className="tag">Oculto</span>}</td>
                  <td><Link className="btn small" href={`/admin/produtos/${p.id}`}>Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
