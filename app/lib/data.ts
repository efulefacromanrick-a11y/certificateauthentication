import sql from './postgres';
import { getCertificatePayloadFromSignature } from './certificates';
import { CertificateListItem } from './definitions';

export type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  role: 'admin' | 'citizen';
  status: string;
  created_at: string;
};

export async function fetchCertificateStats() {
  const rows = await sql<{ total: string; active: string; revoked: string }[]>`
    SELECT COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status = 'active')::text AS active,
      COUNT(*) FILTER (WHERE status = 'revoked')::text AS revoked
    FROM certificates`;
  return { total: Number(rows[0]?.total ?? 0), active: Number(rows[0]?.active ?? 0), revoked: Number(rows[0]?.revoked ?? 0) };
}

export async function fetchUserStats() {
  const rows = await sql<{ total: string; active: string; citizens: string; admins: string }[]>`
    SELECT COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status = 'active')::text AS active,
      COUNT(*) FILTER (WHERE role = 'citizen')::text AS citizens,
      COUNT(*) FILTER (WHERE role = 'admin')::text AS admins
    FROM users`;

  return {
    total: Number(rows[0]?.total ?? 0),
    active: Number(rows[0]?.active ?? 0),
    citizens: Number(rows[0]?.citizens ?? 0),
    admins: Number(rows[0]?.admins ?? 0),
  };
}

export async function fetchAdminUsers() {
  return sql<AdminUser[]>`
    SELECT id, name, email, username, role, status, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 500`;
}

export async function fetchCertificates(query = '') {
  try {
    const rows = await sql<{
      id: string;
      serial: string;
      certificate_title: string;
      recipient_name: string;
      recipient_email: string | null;
      achievement: string;
      issue_date: string;
      university_name: string;
      authorized_signature: string;
      official_stamp: string;
      issued_at: string;
      expires_at: string | null;
      signature: string;
      status: 'active' | 'revoked';
      revoked_at: string | null;
      revoked_reason: string | null;
      created_by: string | null;
    }[]>`
      SELECT id, serial, certificate_title, recipient_name, recipient_email, achievement, issue_date, university_name, authorized_signature, official_stamp, issued_at, expires_at,
             signature, status, revoked_at, revoked_reason, created_by
      FROM certificates
      WHERE recipient_name ILIKE ${`%${query}%`}
         OR COALESCE(recipient_email, '') ILIKE ${`%${query}%`}
         OR serial ILIKE ${`%${query}%`}
         OR certificate_title ILIKE ${`%${query}%`}
         OR university_name ILIKE ${`%${query}%`}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    return rows.map((row): CertificateListItem => {
      const payload = getCertificatePayloadFromSignature(row.signature);
      const signatureMatchesRecord = payload?.id === row.id && payload.serial === row.serial;
      const status = row.status === 'revoked'
        ? 'revoked'
        : !signatureMatchesRecord || (payload.expires_at !== null && payload.expires_at <= Math.floor(Date.now() / 1000))
          ? 'invalid'
          : 'valid';
      return {
        id: row.id,
        serial: row.serial,
        certificate_title: row.certificate_title,
        recipient_name: row.recipient_name,
        recipient_email: row.recipient_email,
        candidate_number: payload?.candidate_number,
        examination_type: payload?.examination_type,
        examination_year: payload?.examination_year,
        achievement: row.achievement,
        issue_date: row.issue_date,
        university_name: row.university_name,
        authorized_signature: row.authorized_signature,
        official_stamp: row.official_stamp,
        issued_at: row.issued_at,
        expires_at: row.expires_at,
        status,
        revoked_at: row.revoked_at,
        revoked_reason: row.revoked_reason,
        created_by: row.created_by,
      };
    });
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch certificates.');
  }
}
