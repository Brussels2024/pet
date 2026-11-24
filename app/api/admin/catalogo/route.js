import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, PDFName, PDFString, rgb } from 'pdf-lib';
import sharp from 'sharp';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 30;
const GAP = 12;
const COLUMNS = 2;
const ROWS = 4;
const CARD_WIDTH = (PAGE_WIDTH - MARGIN * 2 - GAP) / COLUMNS;
const CARD_HEIGHT = (PAGE_HEIGHT - MARGIN * 2 - 58 - GAP * (ROWS - 1)) / ROWS;

function clean(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

function formatPrice(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

function absoluteProductUrl(id) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const origin = configured
    ? (configured.startsWith('http') ? configured : 'https://' + configured)
    : 'http://localhost:3000';
  return new URL('/produto/' + encodeURIComponent(id), origin).toString();
}

async function embedProductImage(pdf, imageUrl) {
  if (!imageUrl) return null;
  try {
    let bytes;
    let type = '';
    if (/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(imageUrl)) {
      const match = imageUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
      if (!match) return null;
      bytes = Buffer.from(match[2], 'base64');
      type = match[1].toLowerCase();
    } else if (/^https:\/\//i.test(imageUrl)) {
      const response = await fetch(imageUrl, { signal: AbortSignal.timeout(7000) });
      if (!response.ok) return null;
      type = (response.headers.get('content-type') || '').toLowerCase();
      if (!type.includes('image/png') && !type.includes('image/jpeg') && !type.includes('image/webp')) return null;
      const length = Number(response.headers.get('content-length') || 0);
      if (length > 5 * 1024 * 1024) return null;
      bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 5 * 1024 * 1024) return null;
    } else {
      return null;
    }
    if (bytes.length > 5 * 1024 * 1024) return null;
    if (type.includes('webp')) {
      bytes = await sharp(bytes).png().toBuffer();
      type = 'image/png';
    }
    return type.includes('png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

function addProductLink(page, pdf, x, y, width, height, url) {
  const context = pdf.context;
  const annotation = context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Link'),
    Rect: [x, y, x + width, y + height],
    Border: [0, 0, 0],
    A: { Type: PDFName.of('Action'), S: PDFName.of('URI'), URI: PDFString.of(url) },
  });
  page.node.addAnnot(context.register(annotation));
}

export async function GET() {
  await requireAdmin();

  const products = await query(
    `SELECT p.id, p.name, p.sku, p.price, p.min_quantity, p.image_url, p.colors,
            (SELECT pi.image_url FROM product_images pi
              WHERE pi.product_id = p.id ORDER BY pi.position ASC LIMIT 1) AS first_image
       FROM products p
      WHERE p.active = true
      ORDER BY p.name ASC, p.id ASC`
  );

  if (!products.length) {
    return NextResponse.json({ error: 'Não há produtos ativos para montar o catálogo.' }, { status: 404 });
  }

  const pdf = await PDFDocument.create();
  pdf.setTitle('Catálogo Brussels Pet');
  pdf.setAuthor('Brussels Pet');
  pdf.setSubject('Catálogo de produtos, SKUs, quantidade mínima, cores e preços');
  pdf.setCreator('Brussels Pet');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const totalPages = Math.ceil(products.length / (COLUMNS * ROWS));
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawText('BRUSSELS PET', {
      x: MARGIN, y: PAGE_HEIGHT - 38, size: 19, font: bold, color: rgb(0.12, 0.12, 0.12),
    });
    page.drawText('CATÁLOGO DE PRODUTOS', {
      x: MARGIN, y: PAGE_HEIGHT - 54, size: 8, font: regular, color: rgb(0.42, 0.42, 0.42),
    });
    page.drawText(`Página ${pageIndex + 1} de ${totalPages}`, {
      x: PAGE_WIDTH - MARGIN - 58, y: PAGE_HEIGHT - 42, size: 8, font: regular, color: rgb(0.42, 0.42, 0.42),
    });

    const batch = products.slice(pageIndex * COLUMNS * ROWS, (pageIndex + 1) * COLUMNS * ROWS);
    for (let index = 0; index < batch.length; index++) {
      const product = batch[index];
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const x = MARGIN + col * (CARD_WIDTH + GAP);
      const top = PAGE_HEIGHT - 68 - row * (CARD_HEIGHT + GAP);
      const y = top - CARD_HEIGHT;

      page.drawRectangle({
        x, y, width: CARD_WIDTH, height: CARD_HEIGHT,
        color: rgb(1, 1, 1), borderColor: rgb(0.88, 0.88, 0.88), borderWidth: 0.8,
      });

      const image = await embedProductImage(pdf, product.first_image || product.image_url);
      const imageX = x + 10;
      const imageY = y + 12;
      const imageW = 91;
      const imageH = CARD_HEIGHT - 24;
      if (image) {
        const scale = Math.min(imageW / image.width, imageH / image.height);
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        page.drawImage(image, {
          x: imageX + (imageW - drawW) / 2,
          y: imageY + (imageH - drawH) / 2,
          width: drawW, height: drawH,
        });
      } else {
        page.drawRectangle({ x: imageX, y: imageY, width: imageW, height: imageH, color: rgb(0.96, 0.96, 0.96) });
        page.drawText('FOTO', { x: imageX + 31, y: imageY + imageH / 2, size: 8, font: bold, color: rgb(0.55, 0.55, 0.55) });
      }

      const textX = x + 111;
      const textWidth = CARD_WIDTH - 121;
      const name = clean(product.name) || 'Produto';
      const nameLines = [];
      let remaining = name;
      while (remaining.length && nameLines.length < 2) {
        let cut = remaining.length;
        while (cut > 1 && bold.widthOfTextAtSize(remaining.slice(0, cut), 10) > textWidth) cut--;
        if (cut < remaining.length) {
          const space = remaining.lastIndexOf(' ', cut);
          if (space > 0) cut = space;
        }
        nameLines.push(remaining.slice(0, cut));
        remaining = remaining.slice(cut).trim();
      }
      let textY = top - 24;
      for (const line of nameLines) {
        page.drawText(line, { x: textX, y: textY, size: 10, font: bold, color: rgb(0.12, 0.12, 0.12) });
        textY -= 13;
      }
      if (remaining) {
        page.drawText('…', { x: textX, y: textY, size: 10, font: bold, color: rgb(0.12, 0.12, 0.12) });
        textY -= 13;
      }
      textY -= 5;

      const sku = clean(product.sku) || 'Não informado';
      page.drawText('SKU: ' + sku.slice(0, 30), {
        x: textX, y: textY, size: 7.5, font: regular, color: rgb(0.38, 0.38, 0.38),
      });
      textY -= 16;

      const minQuantity = Math.max(1, Math.floor(Number(product.min_quantity) || 1));
      page.drawText('Qtd. mínima: ' + minQuantity + ' un.', {
        x: textX, y: textY, size: 7.5, font: bold, color: rgb(0.3, 0.3, 0.3),
      });
      textY -= 15;

      let colors = [];
      try {
        const raw = Array.isArray(product.colors) ? product.colors : JSON.parse(product.colors || '[]');
        colors = raw.map((color) => clean(typeof color === 'string' ? color : color?.name)).filter(Boolean);
      } catch { colors = []; }
      const colorText = colors.length ? colors.join(', ') : 'Não informado';
      const colorLines = [];
      let colorRemaining = colorText;
      while (colorRemaining.length && colorLines.length < 3) {
        let cut = colorRemaining.length;
        while (cut > 1 && regular.widthOfTextAtSize(colorRemaining.slice(0, cut), 7.5) > textWidth) cut--;
        if (cut < colorRemaining.length) {
          const space = colorRemaining.lastIndexOf(' ', cut);
          if (space > 0) cut = space;
        }
        colorLines.push(colorRemaining.slice(0, cut));
        colorRemaining = colorRemaining.slice(cut).trim();
      }
      page.drawText('Cores:', { x: textX, y: textY, size: 7.5, font: bold, color: rgb(0.3, 0.3, 0.3) });
      textY -= 11;
      for (const line of colorLines) {
        page.drawText(line, { x: textX, y: textY, size: 7.2, font: regular, color: rgb(0.3, 0.3, 0.3) });
        textY -= 10;
      }

      page.drawText(formatPrice(product.price), {
        x: textX, y: y + 17, size: 11, font: bold, color: rgb(0.12, 0.12, 0.12),
      });

      addProductLink(page, pdf, x, y, CARD_WIDTH, CARD_HEIGHT, absoluteProductUrl(product.id));
    }
  }

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="catalogo-brussels-pet.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}
