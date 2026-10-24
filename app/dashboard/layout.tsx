import SideNav from '@/app/ui/dashboard/sidenav';
import { isAdmin } from '@/app/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) redirect('/login?error=Administrator%20access%20required');
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white md:w-72 md:border-r md:border-b-0">
          <SideNav />
        </aside>
        <main className="flex-1 bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  );
}
