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
  let instagram = '';
  try {
    const [whatsappSetting, instagramSetting] = await Promise.all([
      getSetting('whatsapp', ''),
      getSetting('instagram', ''),
    ]);
    whatsapp = whatsappSetting.replace(/\D/g, '');
    instagram = instagramSetting.trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '');
  } catch {
    whatsapp = '';
    instagram = '';
  }

  return (
    <html lang="pt-BR">
      <body>
        <StoreChrome
          header={<Header />}
          footer={
            <footer className="site-footer">
              <div className="wrap">Brussels Pet · Since 2024 · Venda exclusiva para empresas (CNPJ)</div>
            </footer>
          }
          whatsapp={whatsapp}
          instagram={instagram}
        >
          {children}
        </StoreChrome>
      </body>
    </html>
  );
}
