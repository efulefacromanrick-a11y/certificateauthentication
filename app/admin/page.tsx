import Link from 'next/link';
import { ArrowLeftIcon, UsersIcon } from '@heroicons/react/24/outline';
import { isAdmin } from '@/app/lib/auth';
import { fetchUserStats } from '@/app/lib/data';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const admin = await isAdmin();

  if (!admin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <section className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
          <UsersIcon className="mx-auto h-12 w-12 text-sky-400" />
          <p className="mt-6 text-sm uppercase tracking-[0.3em] text-sky-300">Administration</p>
          <h1 className="mt-3 text-3xl font-semibold">Admin access required</h1>
          <p className="mt-4 leading-7 text-slate-400">This is a separate administration page. Sign in with an administrator account to view registered users.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/" className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold hover:border-slate-500">Home page</Link>
            <Link href="/login?next=%2Fadmin" className="rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold hover:bg-sky-400">Admin sign in</Link>
          </div>
        </section>
      </main>
    );
  }

  const stats = await fetchUserStats();
  const cards = [
    ['Total registered users', stats.total, 'All accounts created on the website'],
    ['Active users', stats.active, 'Accounts currently active'],
    ['Citizen accounts', stats.citizens, 'Registered candidates and citizens'],
    ['Admin accounts', stats.admins, 'Accounts with administrative access'],
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-300">Administration</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">User overview</h1>
            <p className="mt-3 text-slate-400">Monitor the accounts registered on the website.</p>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 self-start rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold transition hover:border-slate-500 sm:self-auto">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to home
          </Link>
        </div>

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="User statistics">
          {cards.map(([label, value, description]) => (
            <article key={label} className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-black/10">
              <UsersIcon className="h-7 w-7 text-sky-400" />
              <p className="mt-6 text-sm text-slate-400">{label}</p>
              <p className="mt-2 text-4xl font-semibold text-white">{value}</p>
              <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
