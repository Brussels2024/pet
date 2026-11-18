import { query } from '@/lib/db';
import FeaturedVitrinesManager from '../../../components/FeaturedVitrinesManager';

export const dynamic = 'force-dynamic';

export default async function FeaturedCollectionsPage() {
  // Sincroniza somente a tabela de vitrines com as categorias já cadastradas.
  // Nenhum dado da tabela categories é criado, alterado ou removido aqui.
  const categories = await query(
    'SELECT id, name, position FROM categories ORDER BY position, name, id'
  );

  for (const category of categories) {
    await query(
      `INSERT INTO featured_collections (title, position, active, category_id)
       VALUES ($1, $2, false, $3)
       ON CONFLICT (category_id) WHERE category_id IS NOT NULL
       DO UPDATE SET title = EXCLUDED.title, position = EXCLUDED.position`,
      [category.name, category.position, category.id]
    );
  }

  const [collections, products, assignments] = await Promise.all([
    query(
      `SELECT fc.id, c.name AS title, fc.active, fc.position
         FROM featured_collections fc
         JOIN categories c ON c.id = fc.category_id
        ORDER BY c.position, c.name, c.id`
    ),
    query('SELECT id, name, sku, image_url FROM products WHERE active = true ORDER BY name'),
    query(
      `SELECT fcp.collection_id, fcp.product_id
         FROM featured_collection_products fcp
         JOIN featured_collections fc ON fc.id = fcp.collection_id
        WHERE fc.category_id IS NOT NULL`
    ),
  ]);

  return (
    <>
      <h1>Vitrines por linha</h1>
      <p className="muted">As vitrines usam as categorias já cadastradas. Escolha quais aparecem na loja e quais produtos ficam em cada uma.</p>
      <FeaturedVitrinesManager collections={collections} products={products} assignments={assignments} />
    </>
  );
}
