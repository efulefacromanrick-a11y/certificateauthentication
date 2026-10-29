'use client';

import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function RegisterQr({ id, serial }: { id: string; serial: string }) {
  const [open, setOpen] = useState(false);
  const qrRef = useRef<SVGSVGElement>(null);
  const verificationUrl = typeof window === 'undefined'
    ? ''
    : new URL(`/verify?id=${encodeURIComponent(id)}`, window.location.origin).toString();

  function downloadQr() {
    const svg = qrRef.current;
    if (!svg) return;

    const source = new XMLSerializer().serializeToString(svg);
    const objectUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `certificate-${serial}-verification-qr.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

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
          <QRCodeSVG ref={qrRef} value={verificationUrl} size={120} level="M" marginSize={3} title={`Verification QR for certificate ${serial}`} />
          <div className="mt-2 flex flex-col gap-2 text-center text-xs font-medium">
            <button type="button" onClick={downloadQr} className="text-sky-700 underline">
              Download QR
            </button>
            <a href={verificationUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">
              Open verification
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
