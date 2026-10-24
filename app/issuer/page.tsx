import Link from 'next/link';
import CertificateManager from '@/app/ui/certificates/manager';
import { isAdmin } from '@/app/lib/auth';
import { redirect } from 'next/navigation';

export default async function IssuerPage() {
  if (!(await isAdmin())) redirect('/login?error=Administrator%20access%20required&next=%2Fissuer');
  return <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100"><div className="mx-auto max-w-5xl"><div className="mb-8 flex items-center justify-between"><div><p className="text-sm uppercase tracking-[0.3em] text-sky-300">Issuer portal</p><h1 className="mt-3 text-4xl font-semibold">Issue verified certificates</h1></div><Link href="/" className="rounded-full border border-slate-700 px-5 py-3">Back to home</Link></div><CertificateManager /></div></main>;
}
