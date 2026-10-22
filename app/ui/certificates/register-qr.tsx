'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function RegisterQr({ id, serial }: { id: string; serial: string }) {
  const [open, setOpen] = useState(false);
  const verificationUrl = typeof window === 'undefined'
    ? ''
    : new URL(`/verify?id=${encodeURIComponent(id)}`, window.location.origin).toString();

  return (
    <div className="min-w-24">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-500 hover:text-sky-700"
        aria-expanded={open}
        aria-label={`${open ? 'Hide' : 'Generate'} verification QR for ${serial}`}
      >
        {open ? 'Hide QR' : 'Generate QR'}
      </button>
      {open && verificationUrl && (
        <div className="mt-3 w-fit rounded-lg border border-slate-200 bg-white p-2">
          <QRCodeSVG value={verificationUrl} size={120} level="M" marginSize={3} title={`Verification QR for certificate ${serial}`} />
          <a href={verificationUrl} target="_blank" rel="noreferrer" className="mt-2 block text-center text-xs font-medium text-sky-700 underline">
            Open verification
          </a>
        </div>
      )}
    </div>
  );
}
