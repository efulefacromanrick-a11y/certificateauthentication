import sql from '@/app/lib/postgres';
import { signJson } from '@/app/lib/certificates';

export const runtime = 'nodejs';

export async function GET() {
  const rows = await sql<{ serial: string }[]>`SELECT serial FROM certificates WHERE status = 'revoked' ORDER BY revoked_at ASC`;
  const issuedAt = Math.floor(Date.now() / 1000);
  const snapshot = { v: '1', issued_at: issuedAt, expires_at: issuedAt + 3600, revoked: rows.map((row) => row.serial) };
  return Response.json({ snapshot, jws: signJson(snapshot) }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } });
}
