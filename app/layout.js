import './globals.css';
import Header from '@/components/Header';
import StoreChrome from '@/components/StoreChrome';
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
        <StoreChrome
          header={<Header />}
          footer={
            <footer className="site-footer">
              <div className="wrap">
                Brussels Pet · Since 2024 · Venda exclusiva para empresas (CNPJ)
                <span style={{ display: 'block', marginTop: 6 }}>
                  Suporte: <a href="mailto:contato.brussels@gmail.com">contato.brussels@gmail.com</a>
                </span>
              </div>
            </footer>
          }
          whatsapp={whatsapp}
        >
          {children}
        </StoreChrome>
      </body>
    </html>
  );
}
