import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png']);
const EXTENSIONS = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export async function POST(request) {
  await requireAdmin();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'O armazenamento de imagens ainda não está configurado. Adicione BLOB_READ_WRITE_TOKEN na Vercel e tente novamente.' },
      { status: 503 }
    );
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_FILE_SIZE + 64 * 1024) {
    return NextResponse.json({ error: 'A imagem excede o tamanho máximo permitido de 2 MB.' }, { status: 413 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Não foi possível receber o arquivo enviado.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Selecione uma imagem para enviar.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Formato não permitido. Envie uma imagem WebP, JPEG ou PNG.' }, { status: 415 });
  }
  if (file.size < 1 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'A imagem deve ter no máximo 2 MB.' }, { status: 413 });
  }

  try {
    const extension = EXTENSIONS[file.type];
    const blob = await put(
      `produtos-banners/${Date.now()}-${randomUUID()}.${extension}`,
      file,
      {
        access: 'public',
        addRandomSuffix: true,
        contentType: file.type,
        cacheControlMaxAge: 31536000,
      }
    );

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('Falha no upload de imagem para o Blob:', error);
    return NextResponse.json(
      { error: 'Não foi possível salvar a imagem no armazenamento. Confira a configuração do Blob e tente novamente.' },
      { status: 500 }
    );
  }
}
