'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [recoveryId, setRecoveryId] = useState('');
  const [debugCode, setDebugCode] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to request a recovery code.');
      setRecoveryId(body.recovery_id);
      setDebugCode(body.debugCode || '');
      setMessage(body.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to request a recovery code.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 12) {
      setError('Use a strong password with at least 12 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recovery_id: recoveryId, code, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to reset your password.');
      setComplete(true);
      setMessage('Your password has been updated. Sign in with your new password.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reset your password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <Link href="/login" className="text-sm font-medium text-sky-700 hover:underline">Back to sign in</Link>
        <h1 className="mt-6 text-2xl font-semibold text-slate-900">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-600">Enter the email, phone number, or username linked to your account.</p>

        {!recoveryId && <form onSubmit={requestCode} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email, phone number, or username
            <input
              autoComplete="username"
              autoCapitalize="none"
              required
              minLength={3}
              maxLength={254}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <button disabled={busy} className="w-full rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
            {busy ? 'Sending…' : 'Send recovery code'}
          </button>
        </form>}

        {recoveryId && !complete && <form onSubmit={resetPassword} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Six-digit recovery code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={6}
              pattern="[0-9]{6}"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-center tracking-[0.4em] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </label>
          {debugCode && <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">Local development code: <strong>{debugCode}</strong></p>}
          <label className="block text-sm font-medium text-slate-700">
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </label>
          <button disabled={busy || code.length !== 6} className="w-full rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
            {busy ? 'Updating…' : 'Reset password'}
          </button>
          <button type="button" onClick={() => { setRecoveryId(''); setCode(''); setDebugCode(''); setError(''); setMessage(''); }} className="w-full text-sm font-medium text-slate-600 hover:text-sky-700">
            Request another code
          </button>
        </form>}

        {message && <p role="status" className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">{message}</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {complete && <Link href="/login" className="mt-5 block w-full rounded-xl bg-sky-600 px-5 py-3 text-center font-semibold text-white hover:bg-sky-700">Continue to sign in</Link>}
      </section>
    </main>
  );
}
