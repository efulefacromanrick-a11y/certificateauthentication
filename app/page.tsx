import Link from 'next/link';
import { ArrowRightIcon, CheckCircleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="rounded-[32px] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-900/90 p-10 shadow-2xl shadow-blue-950/20">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm uppercase tracking-[0.32em] text-sky-300">
                  Certificate Authentication
                </p>
                <h1 className="mt-6 text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                  Trust every certificate with verified QR authentication.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                  Issue, verify, and revoke digital certificates in a secure web experience designed for reliability and accessibility.
                </p>
                <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                  <Link
                    href="/verify"
                    className="inline-flex items-center justify-center rounded-full bg-sky-500 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
                  >
                    Verify a certificate
                  </Link>
                  <Link
                    href="/issuer"
                    className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 px-8 py-3 text-base font-semibold text-slate-100 transition hover:border-slate-500"
                  >
                    Issue a certificate
                  </Link>
                  <Link href="/login" className="inline-flex items-center justify-center rounded-full border border-slate-700 px-8 py-3 text-base font-semibold text-slate-100 transition hover:border-slate-500">
                    Account login
                  </Link>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/30">
                <div className="flex items-center gap-4 text-slate-200">
                  <ShieldCheckIcon className="h-10 w-10 text-sky-400" />
                  <div>
                    <p className="text-lg font-semibold">Blue-grade security</p>
                    <p className="text-sm text-slate-400">Built for clear trust and certificate validation.</p>
                  </div>
                </div>
                <div className="mt-8 grid gap-4 text-slate-300 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-950/70 p-5">
                    <p className="font-semibold text-white">Instant verification</p>
                    <p className="mt-2 text-sm text-slate-400">Scan or paste a QR code and confirm authenticity in seconds.</p>
                  </div>
                  <div className="rounded-3xl bg-slate-950/70 p-5">
                    <p className="font-semibold text-white">Revocation control</p>
                    <p className="mt-2 text-sm text-slate-400">Revoke certificates immediately and keep your trust boundary up to date.</p>
                  </div>
                </div>
                <div className="mt-8 rounded-3xl bg-slate-900 p-6 text-slate-200">
                  <p className="text-sm uppercase tracking-[0.3em] text-sky-300">Sample certificate</p>
                  <p className="mt-4 text-lg font-semibold">Holder: Alex Rivera</p>
                  <p className="mt-1 text-sm text-slate-400">Type: Attendance, issued today</p>
                  <div className="mt-6 flex items-center gap-3 text-slate-100">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm">Verified & live</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
