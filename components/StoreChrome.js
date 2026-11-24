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

  const instagramUrl = instagram
    ? (/^https?:\/\//i.test(instagram)
        ? instagram
        : 'https://www.instagram.com/' + encodeURIComponent(instagram.replace(/^@+/, '')) + '/')
    : '';

  return (
    <>
      {header}
      <main>{children}</main>
      {footer}
      {(whatsapp || instagramUrl) && (
        <div className="social-float" aria-label="Canais de atendimento">
          {whatsapp && (
            <a
              className="social-float-link social-whatsapp"
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Fale conosco pelo WhatsApp"
              title="WhatsApp"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.52 3.48A11.8 11.8 0 0 0 12.1 0C5.56 0 .23 5.32.23 11.87c0 2.1.55 4.15 1.6 5.96L.13 24l6.33-1.66a11.9 11.9 0 0 0 5.64 1.43h.01c6.54 0 11.87-5.32 11.88-11.87a11.8 11.8 0 0 0-3.47-8.42ZM12.1 21.75a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.76.99 1-3.67-.24-.38a9.85 9.85 0 1 1 8.4 4.65Zm5.42-7.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.5 1.7.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z"/></svg>
            </a>
          )}
          {instagramUrl && (
            <a
              className="social-float-link social-instagram"
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Acesse nosso Instagram"
              title="Instagram"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="18" cy="6" r="1.3" fill="currentColor"/></svg>
            </a>
          )}
        </div>
      )}
    </>
  );
}
