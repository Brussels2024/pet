import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import AdminNavigation from '@/components/AdminNavigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Painel administrativo — Brussels Pet', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }) {
  const user = await getUser();
  if (!user || user.role !== 'admin') redirect('/admin-login');
  return <><AdminNavigation /><div className="wrap page admin-content">{children}</div></>;
}
