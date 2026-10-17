import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import sql from './postgres';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const POLICY_VERSION = '2026-01';
const subjectSelectionSchema = z.array(z.string().uuid()).min(1, 'Select at least one subject.').max(20).refine((items) => new Set(items).size === items.length, 'A subject can only be selected once.');
const paymentModeSchema = z.enum(['mobile_money', 'orange_money']);
const usernameSchema = z.preprocess(
  (value) => typeof value === 'string' && !value.trim() ? undefined : value,
  z.string().trim().min(3, 'Username must contain at least 3 characters.').max(30, 'Username must contain at most 30 characters.').regex(/^[a-zA-Z0-9._-]+$/, 'Username may use only letters, numbers, dots, underscores, and hyphens.').optional(),
);

export const registrationSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  candidate_number: z.string().trim().regex(/^\d{9}$/, 'Candidate Identification Number must contain exactly 9 digits.'),
  centre_number: z.string().regex(/^\d{5}$/, 'Centre number must contain exactly 5 digits.'),
  examination_session_id: z.string().uuid(),
  examination_centre_id: z.string().uuid(),
  payment_mode: paymentModeSchema,
  subjects: subjectSelectionSchema,
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().min(7).max(30).optional().or(z.literal('')),
  username: usernameSchema,
  password: z.string().min(12).max(128).refine((value) => !['123456', 'password123', 'qwerty123456'].includes(value.toLowerCase()), 'Choose a less common password.'),
  confirm_password: z.string().min(1),
  terms_accepted: z.literal(true),
  privacy_accepted: z.literal(true),
}).superRefine((value, ctx) => {
  const birthDate = new Date(`${value.date_of_birth}T00:00:00Z`);
  if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date_of_birth'], message: 'Enter a valid date of birth.' });
  if (!value.email && !value.phone) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Enter an email address or phone number.' });
  if (value.candidate_number.slice(0, 5) !== value.centre_number) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['candidate_number'], message: 'CIN must start with the 5-digit centre number.' });
  if (value.password !== value.confirm_password) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirm_password'], message: 'Passwords do not match.' });
  if ([value.full_name, value.candidate_number, value.date_of_birth].some((part) => value.password.toLowerCase().includes(part.toLowerCase()))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'Choose a password that is not based on your personal details.' });
});

