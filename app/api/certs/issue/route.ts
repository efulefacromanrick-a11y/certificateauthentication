import { z } from 'zod';
import { issueCertificate, getAdminToken } from '@/app/lib/certificates';
import { NextRequest } from 'next/server';
import { getCurrentUserId, isAdmin } from '@/app/lib/auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  certificate_title: z.string().trim().min(3),
  recipient_name: z.string().trim().min(3),
  recipient_email: z.string().trim().email().optional(),
  achievement: z.string().trim().min(2).max(2000),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  university_name: z.string().trim().min(2),
  authorized_signature: z.string().trim().min(2),
  official_stamp: z.string().trim().min(2),
  signature_image: z.string().regex(/^data:image\/(png|jpeg|jpg|webp);base64,/).max(2_500_000).optional(),
  stamp_image: z.string().regex(/^data:image\/(png|jpeg|jpg|webp);base64,/).max(2_500_000).optional(),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? '';
  const adminToken = getAdminToken();

  const isAdminRequest = Boolean(adminToken) && authHeader === `Bearer ${adminToken}`;
  const isUserRequest = await isAdmin();
  if (!isAdminRequest && !isUserRequest) {
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

  const { certificate_title, recipient_name, recipient_email, achievement, issue_date, university_name, authorized_signature, official_stamp, signature_image, stamp_image, expires_at } = parseResult.data;

  try {
    const response = await issueCertificate({
      certificate_title,
      recipient_name,
      recipient_email,
      achievement,
      issue_date,
      university_name,
      authorized_signature,
      official_stamp,
      signature_image,
      stamp_image,
      expires_at,
    }, await getCurrentUserId());

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
