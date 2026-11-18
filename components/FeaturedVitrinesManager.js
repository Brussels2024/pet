'use client';

import { useState } from 'react';
import { saveFeaturedCollection } from '@/app/admin/actions';

export default function FeaturedVitrinesManager({ collections, products, assignments }) {
  const [selectedId, setSelectedId] = useState(collections[0]?.id ?? null);
  const selectedCollection = collections.find((item) => item.id === selectedId) || null;
  const selectedIds = assignments.filter((item) => item.collection_id === selectedId).map((item) => item.product_id);
  const selectedSet = new Set(selectedIds);

  return (
    <>
      <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Categorias disponíveis para vitrines</h2>
        <p className="muted">As categorias vêm diretamente do cadastro existente. Selecione uma para escolher os produtos e definir se ela aparece na loja. Marcar ou salvar uma categoria não altera as demais.</p>
        {collections.length === 0 ? (
          <p className="muted">Ainda não há categorias cadastradas no sistema.</p>
        ) : (
          <div className="featured-vitrine-options">
            {collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                className={'featured-vitrine-option' + (selectedId === collection.id ? ' selected' : '')}
                onClick={() => setSelectedId(selectedId === collection.id ? null : collection.id)}
                aria-pressed={selectedId === collection.id}
              >
                <span className="featured-vitrine-check">{collection.active ? '✓' : ''}</span>
                <span>{collection.title}</span>
                <small>{collection.active ? 'Na vitrine' : 'Oculta'}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedCollection && (
        <section className="card" key={selectedCollection.id}>
          <form action={saveFeaturedCollection}>
            <input type="hidden" name="id" value={selectedCollection.id} />
            <input type="hidden" name="title" value={selectedCollection.title} />
            <div className="featured-vitrine-heading">
              <div>
                <h2 style={{ margin: 0 }}>Produtos da categoria: {selectedCollection.title}</h2>
                <p className="muted">Escolha os produtos desta vitrine. O mesmo produto pode aparecer em outras categorias também.</p>
              </div>
              <label className="featured-vitrine-active"><input type="checkbox" name="active" defaultChecked={selectedCollection.active} /> Exibir esta categoria na loja</label>
            </div>
            <div className="line-product-picker">
              {products.map((product) => (
                <label className="line-product-option" key={product.id}>
                  <input type="checkbox" name="product_ids" value={product.id} defaultChecked={selectedSet.has(product.id)} />
                  {product.image_url ? <img src={product.image_url} alt="" /> : <span className="line-product-no-image">Foto</span>}
                  <span><b>{product.name}</b>{product.sku && <small>Cód. {product.sku}</small>}</span>
                </label>
              ))}
            </div>
            <div className="row-actions" style={{ marginTop: 16 }}>
              <button className="btn" type="submit">Salvar categoria {selectedCollection.title}</button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
