'use client';

import { useState } from 'react';
import { createFeaturedCollection, saveFeaturedCollection } from '../actions';

export default function FeaturedVitrinesManager({ collections, products, assignments }) {
  const [selectedId, setSelectedId] = useState(collections[0]?.id ?? null);
  const selectedCollection = collections.find((item) => item.id === selectedId) || null;
  const selectedIds = assignments.filter((item) => item.collection_id === selectedId).map((item) => item.product_id);
  const selectedSet = new Set(selectedIds);

  return (
    <>
      <section className="card" style={{ marginBottom: 18 }}>
        <form action={createFeaturedCollection} className="inline-form">
          <input name="title" type="text" maxLength={80} placeholder="Nome da nova linha (ex.: Neon, Brinquedos)" required />
          <button className="btn" type="submit">Criar vitrine</button>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Escolha a vitrine</h2>
        <p className="muted">Clique em uma vitrine que você já criou. Depois marque os produtos que devem aparecer nela.</p>
        {collections.length === 0 ? (
          <p className="muted">Nenhuma vitrine criada ainda. Digite um nome acima e clique em “Criar vitrine”.</p>
        ) : (
          <div className="featured-vitrine-options">
            {collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                className={'featured-vitrine-option' + (selectedId === collection.id ? ' selected' : '')}
                onClick={() => setSelectedId(collection.id)}
                aria-pressed={selectedId === collection.id}
              >
                <span className="featured-vitrine-check">{selectedId === collection.id ? '✓' : ''}</span>
                <span>{collection.title}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedCollection && (
        <section className="card">
          <form action={saveFeaturedCollection}>
            <input type="hidden" name="id" value={selectedCollection.id} />
            <input type="hidden" name="title" value={selectedCollection.title} />
            <div className="featured-vitrine-heading">
              <div>
                <h2 style={{ margin: 0 }}>Produtos da vitrine: {selectedCollection.title}</h2>
                <p className="muted">Marque produto por produto. Um mesmo produto pode participar de outras vitrines também.</p>
              </div>
              <label className="featured-vitrine-active"><input type="checkbox" name="active" defaultChecked={selectedCollection.active} /> Exibir na loja</label>
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
              <button className="btn" type="submit">Salvar vitrine {selectedCollection.title}</button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
