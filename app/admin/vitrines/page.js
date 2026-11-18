import { query } from '@/lib/db';
import FeaturedVitrinesManager from '@/components/FeaturedVitrinesManager';

export const dynamic = 'force-dynamic';

export default async function FeaturedCollectionsPage() {
  const [collections, products, assignments] = await Promise.all([
    query('SELECT id, title, active, position FROM featured_collections WHERE category_id IS NULL ORDER BY position, id'),
    query('SELECT id, name, sku, image_url FROM products WHERE active = true ORDER BY name'),
    query('SELECT fcp.collection_id, fcp.product_id FROM featured_collection_products fcp JOIN featured_collections fc ON fc.id = fcp.collection_id WHERE fc.category_id IS NULL'),
  ]);

  return (
    <>
      <h1>Vitrines por linha</h1>
      <p className="muted">Crie suas linhas de vitrine e escolha separadamente quais produtos aparecem em cada uma. Salvar uma vitrine não altera as outras.</p>
      <FeaturedVitrinesManager collections={collections} products={products} assignments={assignments} />
    </>
  );
}
