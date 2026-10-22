'use client';

import { useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

const initial = {
  certificate_title: '',
  recipient_name: '',
  recipient_email: '',
  candidate_number: '',
  examination_type: 'O/L' as 'O/L' | 'A/L',
  examination_year: String(new Date().getFullYear()),
  achievement: '',
  issue_date: new Date().toISOString().slice(0, 10),
  university_name: '',
  authorized_signature: '',
  official_stamp: '',
  signature_image: '',
  stamp_image: '',
  expires_at: '',
};

type IssuedCertificate = {
  id: string;
  serial: string;
  recipient_name: string;
  candidate_number: string;
  certificate_title: string;
  examination_type: 'O/L' | 'A/L';
  examination_year: number;
  expires_at: number | null;
};

export default function CertificateManager() {
  const [form, setForm] = useState(initial);
  const [certificate, setCertificate] = useState<IssuedCertificate | null>(null);
  const [verificationUrl, setVerificationUrl] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key: keyof typeof initial, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const readImage = (key: 'signature_image' | 'stamp_image', file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1_800_000) {
      setMessage('Images must be PNG, JPEG, or WebP and smaller than 1.8 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update(key, String(reader.result));
    reader.readAsDataURL(file);
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setCertificate(null);
    setVerificationUrl('');
    try {
      const response = await fetch('/api/certs/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          recipient_email: form.recipient_email || undefined,
          signature_image: form.signature_image || undefined,
          stamp_image: form.stamp_image || undefined,
          expires_at: form.expires_at || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to issue certificate.');
      const issued: IssuedCertificate = body.certificate;
      if (!issued?.id || !issued.serial) {
        throw new Error('Certificate was issued, but verification details were not returned.');
      }
      const url = new URL('/verify', window.location.origin);
      url.searchParams.set('id', issued.id);
      setCertificate(issued);
      setVerificationUrl(url.toString());
      setMessage('Certificate issued successfully. Its verification QR is ready.');
      setForm(initial);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to issue certificate.');
    } finally {
      setBusy(false);
    }
  }

  function downloadQr() {
    const svg = document.getElementById('certificate-verification-qr');
    if (!(svg instanceof SVGSVGElement)) {
      setMessage('The QR code is not ready to download.');
      return;
    }
    const source = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `certificate-${certificate?.serial || 'verification'}-qr.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const fields: [keyof typeof initial, string, string][] = [
    ['certificate_title', 'Certificate title', 'e.g. GCE Certificate'],
    ['recipient_name', "Candidate's full name", 'Candidate full name'],
    ['candidate_number', 'Candidate number', 'Enter candidate number'],
    ['recipient_email', "Recipient's email", 'candidate@example.com'],
    ['achievement', 'Achievement', 'Examination or qualification details'],
    ['issue_date', 'Date of issue', ''],
    ['university_name', 'Issuing authority', 'Examination board or authority'],
    ['authorized_signature', 'Authorized signature', 'Name and title of signatory'],
    ['official_stamp', 'Official stamp', 'Official institution stamp or reference'],
  ];

  return (
    <section className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
      <h2 className="text-xl font-semibold">Issue a certificate</h2>
      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
        {fields.map(([key, label, placeholder]) => (
          <label key={key} className="text-sm font-medium">
            {label}
            <input
              required={key !== 'recipient_email'}
              type={key === 'issue_date' ? 'date' : key === 'recipient_email' ? 'email' : 'text'}
              value={form[key]}
              onChange={(event) => update(key, event.target.value)}
              placeholder={placeholder}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
            />
          </label>
        ))}
        <label className="text-sm font-medium">
          Examination type
          <select
            value={form.examination_type}
            onChange={(event) => setForm((current) => ({
              ...current,
              examination_type: event.target.value === 'A/L' ? 'A/L' : 'O/L',
            }))}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
          >
            <option value="O/L">O/L</option>
            <option value="A/L">A/L</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Examination year
          <input
            required
            type="number"
            min="2000"
            max="2200"
            value={form.examination_year}
            onChange={(event) => update('examination_year', event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
          />
        </label>
        <label className="text-sm font-medium">
          Signature image
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readImage('signature_image', event.target.files?.[0])} className="mt-2 w-full text-sm" />
        </label>
        <label className="text-sm font-medium">
          Official stamp image
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readImage('stamp_image', event.target.files?.[0])} className="mt-2 w-full text-sm" />
        </label>
        <label className="text-sm font-medium">
          Expiry date (optional)
          <input type="date" value={form.expires_at} onChange={(event) => update('expires_at', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
        </label>
        <button disabled={busy} className="rounded-xl bg-sky-500 px-5 py-3 font-semibold disabled:opacity-50 md:col-span-2">
          {busy ? 'Issuing...' : 'Issue certificate'}
        </button>
      </form>
      {message && <p role="status" className="mt-4 text-sm text-sky-200">{message}</p>}
      {certificate && verificationUrl && (
        <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-slate-700 bg-slate-950 p-5 sm:flex-row sm:items-center">
          <div className="w-fit rounded-xl bg-white p-3">
            <QRCodeSVG id="certificate-verification-qr" value={verificationUrl} size={192} level="M" marginSize={4} title={`Verification QR code for certificate ${certificate.serial}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Certificate issued</p>
            <h3 className="mt-2 text-lg font-semibold">{certificate.recipient_name}</h3>
            <dl className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              <div><dt className="text-slate-500">Examination type</dt><dd>{certificate.examination_type}</dd></div>
              <div><dt className="text-slate-500">Examination year</dt><dd>{certificate.examination_year}</dd></div>
              <div><dt className="text-slate-500">Certificate ID</dt><dd className="break-all font-mono text-xs">{certificate.id}</dd></div>
              <div><dt className="text-slate-500">Certificate status</dt><dd className="font-semibold text-emerald-300">{certificate.expires_at && certificate.expires_at * 1000 <= Date.now() ? 'Invalid (expired)' : 'Valid'}</dd></div>
            </dl>
            <p className="mt-3 font-mono text-xs text-slate-400">Certificate number: {certificate.serial}</p>
            <p className="mt-2 text-sm text-slate-400">Scan this QR to open the certificate&apos;s live verification record.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={downloadQr} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400">
                Download QR (SVG)
              </button>
              <Link href={verificationUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-sky-400">
                Open verification record
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
