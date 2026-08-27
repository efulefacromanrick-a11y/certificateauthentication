import { NextRequest } from 'next/server';
import { resendRegistrationOtp } from '@/app/lib/registration';
import { checkRateLimit, clientAddress, requestId, securityHeaders } from '@/app/lib/security/request';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const traceId = requestId(request);
  const limit = checkRateLimit(`registration-resend:${clientAddress(request)}`, 5);
  if (!limit.allowed) return new Response(JSON.stringify({ error: 'Too many code requests. Please wait before trying again.' }), { status: 429, headers: securityHeaders(traceId, limit.retryAfter) });
  try {
    const body = await request.json();
    if (typeof body?.registration_id !== 'string') throw new Error('Registration session is missing.');
    const result = await resendRegistrationOtp(body.registration_id, traceId);
    return new Response(JSON.stringify(result), { status: 200, headers: securityHeaders(traceId) });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to resend code.' }), { status: 422, headers: securityHeaders(traceId) });
  }
}
