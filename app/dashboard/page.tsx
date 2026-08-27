import Link from 'next/link';
import { fetchCertificateStats } from '@/app/lib/data';

export default async function DashboardPage() {
  const stats = await fetchCertificateStats();

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-slate-500">Dashboard</p>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900">Overview</h1>
          </div>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[['Total certificates', stats.total], ['Active', stats.active], ['Revoked', stats.revoked]].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p></div>
          ))}
        </div>
      </section>
      <section className="rounded-3xl bg-slate-900 p-8 text-white"><h2 className="text-2xl font-semibold">Certificate management</h2><p className="mt-2 text-slate-300">Issue new certificates, review the register, and revoke credentials when necessary.</p><Link href="/dashboard/certificates" className="mt-6 inline-flex rounded-full bg-sky-500 px-5 py-3 font-semibold">Manage certificates</Link></section>
    </div>
  );
}
