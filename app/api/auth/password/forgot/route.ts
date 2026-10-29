import { NextRequest } from 'next/server';
import { startPasswordRecovery } from '@/app/lib/registration';
import { checkRateLimit, clientAddress, requestId, securityHeaders } from '@/app/lib/security/request';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const traceId = requestId(request);
  const address = clientAddress(request);
  const limit = checkRateLimit(`password-recovery-start:${address}`, 5);
  if (!limit.allowed) return new Response(JSON.stringify({ error: 'Too many recovery requests. Please wait before trying again.' }), { status: 429, headers: securityHeaders(traceId, limit.retryAfter) });

  try {
    const body = await request.json();
    const result = await startPasswordRecovery(body?.identifier, traceId);
    return new Response(JSON.stringify({
      success: true,
      recovery_id: result.recovery_id,
      debugCode: 'debugCode' in result ? result.debugCode : undefined,
      message: 'If an active account matches those details, a recovery code has been sent to its registered contact. If you do not receive one, try the account email or contact support.',
    }), { status: 200, headers: securityHeaders(traceId) });
  } catch (error) {
    console.error(`[password-recovery-start] ${traceId}`, error);
    return new Response(JSON.stringify({ error: 'Unable to start password recovery. Check the details and try again.' }), { status: 422, headers: securityHeaders(traceId) });
  }
}
