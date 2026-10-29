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

export type CandidateRegistration = {
  user_id: string;
  full_name: string;
  date_of_birth: string;
  candidate_number: string;
  series: string | null;
  sex: string | null;
  certificate_number: string | null;
  date_of_issue: string | null;
  school_name: string | null;
  email: string | null;
  phone_e164: string | null;
  username: string | null;
  account_status: string;
  registered_at: string;
  examination_name: string;
  examination_year: number;
  examination_status: string;
  centre_code: string;
  centre_name: string;
  centre_number: string | null;
  subjects: { code: string; name: string; amount_paid: string | number }[];
  registration_fee: string | null;
  franking_fee: string | null;
  subjects_total: string | null;
  total_amount: string | null;
  payment_mode: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  payment_created_at: string | null;
  consents: { consent_type: string; policy_version: string; accepted_at: string }[];
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

export async function fetchCandidateRegistrations(query = '') {
  return sql<CandidateRegistration[]>`
    SELECT
      cp.user_id::text AS user_id,
      cp.full_name,
      cp.date_of_birth::text AS date_of_birth,
      cp.candidate_number,
      cp.series,
      cp.sex,
      cp.certificate_number,
      cp.date_of_issue::text AS date_of_issue,
      cp.school_name,
      u.email,
      u.phone_e164,
      u.username,
      u.status AS account_status,
      u.created_at::text AS registered_at,
      es.name AS examination_name,
      es.year AS examination_year,
      es.status AS examination_status,
      ec.code AS centre_code,
      ec.name AS centre_name,
      cn.centre_number,
      COALESCE((
        SELECT json_agg(json_build_object(
          'code', s.code,
          'name', s.name,
          'amount_paid', csr.amount_paid::text
        ) ORDER BY s.name)
        FROM candidate_subject_registrations csr
        JOIN examination_subjects s ON s.id = csr.subject_id
        WHERE csr.user_id = cp.user_id
          AND csr.examination_session_id = cp.examination_session_id
      ), '[]'::json) AS subjects,
      payment.registration_fee,
      payment.franking_fee,
      payment.subjects_total,
      payment.total_amount,
      payment.payment_mode,
      payment.payment_status,
      payment.payment_reference,
      payment.created_at::text AS payment_created_at,
      COALESCE((
        SELECT json_agg(json_build_object(
          'consent_type', c.consent_type,
          'policy_version', c.policy_version,
          'accepted_at', c.accepted_at::text
        ) ORDER BY c.consent_type)
        FROM consents c
        WHERE c.user_id = cp.user_id
          AND c.consent_type IN ('terms', 'privacy')
      ), '[]'::json) AS consents
    FROM candidate_profiles cp
    JOIN users u ON u.id = cp.user_id
    JOIN examination_sessions es ON es.id = cp.examination_session_id
    JOIN examination_centres ec ON ec.id = cp.examination_centre_id
    LEFT JOIN centre_numbers cn ON cn.centre_id = ec.id
    LEFT JOIN candidate_registration_payments payment
      ON payment.user_id = cp.user_id
      AND payment.examination_session_id = cp.examination_session_id
    WHERE ${query} = ''
       OR cp.full_name ILIKE ${`%${query}%`}
       OR cp.candidate_number ILIKE ${`%${query}%`}
       OR COALESCE(u.email, '') ILIKE ${`%${query}%`}
       OR COALESCE(u.phone_e164, '') ILIKE ${`%${query}%`}
       OR COALESCE(cp.certificate_number, '') ILIKE ${`%${query}%`}
       OR COALESCE(cp.school_name, '') ILIKE ${`%${query}%`}
       OR es.name ILIKE ${`%${query}%`}
       OR ec.name ILIKE ${`%${query}%`}
    ORDER BY u.created_at DESC
    LIMIT 500
  `;
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
