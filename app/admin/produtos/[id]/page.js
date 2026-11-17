import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { saveProduct } from '../../actions';
import ImagePicker from '@/components/ImagePicker';
import ProductVariantEditor from '@/components/ProductVariantEditor';

export const dynamic = 'force-dynamic';

export default async function ProdutoFormPage({ params }) {
  const { id } = await params;
  const isNew = id === 'novo';
  let product = { id: '', name: '', description: '', sku: '', price: '', stock: 0, image_url: '', category_id: '', active: true, priority: false, colors: [] };
  let imageValues = [];
  let selectedCategoryIds = [];

  if (!isNew) {
    const rows = await query('SELECT * FROM products WHERE id = $1', [Number(id) || 0]);
    if (!rows.length) notFound();
    product = rows[0];
    const [savedImages, relations] = await Promise.all([
      query('SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY position LIMIT 6', [Number(id)]),
      query('SELECT category_id FROM product_categories WHERE product_id = $1 ORDER BY category_id', [Number(id)]),
    ]);
    imageValues = savedImages.map((image) => image.image_url);
    if (!imageValues.length && product.image_url) imageValues = [product.image_url];
    selectedCategoryIds = relations.map((row) => Number(row.category_id));
    if (!selectedCategoryIds.length && product.category_id) selectedCategoryIds = [Number(product.category_id)];
  }
  while (imageValues.length < 6) imageValues.push('');

  const cats = await query('SELECT id, name, parent_id FROM categories ORDER BY position, name, id');
  const parents = cats.filter((c) => !c.parent_id);
  const options = [];
  for (const parent of parents) {
    options.push({ id: parent.id, label: parent.name });
    for (const sub of cats.filter((c) => c.parent_id === parent.id)) options.push({ id: sub.id, label: parent.name + ' › ' + sub.name });
  }

  return (
    <>
      <h1>{isNew ? 'Novo produto' : 'Editar produto'}</h1>
      <form action={saveProduct} className="card" style={{ maxWidth: 720 }}>
        <input type="hidden" name="id" value={product.id} />
        <div className="field"><label htmlFor="name">Nome</label><input id="name" name="name" defaultValue={product.name} required /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="sku">Código (SKU) principal</label><input id="sku" name="sku" defaultValue={product.sku || ''} /></div>
          <div className="field"><label htmlFor="price">Preço (R$)</label><input id="price" name="price" inputMode="decimal" defaultValue={product.price === '' ? '' : Number(product.price).toFixed(2)} required /></div>
        </div>
        <div className="field">
          <label>Categorias do produto</label>
          <p className="muted">Você pode selecionar quantas categorias quiser para o mesmo anúncio.</p>
          <div className="line-product-picker">
            {options.map((option) => <label className="line-product-option" key={option.id}>
              <input type="checkbox" name="category_ids" value={option.id} defaultChecked={selectedCategoryIds.includes(Number(option.id))} />
              <span>{option.label}</span>
            </label>)}
          </div>
        </div>
        <div className="grid2">
          <div className="field"><label htmlFor="stock">Estoque</label><input id="stock" name="stock" type="number" min="0" defaultValue={product.stock} required /></div>
        </div>
        <div className="field">
          <label>Fotos do produto (até 6)</label>
          <p className="muted">A primeira foto será a capa. As demais aparecem na galeria do anúncio. Você pode deixar os espaços vazios.</p>
          <div className="product-image-pickers">
            {imageValues.map((image, index) => <ImagePicker
              key={index}
              name={index === 0 ? 'image_url' : 'product_image_' + (index + 1)}
              initialValue={image}
              label={'Foto ' + (index + 1) + (index === 0 ? ' — capa' : '')}
            />)}
          </div>
        </div>
        <ProductVariantEditor initialColors={product.colors || []} baseSku={product.sku || ''} />
        <div className="field"><label htmlFor="description">Descrição</label><textarea id="description" name="description" rows={4} defaultValue={product.description || ''} /></div>
        <div className="field"><label><input type="checkbox" name="priority" defaultChecked={product.priority === true} /> Priorizar anúncio (destaque na loja)</label></div>
        <div className="field"><label><input type="checkbox" name="active" defaultChecked={product.active} /> Visível na loja</label></div>
        <div className="row-actions"><button className="btn" type="submit">Salvar produto</button><Link className="btn outline" href="/admin/produtos">Cancelar</Link></div>
      </form>
    </>
  );
}
