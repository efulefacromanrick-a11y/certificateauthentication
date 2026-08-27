import Link from 'next/link';

export default function TermsPage() {
  return <main className="min-h-screen bg-slate-100 px-6 py-12"><article className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-slate-800 shadow-sm"><Link href="/signup" className="text-sm font-semibold text-sky-700">← Back to registration</Link><h1 className="mt-6 text-3xl font-semibold">Terms of use</h1><p className="mt-4 text-slate-600">By creating an examination account, you confirm that the information you provide is accurate and belongs to you. You agree not to share your account or attempt to access another candidate’s records.</p><p className="mt-4 text-sm text-slate-500">Policy version: 2026-01</p></article></main>;
}