function normalizeName(value: string) { return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase(); }
function normalizeCandidate(value: string) { return value.normalize('NFKC').trim().replace(/\s+/g, '').toLocaleUpperCase(); }
function normalizePhone(value: string) { return value.replace(/[\s()-]/g, ''); }
function hash(value: string) { return crypto.createHash('sha256').update(value).digest('hex'); }
function createOtp() { return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0'); }
function maskDestination(value: string) { return value.includes('@') ? `${value.slice(0, 2)}***${value.slice(value.indexOf('@'))}` : `${value.slice(0, 3)}***${value.slice(-2)}`; }

async function sendOtp(channel: 'email' | 'sms', destination: string, code: string) {
  const verificationRequired = process.env.REGISTRATION_OTP_REQUIRED !== 'false';
  if (!verificationRequired && process.env.NODE_ENV !== 'production') return {};

  if (channel === 'email' && process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
    const fromName = process.env.SENDGRID_FROM_NAME || 'CertVerify';
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: destination }] }],
        from: { email: process.env.SENDGRID_FROM_EMAIL, name: fromName },
        subject: 'Your CertVerify verification code',
        content: [
          { type: 'text/plain', value: `Your CertVerify verification code is ${code}. It expires in 10 minutes.` },
          { type: 'text/html', value: `<p>Your CertVerify verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes.</p>` },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`[registration] SendGrid rejected OTP email with status ${response.status}`);
      throw new Error('Unable to send the verification email. Please try again later.');
    }
    return {};
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[registration] development OTP for ${channel} ${maskDestination(destination)}: ${code}`);
    return { debugCode: code };
  }
  throw new Error(channel === 'email'
    ? 'Email verification is not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL.'
    : 'Phone verification is not configured.');
}

export async function getRegistrationOptions() {
  const [sessions, centres, subjects] = await Promise.all([
    sql`SELECT id, name, year, registration_fee, franking_fee FROM examination_sessions WHERE status = 'open' AND (registration_opens_at IS NULL OR registration_opens_at <= now()) AND (registration_closes_at IS NULL OR registration_closes_at > now()) ORDER BY year DESC, name`,
    sql`SELECT id, code, name FROM examination_centres WHERE status = 'active' ORDER BY name`,
    sql`SELECT id, code, name, amount FROM examination_subjects WHERE status = 'active' ORDER BY name`,
  ]);
  return { sessions, centres, subjects };
}

export async function startRegistration(input: unknown, requestId: string, ip?: string, userAgent?: string) {
  const parsed = registrationSchema.parse(input);
  const email = parsed.email ? parsed.email.toLowerCase() : null;
  const phone = parsed.phone ? normalizePhone(parsed.phone) : null;
  const username = parsed.username ? parsed.username.toLowerCase() : null;
  const candidateNumber = normalizeCandidate(parsed.candidate_number);
  const centreNumber = parsed.centre_number;
  const birthDate = new Date(`${parsed.date_of_birth}T00:00:00Z`);
  if (birthDate > new Date()) throw new Error('Date of birth cannot be in the future.');

  const [sessionRows, centre, subjects, duplicates] = await Promise.all([
    sql`SELECT id, registration_fee FROM examination_sessions WHERE id = ${parsed.examination_session_id} AND status = 'open' AND (registration_opens_at IS NULL OR registration_opens_at <= now()) AND (registration_closes_at IS NULL OR registration_closes_at > now()) LIMIT 1`,
    sql`SELECT c.id, cn.id AS centre_number_id FROM examination_centres c JOIN centre_numbers cn ON cn.centre_id = c.id WHERE c.id = ${parsed.examination_centre_id} AND cn.centre_number = ${centreNumber} AND c.status = 'active' LIMIT 1`,
    sql`SELECT id, code, name, amount, paper_fee, practical_fee, practical_required FROM examination_subjects WHERE id = ANY(${parsed.subjects}::uuid[]) AND status = 'active'`,
    sql`SELECT u.id FROM users u LEFT JOIN candidate_profiles p ON p.user_id = u.id WHERE (CAST(${email} AS text) IS NOT NULL AND lower(u.email) = ${email}) OR (CAST(${phone} AS text) IS NOT NULL AND u.phone_e164 = ${phone}) OR (CAST(${username} AS text) IS NOT NULL AND lower(u.username) = ${username}) OR EXISTS (SELECT 1 FROM candidate_profiles cp WHERE cp.candidate_number_normalized = ${candidateNumber} AND cp.examination_session_id = ${parsed.examination_session_id}) LIMIT 1`,
  ]);
  if (!sessionRows.length) throw new Error('This examination session is not open for registration.');
  if (!centre.length) throw new Error('This examination centre is not available.');
  if (subjects.length !== parsed.subjects.length) throw new Error('One or more selected subjects are no longer available. Refresh and try again.');
  if (duplicates.length) throw new Error('A registration already exists for one or more of these details. Try signing in or contact support.');
  const registrationFee = Number(sessionRows[0].registration_fee);
  const frankingFee = Number(sessionRows[0].franking_fee);
  const centreNumberId = centre[0].centre_number_id;
  const subjectItems = subjects.map((subject) => ({ id: subject.id, code: subject.code, name: subject.name, amount: Number(subject.amount), paper_fee: Number(subject.paper_fee), practical_fee: Number(subject.practical_fee), practical_required: subject.practical_required }));
  const subjectsTotal = subjectItems.reduce((total, subject) => total + subject.amount, 0);

  const passwordHash = await bcrypt.hash(parsed.password, 12);
  const registrationKey = crypto.randomBytes(24).toString('base64url');
  const otp = createOtp();
  const channel = email ? 'email' : 'sms';
  const destination = email || phone!;
  const [registration] = await sql`
    INSERT INTO pending_registrations (registration_key, email, phone_e164, username, password_hash, registration_payload, expires_at)
    VALUES (${registrationKey}, ${email}, ${phone}, ${username}, ${passwordHash}, ${JSON.stringify({ full_name: parsed.full_name.trim(), full_name_normalized: normalizeName(parsed.full_name), date_of_birth: parsed.date_of_birth, candidate_number: parsed.candidate_number.trim(), candidate_number_normalized: candidateNumber, centre_number: centreNumber, centre_number_id: centreNumberId, examination_session_id: parsed.examination_session_id, examination_centre_id: parsed.examination_centre_id, subjects: subjectItems, registration_fee: registrationFee, franking_fee: frankingFee, subjects_total: subjectsTotal, total_amount: registrationFee + frankingFee + subjectsTotal, payment_mode: parsed.payment_mode, policy_version: POLICY_VERSION })}, ${new Date(Date.now() + OTP_TTL_MS)})
    RETURNING id`;
  await sql`INSERT INTO otp_challenges (registration_id, purpose, channel, destination_hash, code_hash, expires_at) VALUES (${registration.id}, 'registration', ${channel}, ${hash(destination)}, ${hash(otp)}, ${new Date(Date.now() + OTP_TTL_MS)})`;
  const delivery = await sendOtp(channel, destination, otp);
  await sql`INSERT INTO identity_events (registration_id, event_type, result, request_id, ip_hash) VALUES (${registration.id}, 'registration_started', 'otp_sent', ${requestId}, ${ip ? hash(ip) : null})`;
  return { registration_id: registrationKey, channel, masked_destination: maskDestination(destination), ...delivery };
}

export async function verifyRegistration(registrationKey: string, code: string, requestId: string, ip?: string, userAgent?: string) {
  const verificationRequired = process.env.REGISTRATION_OTP_REQUIRED !== 'false';
  if (verificationRequired && !/^[0-9]{6}$/.test(code)) throw new Error('Enter the six-digit verification code.');
  const rows = await sql`SELECT p.*, o.id AS otp_id, o.code_hash, o.expires_at AS otp_expires_at, o.attempts AS otp_attempts, o.consumed_at FROM pending_registrations p JOIN otp_challenges o ON o.registration_id = p.id WHERE p.registration_key = ${registrationKey} AND p.status = 'pending' ORDER BY o.created_at DESC LIMIT 1`;
  const pending = rows[0];
  if (!pending || new Date(pending.expires_at) <= new Date() || new Date(pending.otp_expires_at) <= new Date() || pending.consumed_at || pending.otp_attempts >= MAX_OTP_ATTEMPTS) throw new Error('This verification session has expired. Start registration again.');
  if (verificationRequired && hash(code) !== pending.code_hash) {
    await sql`UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ${pending.otp_id} AND attempts < ${MAX_OTP_ATTEMPTS}`;
    throw new Error('That code is incorrect. Check the message and try again.');
  }
  const payload = pending.registration_payload as { full_name: string; full_name_normalized: string; date_of_birth: string; candidate_number: string; candidate_number_normalized: string; centre_number_id: string; examination_session_id: string; examination_centre_id: string; subjects: { id: string; amount: number }[]; registration_fee: number; franking_fee: number; subjects_total: number; total_amount: number; payment_mode: 'mobile_money' | 'orange_money'; policy_version: string };
  const email = pending.email as string | null;
  const phone = pending.phone_e164 as string | null;
  const [user] = await sql.begin(async (tx) => {
    await tx`UPDATE otp_challenges SET consumed_at = now() WHERE id = ${pending.otp_id} AND consumed_at IS NULL`;
    const users = await tx`INSERT INTO users (name, email, phone_e164, username, password, role, status, created_at) VALUES (${payload.full_name}, ${email}, ${phone}, ${pending.username}, ${pending.password_hash}, 'citizen', 'active', now()) RETURNING id`;
    await tx`INSERT INTO candidate_profiles (user_id, full_name, full_name_normalized, date_of_birth, candidate_number, candidate_number_normalized, examination_session_id, examination_centre_id) VALUES (${users[0].id}, ${payload.full_name}, ${payload.full_name_normalized}, ${payload.date_of_birth}, ${payload.candidate_number}, ${payload.candidate_number_normalized}, ${payload.examination_session_id}, ${payload.examination_centre_id})`;
    await tx`INSERT INTO candidate_numbers (candidate_number, centre_number_id, user_id, examination_session_id) VALUES (${payload.candidate_number}, ${payload.centre_number_id}, ${users[0].id}, ${payload.examination_session_id})`;
    for (const subject of payload.subjects) await tx`INSERT INTO candidate_subject_registrations (user_id, subject_id, examination_session_id, amount_paid) VALUES (${users[0].id}, ${subject.id}, ${payload.examination_session_id}, ${subject.amount})`;
    await tx`INSERT INTO candidate_registration_payments (user_id, examination_session_id, registration_fee, franking_fee, subjects_total, total_amount, payment_mode, payment_status) VALUES (${users[0].id}, ${payload.examination_session_id}, ${payload.registration_fee}, ${payload.franking_fee}, ${payload.subjects_total}, ${payload.total_amount}, ${payload.payment_mode}, 'pending')`;
    await tx`INSERT INTO consents (user_id, registration_id, consent_type, policy_version, accepted_at, ip_hash, user_agent_hash) VALUES (${users[0].id}, ${pending.id}, 'terms', ${payload.policy_version}, now(), ${ip ? hash(ip) : null}, ${userAgent ? hash(userAgent) : null}), (${users[0].id}, ${pending.id}, 'privacy', ${payload.policy_version}, now(), ${ip ? hash(ip) : null}, ${userAgent ? hash(userAgent) : null})`;
    await tx`UPDATE pending_registrations SET status = 'completed', completed_at = now() WHERE id = ${pending.id}`;
    await tx`INSERT INTO identity_events (user_id, registration_id, event_type, result, request_id) VALUES (${users[0].id}, ${pending.id}, 'registration_verified', 'success', ${requestId})`;
    return users;
  });
  return { userId: user.id };
}

export async function resendRegistrationOtp(registrationKey: string, requestId: string) {
  const rows = await sql`SELECT p.id, p.email, p.phone_e164 FROM pending_registrations p WHERE p.registration_key = ${registrationKey} AND p.status = 'pending' AND p.expires_at > now() LIMIT 1`;
  if (!rows.length) throw new Error('This registration session has expired. Start again.');
  const destination = (rows[0].email || rows[0].phone_e164) as string;
  const channel = rows[0].email ? 'email' : 'sms';
  const otp = createOtp();
  await sql`UPDATE otp_challenges SET consumed_at = now() WHERE registration_id = ${rows[0].id} AND consumed_at IS NULL`;
  await sql`INSERT INTO otp_challenges (registration_id, purpose, channel, destination_hash, code_hash, expires_at) VALUES (${rows[0].id}, 'registration', ${channel}, ${hash(destination)}, ${hash(otp)}, ${new Date(Date.now() + OTP_TTL_MS)})`;
  const delivery = await sendOtp(channel, destination, otp);
  await sql`INSERT INTO identity_events (registration_id, event_type, result, request_id) VALUES (${rows[0].id}, 'otp_resent', 'sent', ${requestId})`;
  return { channel, masked_destination: maskDestination(destination), ...delivery };
}
