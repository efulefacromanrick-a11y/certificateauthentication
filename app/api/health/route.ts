import sql from '@/app/lib/postgres';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await sql`SELECT 1`;
    return Response.json({ status: 'ok', database: 'ok', timestamp: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'degraded', database: 'unavailable', timestamp: new Date().toISOString() }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
