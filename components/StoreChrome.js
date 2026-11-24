'use client';

import { usePathname } from 'next/navigation';

export default function StoreChrome({ children, header, footer, whatsapp, instagram }) {
  const pathname = usePathname() || '';
  const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/admin-login';
  if (isAdminArea) return <main className="admin-shell">{children}</main>;

  const instagramUrl = instagram
    ? (/^https?:\/\//i.test(instagram) ? instagram : 'https://www.instagram.com/' + encodeURIComponent(instagram.replace(/^@+/, '')) + '/')
    : '';

  return (
    <>
      {header}
      <main>{children}</main>
      {footer}
      {(whatsapp || instagramUrl) && (
        <div className="social-float" aria-label="Redes sociais">
          {whatsapp && <a className="social-float-link social-whatsapp" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="Fale conosco pelo WhatsApp" title="WhatsApp">WhatsApp</a>}
          {instagramUrl && (
            <a className="social-float-link social-instagram" href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Acesse nosso Instagram" title="Instagram">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="18" cy="6" r="1.3" fill="currentColor"/></svg>
            </a>
          )}
        </div>
      )}
    </>
  );
}
