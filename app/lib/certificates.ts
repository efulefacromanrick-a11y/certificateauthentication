import crypto from 'crypto';
import { z } from 'zod';
import {
  CertificateIssueRequest,
  CertificatePayload,
  CertificateVerifyResult,
} from './definitions';

import sql from './postgres';

const SECRET = process.env.CERT_SECRET;
if (!SECRET) {
  throw new Error('CERT_SECRET is required to sign certificates.');
}
const SIGNING_SECRET: string = SECRET;

const ADMIN_TOKEN = process.env.CERT_ADMIN_TOKEN ?? '';

export type VerificationContext = { requestId?: string; ip?: string; userAgent?: string };

function base64urlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4;
  const normalized = padding ? padded + '='.repeat(4 - padding) : padded;
  return Buffer.from(normalized, 'base64');
}

const PRIVATE_KEY_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const PUBLIC_KEY_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function privateKey() {
  return crypto.createPrivateKey({ key: Buffer.concat([PRIVATE_KEY_PREFIX, crypto.createHash('sha256').update(SIGNING_SECRET).digest()]), format: 'der', type: 'pkcs8' });
}

function publicKey() { return crypto.createPublicKey(privateKey()); }

function signMessage(message: string) {
  return base64urlEncode(crypto.sign(null, Buffer.from(message), privateKey()));
}

function verifySignature(encodedHeader: string, encodedPayload: string, signature: string) {
  return crypto.verify(null, Buffer.from(`${encodedHeader}.${encodedPayload}`), publicKey(), base64urlDecode(signature));
}

