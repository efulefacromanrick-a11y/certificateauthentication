import { z } from 'zod';
import { verifyCertificate, verifyCertificateByIdentifier } from '@/app/lib/certificates';
import { NextRequest } from 'next/server';
import { checkRateLimit, clientAddress, requestId, securityHeaders } from '@/app/lib/security/request';

export const runtime = 'nodejs';

const bodySchema = z.object({
  jws: z.string().trim().min(1).max(3_500_000).optional(),
  id: z.string().trim().min(1).max(200).optional(),
}).refine((body) => Boolean(body.jws) !== Boolean(body.id), { message: 'Provide exactly one certificate token or ID' });

export async function POST(request: NextRequest) {
  const id = requestId(request);
  const limit = checkRateLimit(`verify:${clientAddress(request)}`);
  if (!limit.allowed) return new Response(JSON.stringify({ error: 'Too many verification attempts. Please try again shortly.' }), { status: 429, headers: securityHeaders(id, limit.retryAfter) });
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 4_000_000) return new Response(JSON.stringify({ error: 'Verification request is too large.' }), { status: 413, headers: securityHeaders(id) });
  const body = await request.json().catch(() => null);
  const parseResult = bodySchema.safeParse(body);

  if (!parseResult.success) {
    return new Response(JSON.stringify({ error: 'Provide one certificate token or ID.' }), { status: 422, headers: securityHeaders(id) });
  }

  try {
    const result = parseResult.data.jws
      ? await verifyCertificate(parseResult.data.jws, { requestId: id, ip: clientAddress(request), userAgent: request.headers.get('user-agent') ?? undefined })
      : await verifyCertificateByIdentifier(parseResult.data.id!, { requestId: id, ip: clientAddress(request), userAgent: request.headers.get('user-agent') ?? undefined });
    return new Response(JSON.stringify({ ...result, reason: result.status === 'invalid' ? undefined : result.reason, verified_at: new Date().toISOString() }), { status: 200, headers: securityHeaders(id) });
  } catch {
    return new Response(JSON.stringify({ error: 'Verification service is temporarily unavailable.' }), { status: 503, headers: securityHeaders(id) });
  }
}

export async function GET(request: NextRequest) {
  const traceId = requestId(request);
  const limit = checkRateLimit(`verify:${clientAddress(request)}`);
  if (!limit.allowed) return new Response(JSON.stringify({ error: 'Too many verification attempts. Please try again shortly.' }), { status: 429, headers: securityHeaders(traceId, limit.retryAfter) });
  const jws = request.nextUrl.searchParams.get('jws');
  const id = request.nextUrl.searchParams.get('id');
  const parseResult = bodySchema.safeParse({ jws, id });
  if (!parseResult.success) return new Response(JSON.stringify({ error: 'Missing certificate token or ID' }), { status: 422, headers: securityHeaders(traceId) });
  try {
    const result = parseResult.data.jws
      ? await verifyCertificate(parseResult.data.jws, { requestId: traceId, ip: clientAddress(request), userAgent: request.headers.get('user-agent') ?? undefined })
      : await verifyCertificateByIdentifier(parseResult.data.id!, { requestId: traceId, ip: clientAddress(request), userAgent: request.headers.get('user-agent') ?? undefined });
    return new Response(JSON.stringify({ ...result, reason: result.status === 'invalid' ? undefined : result.reason, verified_at: new Date().toISOString() }), { status: 200, headers: securityHeaders(traceId) });
  } catch {
    return new Response(JSON.stringify({ error: 'Verification service is temporarily unavailable.' }), { status: 503, headers: securityHeaders(traceId) });
  }
}
