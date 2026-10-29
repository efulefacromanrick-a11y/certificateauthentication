import { NextRequest } from 'next/server';
import { resetPassword } from '@/app/lib/registration';
import { checkRateLimit, clientAddress, requestId, securityHeaders } from '@/app/lib/security/request';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const traceId = requestId(request);
  const address = clientAddress(request);
  const limit = checkRateLimit(`password-recovery-reset:${address}`, 10);
  if (!limit.allowed) return new Response(JSON.stringify({ error: 'Too many recovery attempts. Please wait before trying again.' }), { status: 429, headers: securityHeaders(traceId, limit.retryAfter) });

  try {
    const body = await request.json();
    await resetPassword(body);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: securityHeaders(traceId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reset the password.';
    return new Response(JSON.stringify({ error: message }), { status: 422, headers: securityHeaders(traceId) });
  }
}
