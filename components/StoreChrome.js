'use client';

import { usePathname } from 'next/navigation';

export default function StoreChrome({ children, header, footer, whatsapp }) {
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
        >
          WhatsApp
        </a>
      )}
    </>
  );
}
