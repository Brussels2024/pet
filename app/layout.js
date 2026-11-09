import './globals.css';
import Header from '@/components/Header';
import { getSetting } from '@/lib/db';

export const metadata = {
  title: 'Brussels Pet — distribuidora de produtos pet para empresas',
  description: 'Distribuidora B2B de produtos pet. Preços exclusivos para empresas com CNPJ.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }) {
  let whatsapp = '';
  try {
    whatsapp = (await getSetting('whatsapp', '')).replace(/\D/g, '');
  } catch {
    whatsapp = '';
  }

  return (
    <html lang="pt-BR">
      <body>
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
