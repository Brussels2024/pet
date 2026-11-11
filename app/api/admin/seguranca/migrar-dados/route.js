import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { decryptPii, encryptPii, ensurePiiSchema, phoneLookupHash, piiFields, encryptOrderAddress } from '@/lib/pii';

export const dynamic = 'force-dynamic';

export async function POST() {
  await requireAdmin();
  await ensurePiiSchema();

  // A migration só começa com a chave configurada e valida.
  encryptPii('verificacao');
  const fields = piiFields();
  let usersMigrated = 0;
  let ordersMigrated = 0;

  for (let batch = 0; batch < 10; batch++) {
    const rows = await query(
      `SELECT id, ${fields.join(', ')}, ${fields.map((field) => field + '_enc').join(', ')}, telefone_lookup_hash
       FROM users
       WHERE ${fields.map((field) => `(${field} IS NOT NULL AND ${field}_enc IS NULL)`).join(' OR ')}
          OR (telefone IS NOT NULL AND telefone_lookup_hash IS NULL)
       ORDER BY id LIMIT 100`
    );
    if (!rows.length) break;

    for (const row of rows) {
      const values = fields.map((field) => row[field + '_enc'] || encryptPii(row[field]));
      const lookup = row.telefone_lookup_hash || phoneLookupHash(row.telefone);
      const assignments = fields.map((field, index) => `${field}_enc = COALESCE(${field}_enc, $${index + 2})`).join(', ');
      const clearFields = fields.map((field) => `${field} = NULL`).join(', ');
      await query(
        `UPDATE users SET ${assignments}, telefone_lookup_hash = COALESCE(telefone_lookup_hash, $${fields.length + 2}), ${clearFields} WHERE id = $1`,
        [row.id, ...values, lookup]
      );
      usersMigrated++;
    }
  }

  for (let batch = 0; batch < 10; batch++) {
    const rows = await query(
      'SELECT id, shipping_address FROM orders WHERE shipping_address IS NOT NULL AND shipping_address_enc IS NULL ORDER BY id LIMIT 100'
    );
    if (!rows.length) break;
    for (const row of rows) {
      const address = typeof row.shipping_address === 'string' ? JSON.parse(row.shipping_address) : row.shipping_address;
      await query(
        'UPDATE orders SET shipping_address_enc = $1, shipping_address = NULL WHERE id = $2 AND shipping_address_enc IS NULL',
        [encryptOrderAddress(address), row.id]
      );
      ordersMigrated++;
    }
  }

  const pending = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM users WHERE ${fields.map((field) => `${field} IS NOT NULL`).join(' OR ')}) AS users_pending,
       (SELECT COUNT(*)::int FROM orders WHERE shipping_address IS NOT NULL) AS orders_pending`
  );
  return NextResponse.json({
    ok: true,
    usersMigrated,
    ordersMigrated,
    usersPending: Number(pending[0]?.users_pending || 0),
    ordersPending: Number(pending[0]?.orders_pending || 0),
    message: 'Migração em lotes concluída. Execute novamente se ainda houver registros pendentes.',
  });
}
