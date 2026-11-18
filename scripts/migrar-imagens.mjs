import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

const dryRun = process.argv.includes('--dry-run');
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error('ERRO: configure DATABASE_URL (ou POSTGRES_URL) antes de executar.');
  process.exit(1);
}
if (!dryRun && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('ERRO: configure BLOB_READ_WRITE_TOKEN antes de executar a migração.');
  process.exit(1);
}

const sql = neon(databaseUrl);
const tables = [
  { name: 'products', select: "SELECT id, image_url FROM products WHERE image_url LIKE 'data:image/%' ORDER BY id", drySelect: "SELECT id, length(image_url) AS image_length FROM products WHERE image_url LIKE 'data:image/%' ORDER BY id" },
  { name: 'product_images', select: "SELECT id, image_url FROM product_images WHERE image_url LIKE 'data:image/%' ORDER BY id", drySelect: "SELECT id, length(image_url) AS image_length FROM product_images WHERE image_url LIKE 'data:image/%' ORDER BY id" },
  { name: 'banners', select: "SELECT id, image_url FROM banners WHERE image_url LIKE 'data:image/%' ORDER BY id", drySelect: "SELECT id, length(image_url) AS image_length FROM banners WHERE image_url LIKE 'data:image/%' ORDER BY id" },
];

const extensions = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
};

let migrated = 0;
let failed = 0;
let total = 0;
const uploadedByHash = new Map();

function decodeDataUrl(value) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(value || '');
  if (!match) throw new Error('Formato data URL não reconhecido ou não está em base64.');
  const mimeType = match[1].toLowerCase();
  const extension = extensions[mimeType];
  if (!extension) throw new Error(`Formato antigo não suportado: ${mimeType}`);
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new Error('Imagem vazia ou base64 inválido.');
  if (buffer.length > 5 * 1024 * 1024) throw new Error('Imagem antiga excede o limite de segurança de 5 MB.');
  return { buffer, mimeType, extension };
}

async function migrateOne(table, row) {
  try {
    const { buffer, mimeType, extension } = decodeDataUrl(row.image_url);
    if (dryRun) {
      console.log(`[DRY-RUN] ${table.name} #${row.id}: migraria ${buffer.length} bytes (${mimeType}).`);
      return;
    }

    // O hash cria um caminho estável e compartilhado por imagens idênticas.
    // Se a execução parar antes de atualizar o Neon, a próxima execução reutiliza o mesmo objeto.
    const digest = createHash('sha256').update(buffer).digest('hex');
    let blobUrl = uploadedByHash.get(digest);
    if (!blobUrl) {
      const pathname = `migracao-legado/${digest}.${extension}`;
      const blob = await put(pathname, buffer, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: mimeType,
        cacheControlMaxAge: 31536000,
      });

      const verification = await fetch(blob.url, { method: 'GET', cache: 'no-store' });
      if (verification.status !== 200) {
        await verification.body?.cancel();
        throw new Error(`A nova URL respondeu HTTP ${verification.status}, não 200.`);
      }
      await verification.body?.cancel();
      blobUrl = blob.url;
      uploadedByHash.set(digest, blobUrl);
    }

    // Atualiza somente se a imagem ainda for exatamente a original lida.
    // Isso evita sobrescrever uma edição feita por alguém durante a migração.
    const updated = await sql.query(
      `UPDATE ${table.name} SET image_url = $1 WHERE id = $2 AND image_url = $3 RETURNING id`,
      [blobUrl, row.id, row.image_url]
    );
    if (!updated.length) throw new Error('O registro mudou durante a migração; o banco foi preservado.');

    migrated++;
    console.log(`[OK] ${table.name} #${row.id} migrada e verificada.`);
  } catch (error) {
    failed++;
    console.error(`[FALHOU] ${table.name} #${row.id}: ${error?.message || error}`);
  }
}

async function main() {
  console.log(dryRun ? 'Modo DRY-RUN: nenhuma imagem será enviada ou alterada.' : 'Iniciando migração de imagens para o Vercel Blob.');
  for (const table of tables) {
    const rows = await sql.query(dryRun ? table.drySelect : table.select);
    total += rows.length;
    console.log(`\n${table.name}: ${rows.length} imagem(ns) antiga(s) encontrada(s).`);
    if (dryRun) {
      for (const row of rows) console.log(`[DRY-RUN] ${table.name} #${row.id}: imagem com ${row.image_length} caracteres; nenhuma alteração será feita.`);
    } else {
      for (const row of rows) await migrateOne(table, row);
    }
  }

  console.log('\n========== RELATÓRIO ==========');
  console.log(`Encontradas: ${total}`);
  console.log(dryRun ? `A migrar (simulação): ${total - failed}` : `Migradas: ${migrated}`);
  console.log(`Falharam: ${failed}`);
  console.log('As imagens originais que não foram migradas permanecem no banco.');
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error('ERRO GERAL:', error?.message || error);
  process.exitCode = 1;
});
