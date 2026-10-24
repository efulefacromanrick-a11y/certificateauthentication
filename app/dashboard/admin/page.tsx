import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeftIcon, UsersIcon } from '@heroicons/react/24/outline';
import { isAdmin } from '@/app/lib/auth';
import { fetchAdminUsers, fetchUserStats } from '@/app/lib/data';

export const dynamic = 'force-dynamic';

export default async function DashboardAdminPage() {
  if (!(await isAdmin())) redirect('/login?next=%2Fdashboard%2Fadmin');

  const [stats, users] = await Promise.all([fetchUserStats(), fetchAdminUsers()]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Administration</p>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900">Registered users</h1>
            <p className="mt-2 text-slate-500">View the accounts registered on this website.</p>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:text-sky-800">
            <ArrowLeftIcon className="h-4 w-4" />
            Home page
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Total users', stats.total],
            ['Active users', stats.active],
            ['Citizens', stats.citizens],
            ['Administrators', stats.admins],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-5">
              <UsersIcon className="h-6 w-6 text-sky-600" />
              <p className="mt-4 text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-semibold text-slate-900">User accounts</h2>
          <p className="mt-1 text-sm text-slate-500">{users.length} account{users.length === 1 ? '' : 's'} shown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Email / username</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="text-slate-700">
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-900">{user.name}</td>
                  <td className="px-6 py-4"><div>{user.email || '—'}</div>{user.username && <div className="text-xs text-slate-400">@{user.username}</div>}</td>
                  <td className="px-6 py-4 capitalize">{user.role}</td>
                  <td className="px-6 py-4 capitalize">{user.status}</td>
                  <td className="whitespace-nowrap px-6 py-4">{new Date(user.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
