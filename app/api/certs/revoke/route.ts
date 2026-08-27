import { z } from 'zod';
import { revokeCertificate, getAdminToken } from '@/app/lib/certificates';
import { NextRequest } from 'next/server';
import { isAdmin } from '@/app/lib/auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  id: z.string().uuid(),
  reason: z.string().max(280).optional(),
});

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? '';
  const adminToken = getAdminToken();

  const isAdminRequest = Boolean(adminToken) && authHeader === `Bearer ${adminToken}`;
  if (!isAdminRequest && !(await isAdmin())) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => null);
  const parseResult = bodySchema.safeParse(body);

  if (!parseResult.success) {
    return new Response(JSON.stringify({ error: 'Invalid request body', issues: parseResult.error.issues }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await revokeCertificate(parseResult.data.id, parseResult.data.reason);

  if (!result) {
    return new Response(JSON.stringify({ error: 'Certificate not found or already revoked' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
