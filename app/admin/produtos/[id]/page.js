import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { saveProduct } from '../../actions';
import ImagePicker from '@/components/ImagePicker';

export const dynamic = 'force-dynamic';

export default async function ProdutoFormPage({ params }) {
  const { id } = await params;
  const isNew = id === 'novo';

  let product = {
    id: '',
    name: '',
    description: '',
    sku: '',
    price: '',
    stock: 0,
    image_url: '',
    category_id: '',
    active: true,
  };

  if (!isNew) {
    const rows = await query('SELECT * FROM products WHERE id = $1', [Number(id) || 0]);
    if (!rows.length) notFound();
    product = rows[0];
  }

  const cats = await query('SELECT id, name, parent_id FROM categories ORDER BY position, name, id');
  const parents = cats.filter((c) => !c.parent_id);
  const options = [];
  for (const parent of parents) {
    options.push({ id: parent.id, label: parent.name });
    for (const sub of cats.filter((c) => c.parent_id === parent.id)) {
      options.push({ id: sub.id, label: `${parent.name} › ${sub.name}` });
    }
  }

  return (
    <>
      <h1>{isNew ? 'Novo produto' : 'Editar produto'}</h1>
      <form action={saveProduct} className="card" style={{ maxWidth: 720 }}>
        <input type="hidden" name="id" value={product.id} />

        <div className="field">
          <label htmlFor="name">Nome</label>
          <input id="name" name="name" defaultValue={product.name} required />
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="sku">Código (SKU)</label>
            <input id="sku" name="sku" defaultValue={product.sku || ''} />
          </div>
          <div className="field">
            <label htmlFor="category_id">Categoria / subcategoria</label>
            <select id="category_id" name="category_id" defaultValue={product.category_id || ''}>
              <option value="">Sem categoria</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="price">Preço (R$)</label>
            <input id="price" name="price" inputMode="decimal" defaultValue={product.price === '' ? '' : Number(product.price).toFixed(2)} required />
          </div>
          <div className="field">
            <label htmlFor="stock">Estoque</label>
            <input id="stock" name="stock" type="number" min="0" defaultValue={product.stock} required />
          </div>
        </div>
        <div className="field">
          <ImagePicker name="image_url" initialValue={product.image_url || ''} label="Foto do produto" />
        </div>
        <div className="field">
          <label htmlFor="description">Descrição</label>
          <textarea id="description" name="description" rows={4} defaultValue={product.description || ''} />
        </div>
        <div className="field">
          <label>
            <input type="checkbox" name="active" defaultChecked={product.active} /> Visível na loja
          </label>
        </div>

        <div className="row-actions">
          <button className="btn" type="submit">Salvar produto</button>
          <Link className="btn outline" href="/admin/produtos">Cancelar</Link>
        </div>
      </form>
    </>
  );
}
