import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';

/** Settings hub + subpages are admin-only. */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (user.role !== 'admin') redirect('/');
  return children;
}
