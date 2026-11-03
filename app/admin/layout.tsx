import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';

/** Admin-only gate. Pages render their own crumbs/subnav. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (user.role !== 'admin') redirect('/');
  return children;
}
