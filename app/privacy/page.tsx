import Link from 'next/link';

export default function PrivacyPage() {
  return <main className="min-h-screen bg-slate-100 px-6 py-12"><article className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-slate-800 shadow-sm"><Link href="/signup" className="text-sm font-semibold text-sky-700">← Back to registration</Link><h1 className="mt-6 text-3xl font-semibold">Privacy policy</h1><p className="mt-4 text-slate-600">We use your examination and contact details to create, secure, and support your candidate account. Access is restricted to authorized examination staff. We retain records only for the period required to provide examination and certificate services.</p><p className="mt-4 text-sm text-slate-500">Policy version: 2026-01</p></article></main>;
}
