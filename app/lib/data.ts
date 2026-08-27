import sql from './postgres';
import { CertificateListItem } from './definitions';

export async function fetchCertificateStats() {
  const rows = await sql<{ total: string; active: string; revoked: string }[]>`
    SELECT COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status = 'active')::text AS active,
      COUNT(*) FILTER (WHERE status = 'revoked')::text AS revoked
    FROM certificates`;
  return { total: Number(rows[0]?.total ?? 0), active: Number(rows[0]?.active ?? 0), revoked: Number(rows[0]?.revoked ?? 0) };
}

export async function fetchCertificates(query = '') {
  try {
    return await sql<CertificateListItem[]>`
      SELECT id, serial, certificate_title, recipient_name, recipient_email, achievement, issue_date, university_name, authorized_signature, official_stamp, issued_at, expires_at,
             status, revoked_at, revoked_reason, created_by
      FROM certificates
      WHERE recipient_name ILIKE ${`%${query}%`}
         OR COALESCE(recipient_email, '') ILIKE ${`%${query}%`}
         OR serial ILIKE ${`%${query}%`}
         OR certificate_title ILIKE ${`%${query}%`}
         OR university_name ILIKE ${`%${query}%`}
      ORDER BY created_at DESC
      LIMIT 100
    `;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch certificates.');
  }
}
