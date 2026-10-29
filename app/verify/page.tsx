'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import jsQR from 'jsqr';
import { ArrowPathIcon, CameraIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, QrCodeIcon, XCircleIcon } from '@heroicons/react/24/outline';

type Status = 'valid' | 'invalid' | 'revoked' | 'expired';
type Certificate = {
  id: string;
  serial: string;
  certificate_title: string;
  recipient_name: string;
  candidate_number?: string;
  examination_type?: 'O/L' | 'A/L';
  examination_year?: number;
  university_name: string;
  issued_at: number;
  expires_at: number | null;
};
type Result = { status: Status; reason?: string; verified_at?: string; certificate?: Certificate };
const statusDetails: Record<Status, { label: string; description: string; icon: typeof CheckCircleIcon; classes: string }> = {
  valid: { label: 'Verified', description: 'Authenticated and currently active.', icon: CheckCircleIcon, classes: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' },
  invalid: { label: 'Invalid', description: 'This certificate could not be authenticated.', icon: XCircleIcon, classes: 'border-red-400/25 bg-red-400/10 text-red-200' },
  revoked: { label: 'Revoked', description: 'The issuing authority revoked this certificate.', icon: XCircleIcon, classes: 'border-orange-400/25 bg-orange-400/10 text-orange-200' },
  expired: { label: 'Verified (expired)', description: 'Authentic, but past its validity period.', icon: ExclamationTriangleIcon, classes: 'border-amber-400/25 bg-amber-400/10 text-amber-200' },
};

function formatDate(value: string | number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    .format(typeof value === 'number' ? new Date(value * 1000) : new Date(value));
}

function readQrValue(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const id = url.searchParams.get('id');
    const jws = url.searchParams.get('jws');
    if (id) return { mode: 'id' as const, value: id };
    if (jws) return { mode: 'jws' as const, value: jws };
    throw new Error('This QR code is not a certificate verification link.');
  } catch {
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) {
      throw new Error('This QR code is not a certificate verification link.');
    }
    return {
      mode: trimmed.split('.').length === 3 ? 'jws' as const : 'id' as const,
      value: trimmed,
    };
  }
}

