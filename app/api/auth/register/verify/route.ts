import { NextRequest } from 'next/server';
import { getRegistrationConflictMessage, verifyRegistration } from '@/app/lib/registration';
import { setSession } from '@/app/lib/auth';
import { checkRateLimit, clientAddress, requestId, securityHeaders } from '@/app/lib/security/request';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const traceId = requestId(request);
  const address = clientAddress(request);
  const limit = checkRateLimit(`registration-verify:${address}`, 20);
  if (!limit.allowed) return new Response(JSON.stringify({ error: 'Too many code attempts. Please wait before trying again.' }), { status: 429, headers: securityHeaders(traceId, limit.retryAfter) });
  try {
    const body = await request.json();
    if (typeof body?.registration_id !== 'string' || typeof body?.code !== 'string') throw new Error('Enter the verification code.');
    const result = await verifyRegistration(body.registration_id, body.code, traceId, address, request.headers.get('user-agent') ?? undefined);
    await setSession(result.userId);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: securityHeaders(traceId) });
  } catch (error) {
    const conflict = getRegistrationConflictMessage(error);
    return new Response(JSON.stringify({ error: conflict ?? (error instanceof Error ? error.message : 'Unable to verify registration.') }), { status: conflict ? 409 : 422, headers: securityHeaders(traceId) });
  }
}
