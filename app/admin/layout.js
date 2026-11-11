import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth';
import AdminNavigation from '@/components/AdminNavigation';
import AdminSessionKeepAlive from '@/components/AdminSessionKeepAlive';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Painel administrativo — Brussels Pet', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }) {
  const user = await getAdminUser();
  if (!user || user.status !== 'ativo') redirect('/admin-login');
  return <><AdminSessionKeepAlive /><AdminNavigation /><div className="wrap page admin-content">{children}</div></>;
}
