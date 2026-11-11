import './globals.css';
import Header from '@/components/Header';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\\/+$/, '');
const whatsapp = '5519995888333';
const instagram = 'https://www.instagram.com/almapet2024/';

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
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Brussels Pet',
    description:
      'Distribuidora B2B de produtos pet para lojistas e empresas com CNPJ, com atendimento para todo o Brasil.',
    ...(siteUrl ? { url: siteUrl } : {}),
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: `+${whatsapp}`,
      contactType: 'sales',
      availableLanguage: ['Portuguese'],
    },
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

        <div className="social-float" aria-label="Redes sociais da Brussels Pet">
          <a
            className="social-float__link social-float__whatsapp"
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Fale com a Brussels Pet pelo WhatsApp"
            title="WhatsApp"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M20.52 3.48A11.86 11.86 0 0 0 12.08 0C5.5 0 .15 5.34.15 11.92c0 2.1.55 4.15 1.6 5.96L.05 24l6.27-1.64a11.9 11.9 0 0 0 5.75 1.46h.01c6.58 0 11.93-5.35 11.93-11.93 0-3.19-1.24-6.19-3.49-8.41ZM12.08 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.72.98.99-3.63-.24-.37a9.87 9.87 0 0 1-1.52-5.27c0-5.46 4.44-9.9 9.91-9.9a9.83 9.83 0 0 1 7.01 2.91 9.83 9.83 0 0 1 2.9 7.01c0 5.46-4.45 9.9-9.92 9.9Zm5.43-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.08 4.5.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z"/>
            </svg>
            <span>WhatsApp</span>
          </a>

          <a
            className="social-float__link social-float__instagram"
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Acesse o Instagram da Brussels Pet"
            title="Instagram"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/>
              <circle cx="17.5" cy="6.7" r="1.2" fill="currentColor"/>
            </svg>
            <span>Instagram</span>
          </a>
        </div>
      </body>
    </html>
  );
}
