import { NextRequest } from 'next/server';
import { getRegistrationConflictMessage, startRegistration, verifyRegistration } from '@/app/lib/registration';
import { setSession } from '@/app/lib/auth';
import { checkRateLimit, clientAddress, requestId, securityHeaders } from '@/app/lib/security/request';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const traceId = requestId(request);
  const address = clientAddress(request);
  const limit = checkRateLimit(`registration-start:${address}`, 10);
  if (!limit.allowed) return new Response(JSON.stringify({ error: 'Too many registration attempts. Please try again later.' }), { status: 429, headers: securityHeaders(traceId, limit.retryAfter) });
  try {
    const body = await request.json();
    const result = await startRegistration(body, traceId, address, request.headers.get('user-agent') ?? undefined);
    if (process.env.REGISTRATION_OTP_REQUIRED === 'false') {
      const verified = await verifyRegistration(result.registration_id, '', traceId, address, request.headers.get('user-agent') ?? undefined);
      await setSession(verified.userId);
      return new Response(JSON.stringify({ success: true, verification_required: false }), { status: 201, headers: securityHeaders(traceId) });
    }
    return new Response(JSON.stringify({ ...result, verification_required: true }), { status: 201, headers: securityHeaders(traceId) });
  } catch (error) {
    console.error(`[registration-start] ${traceId}`, error);
    const message = error instanceof Error ? error.message : 'Unable to start registration.';
    const conflict = getRegistrationConflictMessage(error);
    const status = conflict || message.includes('already uses') || message.includes('already registered') || message.includes('already in use') || message.includes('not open') || message.includes('not available') ? 409 : 422;
    return new Response(JSON.stringify({ error: conflict ?? message }), { status, headers: securityHeaders(traceId) });
  }
}