export default function VerifyPage() {
  const [identifier, setIdentifier] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<Date | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimer = useRef<number | null>(null);

  async function verify(value: string, mode: 'id' | 'jws') {
    if (!value.trim()) return;
    setLoading(true);
    setResult(null);
    setMessage('');
    try {
      const input = mode === 'jws' ? readQrValue(value) : { mode, value: value.trim() };
      const response = await fetch('/api/certs/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [input.mode]: input.value }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to verify certificate.');
      setResult(body);
      setVerifiedAt(body.verified_at ? new Date(body.verified_at) : new Date());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to verify certificate.');
    } finally {
      setLoading(false);
    }
  }

  async function readImage(file: File) {
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to read this image.');
      context.drawImage(bitmap, 0, 0);
      const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
      const value = jsQR(image.data, image.width, image.height)?.data;
      if (!value) throw new Error('No QR code found. Try a clearer image.');
      await verify(value, 'jws');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to scan image.');
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia || cameraOpen) {
      setMessage('Live camera scanning is not supported in this browser. Upload a QR image instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
      scanTimer.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !video.videoWidth) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(video, 0, 0);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const value = jsQR(image.data, image.width, image.height)?.data;
        if (value) {
          stopCamera();
          await verify(value, 'jws');
        }
      }, 400);
    } catch {
      setMessage('Camera access was unavailable. Upload a QR image instead.');
    }
  }

  function stopCamera() {
    if (scanTimer.current) window.clearInterval(scanTimer.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedValue = params.get('id') || params.get('jws');
    if (sharedValue) {
      setIdentifier(params.get('id') || '');
      void verify(sharedValue, params.get('id') ? 'id' : 'jws');
    }
    return () => stopCamera();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await verify(identifier, 'id');
  }

  const detail = result ? statusDetails[result.status] : null;
  const StatusIcon = detail?.icon;
  const certificate = result?.certificate;
  const invalidDescription = result?.reason === 'certificate_not_found'
    ? 'No record matches that ID, candidate number, or certificate number. Check the number and try again.'
    : result?.reason === 'certificate_identifier_ambiguous'
      ? 'More than one candidate record matches that number. Please contact the issuing authority to confirm the correct certificate number.'
      : result?.reason === 'signature_mismatch'
        ? 'The QR code or certificate token could not be authenticated. Request a new verification code from the issuing authority.'
        : result?.reason === 'payload_mismatch'
          ? 'The certificate details do not match the official record. Contact the issuing authority.'
          : detail?.description;

  return (
    <main className="min-h-screen bg-[#07111f] px-5 py-8 text-slate-100 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-sky-300">CertVerify</Link>
          <Link href="/" className="text-sm text-slate-400 hover:text-white">Home</Link>
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
          <section>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Official certificate verification</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Verify an examination certificate</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-400">
              Check a candidate&apos;s certificate authenticity and current status using the certificate ID or QR code.
            </p>
            <div className="mt-10 flex gap-5 text-sm text-slate-400">
              <span className="flex items-center gap-2"><QrCodeIcon className="h-5 w-5 text-sky-400" /> QR enabled</span>
              <span className="flex items-center gap-2"><ClockIcon className="h-5 w-5 text-sky-400" /> Live status</span>
            </div>
          </section>
          <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 sm:p-8">
            <form onSubmit={handleSubmit}>
              <label htmlFor="certificate-id" className="text-sm font-semibold text-slate-200">Certificate ID, candidate number, or certificate number</label>
              <div className="mt-3 flex gap-3">
                <input id="certificate-id" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Enter certificate ID or candidate number" className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white outline-none placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
                <button type="submit" disabled={loading || !identifier.trim()} className="rounded-2xl bg-sky-500 px-5 py-3 font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {loading ? 'Checking…' : 'Verify'}
                </button>
              </div>
            </form>
            <div className="my-7 flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-slate-600">
              <span className="h-px flex-1 bg-slate-800" /> or scan QR <span className="h-px flex-1 bg-slate-800" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={startCamera} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold hover:border-sky-400 hover:text-sky-200">
                <CameraIcon className="h-5 w-5" /> Use camera
              </button>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold hover:border-sky-400 hover:text-sky-200">
                <QrCodeIcon className="h-5 w-5" /> Upload QR image
                <input aria-label="Upload certificate QR image" type="file" accept="image/*" className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files?.[0] && readImage(event.target.files[0])} />
              </label>
            </div>
            {cameraOpen && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-sky-400/40 bg-black">
                <video ref={videoRef} autoPlay playsInline aria-label="QR code camera scanner" className="aspect-video w-full object-cover" />
                <button type="button" onClick={stopCamera} className="w-full bg-slate-900 py-2 text-sm text-slate-300">Close camera</button>
              </div>
            )}
            <div aria-live="polite" aria-atomic="true">
              {message && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 px-4 py-3 text-sm text-red-200">{message}</p>}
              {result && detail && StatusIcon && (
                <div className={`mt-8 rounded-3xl border p-5 ${detail.classes}`}>
                  <div className="flex items-start gap-4">
                    <StatusIcon className="h-8 w-8 shrink-0" />
                    <div>
                      <p className="text-xl font-semibold">Certificate status: {detail.label}</p>
                      <p className="mt-1 text-sm opacity-80">{result.status === 'invalid' ? invalidDescription : detail.description}</p>
                    </div>
                  </div>
                  <div className="mt-5 border-t border-current/10 pt-4 text-sm">
                    <p className="text-xs uppercase tracking-wider opacity-60">Date of verification</p>
                    <p className="mt-1 font-medium">{verifiedAt ? formatDate(verifiedAt.toISOString()) : 'Just now'}</p>
                  </div>
                </div>
              )}
            </div>
            {certificate && (
              <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Candidate certificate details</p>
                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-500">Candidate&apos;s full name</dt><dd className="mt-1 font-semibold text-white">{certificate.recipient_name}</dd></div>
                  <div><dt className="text-slate-500">Candidate number</dt><dd className="mt-1 font-semibold text-white">{certificate.candidate_number || 'Not recorded on this certificate'}</dd></div>
                  <div><dt className="text-slate-500">Examination type</dt><dd className="mt-1 font-semibold text-white">{certificate.examination_type || 'Not recorded on this certificate'}</dd></div>
                  <div><dt className="text-slate-500">Examination year</dt><dd className="mt-1 font-semibold text-white">{certificate.examination_year || 'Not recorded on this certificate'}</dd></div>
                  <div><dt className="text-slate-500">Issuing authority</dt><dd className="mt-1 font-semibold text-white">{certificate.university_name}</dd></div>
                  <div><dt className="text-slate-500">Certificate number</dt><dd className="mt-1 font-semibold text-white">{certificate.serial}</dd></div>
                  <div><dt className="text-slate-500">Date of issue</dt><dd className="mt-1 font-semibold text-white">{formatDate(certificate.issued_at)}</dd></div>
                  <div><dt className="text-slate-500">Authenticity status</dt><dd className="mt-1 font-semibold text-white">{detail?.label}</dd></div>
                </dl>
              </div>
            )}
            {(result || message) && (
              <button type="button" onClick={() => { setIdentifier(''); setResult(null); setMessage(''); setVerifiedAt(null); }} className="mt-5 flex items-center gap-2 text-sm text-slate-400 hover:text-white">
                <ArrowPathIcon className="h-4 w-4" /> Start a new verification
              </button>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
