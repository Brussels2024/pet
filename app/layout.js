import './globals.css';
import Header from '@/components/Header';
import { getSetting } from '@/lib/db';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');

export const metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: 'Brussels Pet | Distribuidora de produtos pet para empresas',
    template: '%s | Brussels Pet',
  },
  description:
    'Brussels Pet é uma distribuidora B2B de produtos pet para lojistas e empresas com CNPJ. Confira nosso catálogo de produtos para cães e gatos e compre online com atendimento para todo o Brasil.',
  applicationName: 'Brussels Pet',
  keywords: [
    'Brussels Pet',
    'distribuidora pet',
    'distribuidora de produtos pet',
    'fornecedor pet',
    'atacado pet',
    'produtos pet para empresas',
    'produtos para cães e gatos',
    'comprar produtos pet online',
  ],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Brussels Pet',
    title: 'Brussels Pet | Distribuidora de produtos pet para empresas',
    description:
      'Distribuidora B2B de produtos pet para lojistas e empresas com CNPJ. Catálogo online e atendimento para todo o Brasil.',
    ...(siteUrl ? { url: siteUrl } : {}),
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brussels Pet | Distribuidora de produtos pet para empresas',
    description:
      'Produtos pet para lojistas e empresas com CNPJ. Atendimento para todo o Brasil.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }) {
  let whatsapp = '';
  try {
    whatsapp = (await getSetting('whatsapp', '')).replace(/\\D/g, '');
  } catch {
    whatsapp = '';
  }

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Brussels Pet',
    description:
      'Distribuidora B2B de produtos pet para lojistas e empresas com CNPJ, com atendimento para todo o Brasil.',
    ...(siteUrl ? { url: siteUrl } : {}),
    ...(whatsapp
      ? { contactPoint: { '@type': 'ContactPoint', telephone: `+${whatsapp}`, contactType: 'sales', availableLanguage: ['Portuguese'] } }
      : {}),
  };

  return (
    <html lang="pt-BR">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organization).replace(/</g, '\\u003c'),
          }}
        />
        <Header />
        <main>{children}</main>
        <footer className="site-footer">
          <div className="wrap">Brussels Pet · Since 2024 · Venda exclusiva para empresas (CNPJ)</div>
        </footer>
        {whatsapp && (
          <a
            className="whats"
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        )}
      </body>
    </html>
  );
}
