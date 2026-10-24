import Link from 'next/link';
import {
  ArrowRightIcon,
  CheckBadgeIcon,
  ClipboardDocumentCheckIcon,
  LockClosedIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';

const services = [
  {
    title: 'Verify a certificate',
    description: 'Check a certificate using its ID or scan the QR code to confirm its current status.',
    href: '/verify',
    action: 'Start verification',
    icon: QrCodeIcon,
    primary: true,
  },
  {
    title: 'Create a candidate account',
    description: 'Register your examination details and manage your candidate account.',
    href: '/signup',
    action: 'Register',
    icon: ClipboardDocumentCheckIcon,
    primary: false,
  },
  {
    title: 'Staff sign in',
    description: 'Authorized staff can access certificate issuance and administration tools.',
    href: '/login',
    action: 'Staff portal',
    icon: LockClosedIcon,
    primary: false,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <header className="relative z-10 border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3" aria-label="CertVerify home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400 text-slate-950">
              <CheckBadgeIcon className="h-6 w-6" />
            </span>
            <span className="text-lg font-bold tracking-tight">CertVerify</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm font-semibold">
            <Link href="/verify" className="hidden text-slate-300 transition hover:text-white sm:inline">
              Verify a certificate
            </Link>
            <Link href="/login" className="rounded-full border border-white/20 px-4 py-2.5 transition hover:border-white/50">
              Staff sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative">
        <div className="pointer-events-none absolute -right-40 -top-44 h-[34rem] w-[34rem] rounded-full bg-sky-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-40 top-48 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-20 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Trusted certificate services
            </p>
            <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              Certificates you can
              <span className="block text-sky-300">trust and verify.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              CertVerify helps candidates and organizations securely manage examination certificates.
              Verify a certificate online, register as a candidate, or sign in to authorized staff tools.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/verify"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-400 px-6 py-3.5 font-semibold text-slate-950 transition hover:bg-sky-300"
              >
                Verify a certificate
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3.5 font-semibold text-white transition hover:border-white/50 hover:bg-white/5"
              >
                Create a candidate account
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-400">
              Have an account already?{' '}
              <Link href="/login" className="font-semibold text-sky-300 underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-sky-400/20 to-indigo-500/10 blur-2xl" />
            <div className="relative rounded-[2rem] border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/30 sm:p-8">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">Digital verification</p>
                  <h2 className="mt-2 text-2xl font-semibold">Check with confidence</h2>
                </div>
                <span className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300">
                  <CheckBadgeIcon className="h-7 w-7" />
                </span>
              </div>
              <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/80 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white text-slate-900">
                    <QrCodeIcon className="h-11 w-11" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">One simple check</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Enter a certificate ID or scan its QR code.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
                  <CheckBadgeIcon className="h-5 w-5 shrink-0 text-emerald-300" />
                  <p className="text-sm text-emerald-100">See whether it is valid, expired, or revoked.</p>
                </div>
              </div>
              <Link href="/verify" className="mt-5 flex items-center justify-between rounded-xl px-1 py-2 text-sm font-semibold text-sky-300 hover:text-sky-200">
                Go to certificate verification
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-300">How can we help?</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Choose the service you need</h2>
            <p className="mt-4 leading-7 text-slate-400">
              Public certificate checks are open to everyone. Candidate registration and staff tools are available from their respective portals.
            </p>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {services.map(({ title, description, href, action, icon: Icon, primary }) => (
              <article
                key={title}
                className={`rounded-2xl border p-6 transition ${
                  primary
                    ? 'border-sky-300/30 bg-sky-300/[0.08]'
                    : 'border-white/10 bg-slate-900/60 hover:border-white/20'
                }`}
              >
                <Icon className={`h-7 w-7 ${primary ? 'text-sky-300' : 'text-slate-300'}`} />
                <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                <p className="mt-3 min-h-14 text-sm leading-6 text-slate-400">{description}</p>
                <Link href={href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 hover:text-sky-200">
                  {action}
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>CertVerify — secure certificate verification and management.</p>
        <nav className="flex gap-5">
          <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
          <Link href="/terms" className="hover:text-slate-300">Terms</Link>
        </nav>
      </footer>
    </main>
  );
}
