import { z } from 'zod';
import { issueCandidateCertificate, getAdminToken } from '@/app/lib/certificates';
import { NextRequest } from 'next/server';
import { getCurrentUserId, isAdmin } from '@/app/lib/auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  recipient_name: z.string().trim().min(2).max(150),
  candidate_number: z.string().trim().min(1).max(100),
  examination_type: z.enum(['O/L', 'A/L']),
  examination_year: z.coerce.number().int().min(2000).max(2200),
});

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? '';
  const adminToken = getAdminToken();

  const isAdminRequest = Boolean(adminToken) && authHeader === `Bearer ${adminToken}`;
  const isUserRequest = await isAdmin();
  if (!isAdminRequest && !isUserRequest) {
    const authenticated = Boolean(await getCurrentUserId());
    return new Response(JSON.stringify({
      error: authenticated ? 'Administrator access required' : 'Authentication required',
    }), {
      status: authenticated ? 403 : 401,
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

  const { recipient_name, candidate_number, examination_type, examination_year } = parseResult.data;

  try {
    const response = await issueCandidateCertificate({
      recipient_name,
      candidate_number,
      examination_type,
      examination_year,
    }, await getCurrentUserId());
    if (!response) {
      return new Response(JSON.stringify({ error: 'No unique registered candidate matches that name, examination number, type, and year. Check the details and try again.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Certificate issuance failed:', error);
    return new Response(JSON.stringify({ error: 'Unable to issue certificate. Check the form and database configuration.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
