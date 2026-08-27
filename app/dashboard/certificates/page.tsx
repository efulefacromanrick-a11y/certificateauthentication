import Search from '@/app/ui/search';
import { fetchCertificates } from '@/app/lib/data';
import CertificateManager from '@/app/ui/certificates/manager';
import { revokeCertificateAction } from '@/app/lib/actions';

export const dynamic = 'force-dynamic';

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<{ query?: string }> }) {
  const { query = '' } = await searchParams;
  const certificates = await fetchCertificates(query);
  return <div className="space-y-8">
    <div><p className="text-sm uppercase tracking-[0.32em] text-slate-500">Certificates</p><h1 className="mt-3 text-3xl font-semibold text-slate-900">Issue and manage certificates</h1><p className="mt-2 max-w-2xl text-slate-600">Signed certificates are stored securely and can be verified or revoked later.</p></div>
    <CertificateManager />
    <section className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl font-semibold text-slate-900">Certificate register</h2><div className="w-full sm:max-w-sm"><Search placeholder="Search certificates..." /></div></div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm text-slate-700"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Recipient</th><th className="px-3 py-3">Title</th><th className="px-3 py-3">Certificate number</th><th className="px-3 py-3">University</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Action</th></tr></thead><tbody>{certificates.map((certificate) => <tr key={certificate.id} className="border-b last:border-0"><td className="px-3 py-4"><p className="font-medium text-slate-900">{certificate.recipient_name}</p><p className="text-xs text-slate-500">{certificate.recipient_email || 'No email'}</p></td><td className="px-3 py-4">{certificate.certificate_title}</td><td className="px-3 py-4 font-mono text-xs">{certificate.serial}</td><td className="px-3 py-4">{certificate.university_name}</td><td className="px-3 py-4"><span className={certificate.status === 'active' ? 'rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700' : 'rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-700'}>{certificate.status}</span></td><td className="px-3 py-4">{certificate.status === 'active' ? <form action={revokeCertificateAction}><input type="hidden" name="id" value={certificate.id} /><input name="reason" className="mb-2 w-40 rounded border border-slate-200 px-2 py-1 text-xs" placeholder="Reason (optional)" /><button className="block rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white">Revoke</button></form> : <span className="text-xs text-slate-500">{certificate.revoked_reason || 'Revoked'}</span>}</td></tr>)}</tbody></table>{!certificates.length && <p className="py-10 text-center text-slate-500">No certificates found.</p>}</div>
    </section>
  </div>;
}
