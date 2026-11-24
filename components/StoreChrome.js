'use client';

import { usePathname } from 'next/navigation';

export default function StoreChrome({ children, header, footer, whatsapp, instagram }) {
  const pathname = usePathname() || '';
  const isAdminArea =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/admin-login';

  if (isAdminArea) {
    return <main className="admin-shell">{children}</main>;
  }

  return (
    <>
      {header}
      <main>{children}</main>
      {footer}
      {whatsapp && (
        <a
          className="whats"
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Fale com a Brussels Pet pelo WhatsApp"
        >
          WhatsApp
        </a>
      )}
      {instagram && (
        <a
          className="whats instagram-social"
          href={instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Acesse o Instagram da Brussels Pet"
        >
          Instagram
        </a>
      )}
    </>
  );
}
