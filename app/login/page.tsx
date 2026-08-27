import Link from 'next/link';
import LoginForm from '@/app/ui/login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next = '/dashboard' } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-sm text-sky-300">Back to certificate verification</Link>
        <div className="rounded-3xl border border-slate-800 bg-white p-2 shadow-2xl">
          <LoginForm error={error} next={next} />
        </div>
        <Link href="/signup" className="mt-4 block text-center text-sm text-sky-300">Create an account</Link>
      </div>
    </main>
  );
}