function encodeJws(payload: object) {
  const header = base64urlEncode(JSON.stringify({ alg: 'EdDSA', kid: 'issuer-key-v1', typ: 'JWT' }));
  const body = base64urlEncode(JSON.stringify(payload));
  const signature = signMessage(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

function decodeJws(jws: string) {
  try {
    const parts = jws.trim().split('.');
    if (parts.length !== 3 || parts.some((part) => !part || part.length > 3_500_000)) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const header = JSON.parse(base64urlDecode(encodedHeader).toString('utf-8')) as { alg?: string; kid?: string };
    if (header.alg !== 'EdDSA' || header.kid !== 'issuer-key-v1') return null;
    if (!verifySignature(encodedHeader, encodedPayload, signature)) return null;
    const decoded = base64urlDecode(encodedPayload).toString('utf-8');
    const payload = z.object({
      v: z.literal('1'),
      id: z.string().uuid(),
      serial: z.string().min(1),
      certificate_title: z.string().min(1),
      recipient_name: z.string().min(1),
      recipient_email: z.string().email().nullable(),
      candidate_number: z.string().min(1).optional(),
      examination_type: z.enum(['O/L', 'A/L']).optional(),
      examination_year: z.number().int().min(2000).max(2200).optional(),
      achievement: z.string().min(1),
      issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      university_name: z.string().min(1),
      authorized_signature: z.string().min(1),
      official_stamp: z.string().min(1),
      signature_image: z.string().regex(/^data:image\/(png|jpeg|jpg|webp);base64,/).max(2_500_000).nullable().optional(),
      stamp_image: z.string().regex(/^data:image\/(png|jpeg|jpg|webp);base64,/).max(2_500_000).nullable().optional(),
      issued_at: z.number().int().positive(),
      expires_at: z.number().int().positive().nullable(),
    }).parse(JSON.parse(decoded));
    return payload as CertificatePayload;
  } catch {
    return null;
  }
}

export function getCertificatePayloadFromSignature(jws: string) {
  return decodeJws(jws);
}

function createSerial() {
  return crypto.randomBytes(8).toString('base64').replace(/\+/g, '0').replace(/\//g, '0').slice(0, 12);
}

function normalizeExpiry(expiresAt?: string) {
  if (!expiresAt) {
    return null;
  }
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return Math.floor(date.getTime() / 1000);
}

export function getAdminToken() {
  return ADMIN_TOKEN;
}

function normalizeIssueDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid issue date');
  return Math.floor(date.getTime() / 1000);
}

export function getIssuerPublicKey() {
  const der = publicKey().export({ format: 'der', type: 'spki' }) as Buffer;
  return base64urlEncode(der.subarray(PUBLIC_KEY_PREFIX.length));
}

export function signJson(value: object) {
  const encoded = base64urlEncode(JSON.stringify(value));
  const header = base64urlEncode(JSON.stringify({ alg: 'EdDSA', kid: 'issuer-key-v1', typ: 'JWT' }));
  return `${header}.${encoded}.${signMessage(`${header}.${encoded}`)}`;
}

export async function issueCertificate(
  input: CertificateIssueRequest,
  createdBy?: string | null,
): Promise<{
  certificate: CertificatePayload;
  jws: string;
}> {
  const issuedAt = normalizeIssueDate(input.issue_date);
  const expiresAt = normalizeExpiry(input.expires_at);
  const certificate: CertificatePayload = {
    v: '1',
    id: crypto.randomUUID(),
    serial: createSerial(),
    certificate_title: input.certificate_title.trim(),
    recipient_name: input.recipient_name.trim(),
    recipient_email: input.recipient_email?.trim() ?? null,
    candidate_number: input.candidate_number.trim(),
    examination_type: input.examination_type,
    examination_year: input.examination_year,
    achievement: input.achievement.trim(),
    issue_date: input.issue_date,
    university_name: input.university_name.trim(),
    authorized_signature: input.authorized_signature.trim(),
    official_stamp: input.official_stamp.trim(),
    signature_image: input.signature_image ?? null,
    stamp_image: input.stamp_image ?? null,
    issued_at: issuedAt,
    expires_at: expiresAt,
  };

  const jws = encodeJws(certificate);

  await sql`
    INSERT INTO certificates (
      id,
      serial,
      holder_name,
      holder_email,
      type,
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
      issued_at,
      expires_at,
      signature,
      status,
      revoked_at,
      revoked_reason,
      created_by,
      created_at
    ) VALUES (
      ${certificate.id},
      ${certificate.serial},
      ${certificate.recipient_name},
      ${certificate.recipient_email},
      ${certificate.certificate_title},
      ${certificate.certificate_title},
      ${certificate.recipient_name},
      ${certificate.recipient_email},
      ${certificate.achievement},
      ${certificate.issue_date},
      ${certificate.university_name},
      ${certificate.authorized_signature},
      ${certificate.official_stamp},
      ${certificate.signature_image},
      ${certificate.stamp_image},
      to_timestamp(${certificate.issued_at}),
      ${certificate.expires_at ? new Date(certificate.expires_at * 1000) : null},
      ${jws},
      'active',
      null,
      null,
      ${createdBy ?? null},
      now()
    )
  `;

  await sql`INSERT INTO certificate_audit_log (certificate_id, event, actor_id)
    VALUES (${certificate.id}, 'issued', ${createdBy ?? null})`;

  return { certificate, jws };
}

export async function issueCandidateCertificate(
  input: {
    recipient_name: string;
    candidate_number: string;
    examination_type: 'O/L' | 'A/L';
    examination_year: number;
  },
  createdBy?: string | null,
) {
  const fullNameNormalized = input.recipient_name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const candidateNumberNormalized = input.candidate_number.normalize('NFKC').trim().replace(/\s+/g, '').toLocaleUpperCase();
  const examinationPattern = input.examination_type === 'O/L' ? '%ordinary%' : '%advanced%';
  const rows = await sql`
    SELECT
      cp.full_name,
      cp.candidate_number,
      cp.date_of_issue::text AS date_of_issue,
      u.email AS recipient_email,
      es.name AS examination_name,
      es.year AS examination_year
    FROM candidate_profiles cp
    JOIN users u ON u.id = cp.user_id
    JOIN examination_sessions es ON es.id = cp.examination_session_id
    WHERE cp.full_name_normalized = ${fullNameNormalized}
      AND cp.candidate_number_normalized = ${candidateNumberNormalized}
      AND es.year = ${input.examination_year}
      AND es.name ILIKE ${examinationPattern}
    LIMIT 2
  `;

  if (rows.length !== 1) return null;

  const candidate = rows[0];
  const issueDate = String(candidate.date_of_issue).slice(0, 10);
  const examinationName = String(candidate.examination_name);
  const certificateTitle = `GCE ${input.examination_year} ${input.examination_type === 'A/L' ? 'ADVANCED' : 'ORDINARY'} LEVEL`;

  return issueCertificate({
    certificate_title: certificateTitle,
    recipient_name: String(candidate.full_name),
    recipient_email: typeof candidate.recipient_email === 'string' ? candidate.recipient_email : undefined,
    candidate_number: String(candidate.candidate_number),
    examination_type: input.examination_type,
    examination_year: Number(candidate.examination_year),
    achievement: examinationName,
    issue_date: issueDate,
    university_name: 'CertVerify Examination Registry',
    authorized_signature: 'Digitally signed by CertVerify',
    official_stamp: 'Digitally authenticated examination record',
  }, createdBy);
}

export async function verifyCertificate(
  jws: string,
  context: VerificationContext = {},
): Promise<CertificateVerifyResult> {
  const payload = decodeJws(jws);
  if (!payload) {
    await recordVerification(null, 'invalid', 'signature_mismatch', context);
    return { status: 'invalid', reason: 'signature_mismatch' };
  }

  const rows = await sql`
    SELECT id, serial, signature, status, revoked_at, revoked_reason
    FROM certificates
    WHERE id = ${payload.id}
  `;

  const row = rows[0];
  if (!row) {
    await recordVerification(null, 'invalid', 'certificate_not_found', context);
    return { status: 'invalid', reason: 'certificate_not_found' };
  }

  if (row.signature !== jws) {
    await recordVerification(payload.id, 'invalid', 'payload_mismatch', context);
    return { status: 'invalid', reason: 'payload_mismatch' };
  }

  if (row.status === 'revoked') {
    await recordVerification(payload.id, 'revoked', 'revoked', context);
    return { status: 'revoked', reason: 'revoked' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.expires_at && payload.expires_at <= now) {
    await recordVerification(payload.id, 'expired', 'expired', context);
    return { status: 'expired', reason: 'expired', certificate: payload };
  }

  await recordVerification(payload.id, 'valid', undefined, context);
  return { status: 'valid', certificate: payload };
}

async function recordVerification(certificateId: string | null, result: CertificateVerifyResult['status'], reason: string | undefined, context: VerificationContext) {
  const hash = (value?: string) => value ? crypto.createHash('sha256').update(value).digest('hex') : null;
  await sql`INSERT INTO certificate_verification_events (certificate_id, result, reason, request_id, ip_hash, user_agent_hash)
    VALUES (${certificateId}, ${result}, ${reason ?? null}, ${context.requestId ?? 'unknown'}, ${hash(context.ip)}, ${hash(context.userAgent)})`;
  await sql`INSERT INTO certificate_audit_log (certificate_id, event, result, reason)
    VALUES (${certificateId}, 'verified', ${result}, ${reason ?? null})`;
}

export async function verifyCertificateByIdentifier(identifier: string, context: VerificationContext = {}) {
  const rows = await sql`
    SELECT signature
    FROM certificates
    WHERE id::text = ${identifier} OR serial = ${identifier}
    LIMIT 1
  `;

  if (!rows[0]?.signature) {
    const normalizedCandidateNumber = identifier.normalize('NFKC').trim().replace(/\s+/g, '').toUpperCase();
    const candidateRows = await sql`
      SELECT
        cp.user_id,
        cp.full_name,
        cp.candidate_number,
        cp.certificate_number,
        cp.date_of_issue,
        es.name AS examination_name,
        es.year AS examination_year
      FROM candidate_profiles cp
      JOIN examination_sessions es ON es.id = cp.examination_session_id
      WHERE cp.candidate_number_normalized = ${normalizedCandidateNumber}
        OR lower(btrim(cp.certificate_number)) = lower(${identifier.trim()})
      LIMIT 2
    `;

    if (candidateRows.length > 1) {
      await recordVerification(null, 'invalid', 'certificate_identifier_ambiguous', context);
      return { status: 'invalid' as const, reason: 'certificate_identifier_ambiguous' };
    }

    const candidate = candidateRows[0];
    if (!candidate) {
      await recordVerification(null, 'invalid', 'certificate_not_found', context);
      return { status: 'invalid' as const, reason: 'certificate_not_found' };
    }

    const examinationName = String(candidate.examination_name);
    const normalizedExaminationName = examinationName.toLowerCase();
    const examinationType = normalizedExaminationName.includes('ordinary') || /\bo\s*\/\s*l\b/i.test(examinationName)
      ? 'O/L'
      : normalizedExaminationName.includes('advanced') || /\ba\s*\/\s*l\b/i.test(examinationName)
        ? 'A/L'
        : undefined;
    const issueDate = new Date(`${String(candidate.date_of_issue).slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(issueDate.getTime())) {
      throw new Error('Candidate registry contains an invalid certificate issue date.');
    }

    const certificate = {
      id: String(candidate.user_id),
      serial: String(candidate.certificate_number),
      certificate_title: examinationName,
      recipient_name: String(candidate.full_name),
      candidate_number: String(candidate.candidate_number),
      examination_type: examinationType,
      examination_year: Number(candidate.examination_year),
      university_name: 'G.C.E. candidate registry',
      issued_at: Math.floor(issueDate.getTime() / 1000),
      expires_at: null,
    };

    await recordVerification(null, 'valid', undefined, context);
    return { status: 'valid' as const, certificate };
  }

  return verifyCertificate(rows[0].signature as string, context);
}

export async function revokeCertificate(id: string, reason?: string) {
  const result = await sql`
    UPDATE certificates
    SET status = 'revoked', revoked_at = now(), revoked_reason = ${reason ?? 'revoked'}
    WHERE id = ${id} AND status = 'active'
    RETURNING id
  `;

  if (result.length) {
    await sql`INSERT INTO certificate_audit_log (certificate_id, event, reason)
      VALUES (${id}, 'revoked', ${reason ?? 'revoked'})`;
  }

  return result.length > 0;
}
