import { getRegistrationOptions } from '@/app/lib/registration';

export const runtime = 'nodejs';

export async function GET() {
  try { return Response.json(await getRegistrationOptions(), { headers: { 'Cache-Control': 'public, max-age=300' } }); }
  catch { return Response.json({ error: 'Registration options are temporarily unavailable.' }, { status: 503 }); }
}
