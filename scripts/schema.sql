CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- The service is certificate-only. Legacy invoice tables, if present, are left
-- untouched so schema initialization remains non-destructive.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name VARCHAR(255) NOT NULL,
  email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'citizen' CHECK (role IN ('admin', 'citizen')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'citizen';
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_e164_idx ON users (phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username)) WHERE username IS NOT NULL;
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY,
  serial TEXT NOT NULL UNIQUE,
  holder_name TEXT NOT NULL,
  holder_email TEXT,
  type TEXT NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_reason TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE certificates ADD COLUMN IF NOT EXISTS certificate_title TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS recipient_email TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS achievement TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS issue_date DATE;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS university_name TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS authorized_signature TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS official_stamp TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS signature_image TEXT;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS stamp_image TEXT;

CREATE INDEX IF NOT EXISTS certificates_serial_idx ON certificates (serial);
CREATE INDEX IF NOT EXISTS certificates_status_idx ON certificates (status);
CREATE TABLE IF NOT EXISTS certificate_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), certificate_id UUID REFERENCES certificates(id) ON DELETE SET NULL,
  event TEXT NOT NULL CHECK (event IN ('issued', 'revoked', 'verified')), actor_id UUID NULL,
  result TEXT NULL, reason TEXT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS certificate_audit_created_at_idx ON certificate_audit_log (created_at DESC);

-- Production invariants and a dedicated, privacy-conscious verification event stream.
ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_status_check;
ALTER TABLE certificates ADD CONSTRAINT certificates_status_check CHECK (status IN ('active', 'revoked'));
ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_expiry_after_issue_check;
-- Validate new/updated rows immediately without rewriting legacy data. Existing
-- violations can be reviewed and cleaned up in a deliberate data migration.
ALTER TABLE certificates ADD CONSTRAINT certificates_expiry_after_issue_check CHECK (expires_at IS NULL OR expires_at > issued_at) NOT VALID;
CREATE INDEX IF NOT EXISTS certificates_recipient_name_idx ON certificates (lower(recipient_name));
CREATE TABLE IF NOT EXISTS certificate_verification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id UUID REFERENCES certificates(id) ON DELETE SET NULL,
  result TEXT NOT NULL CHECK (result IN ('valid', 'invalid', 'revoked', 'expired')),
  reason TEXT,
  request_id TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS certificate_verification_events_created_idx ON certificate_verification_events (created_at DESC);
CREATE INDEX IF NOT EXISTS certificate_verification_events_result_idx ON certificate_verification_events (result, created_at DESC);

CREATE TABLE IF NOT EXISTS examination_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  year INT NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
  registration_opens_at TIMESTAMPTZ,
  registration_closes_at TIMESTAMPTZ,
  registration_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (registration_fee >= 0),
  franking_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (franking_fee >= 0),
  UNIQUE (name, year)
);
ALTER TABLE examination_sessions ADD COLUMN IF NOT EXISTS registration_fee NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE examination_sessions ADD COLUMN IF NOT EXISTS franking_fee NUMERIC(12,2) NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS examination_centres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);
CREATE TABLE IF NOT EXISTS centre_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  centre_id UUID NOT NULL UNIQUE REFERENCES examination_centres(id) ON DELETE CASCADE,
  centre_number CHAR(5) NOT NULL UNIQUE CHECK (centre_number ~ '^[0-9]{5}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS candidate_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  full_name_normalized TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  candidate_number TEXT NOT NULL,
  candidate_number_normalized TEXT NOT NULL,
  examination_session_id UUID NOT NULL REFERENCES examination_sessions(id),
  examination_centre_id UUID NOT NULL REFERENCES examination_centres(id),
  series TEXT NOT NULL CHECK (series IN ('Arts', 'Science')),
  sex TEXT NOT NULL CHECK (sex IN ('MALE', 'FEMALE')),
  certificate_number TEXT NOT NULL CHECK (char_length(btrim(certificate_number)) >= 3),
  date_of_issue DATE NOT NULL,
  school_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_number_normalized, examination_session_id)
);
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS series TEXT;
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS certificate_number TEXT;
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS date_of_issue DATE;
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE candidate_profiles DROP CONSTRAINT IF EXISTS candidate_profiles_series_check;
ALTER TABLE candidate_profiles ADD CONSTRAINT candidate_profiles_series_check CHECK (series IS NULL OR series IN ('Arts', 'Science'));
ALTER TABLE candidate_profiles DROP CONSTRAINT IF EXISTS candidate_profiles_sex_check;
ALTER TABLE candidate_profiles ADD CONSTRAINT candidate_profiles_sex_check CHECK (sex IS NULL OR sex IN ('MALE', 'FEMALE'));
ALTER TABLE candidate_profiles DROP CONSTRAINT IF EXISTS candidate_profiles_certificate_number_check;
ALTER TABLE candidate_profiles ADD CONSTRAINT candidate_profiles_certificate_number_check CHECK (certificate_number IS NULL OR char_length(btrim(certificate_number)) >= 3);
CREATE TABLE IF NOT EXISTS examination_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  subject_group TEXT NOT NULL DEFAULT 'General',
  paper_fee NUMERIC(12,2) NOT NULL DEFAULT 2000 CHECK (paper_fee >= 0),
  practical_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (practical_fee >= 0),
  practical_required BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);
ALTER TABLE examination_subjects ADD COLUMN IF NOT EXISTS subject_group TEXT NOT NULL DEFAULT 'General';
ALTER TABLE examination_subjects ADD COLUMN IF NOT EXISTS paper_fee NUMERIC(12,2) NOT NULL DEFAULT 2000;
ALTER TABLE examination_subjects ADD COLUMN IF NOT EXISTS practical_fee NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE examination_subjects ADD COLUMN IF NOT EXISTS practical_required BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS candidate_subject_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES examination_subjects(id),
  examination_session_id UUID NOT NULL REFERENCES examination_sessions(id),
  amount_paid NUMERIC(12,2) NOT NULL CHECK (amount_paid >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_id, examination_session_id)
);
CREATE TABLE IF NOT EXISTS candidate_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_number CHAR(9) NOT NULL UNIQUE CHECK (candidate_number ~ '^[0-9]{9}$'),
  centre_number_id UUID NOT NULL REFERENCES centre_numbers(id),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  examination_session_id UUID NOT NULL REFERENCES examination_sessions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS candidate_registration_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  examination_session_id UUID NOT NULL REFERENCES examination_sessions(id),
  registration_fee NUMERIC(12,2) NOT NULL CHECK (registration_fee >= 0),
  franking_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (franking_fee >= 0),
  subjects_total NUMERIC(12,2) NOT NULL CHECK (subjects_total >= 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount = registration_fee + franking_fee + subjects_total),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partially_paid', 'waived')),
  payment_mode TEXT CHECK (payment_mode IN ('mobile_money', 'orange_money')),
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, examination_session_id)
);
ALTER TABLE candidate_registration_payments ADD COLUMN IF NOT EXISTS payment_mode TEXT;
ALTER TABLE candidate_registration_payments ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE candidate_registration_payments DROP CONSTRAINT IF EXISTS candidate_registration_payments_payment_mode_check;
ALTER TABLE candidate_registration_payments ADD CONSTRAINT candidate_registration_payments_payment_mode_check CHECK (payment_mode IS NULL OR payment_mode IN ('mobile_money', 'orange_money'));
ALTER TABLE candidate_registration_payments ADD COLUMN IF NOT EXISTS franking_fee NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE candidate_registration_payments DROP CONSTRAINT IF EXISTS candidate_registration_payments_check;
ALTER TABLE candidate_registration_payments DROP CONSTRAINT IF EXISTS candidate_registration_payments_total_amount_check;
ALTER TABLE candidate_registration_payments ADD CONSTRAINT candidate_registration_payments_total_amount_check CHECK (total_amount = registration_fee + franking_fee + subjects_total);
CREATE INDEX IF NOT EXISTS candidate_subjects_user_idx ON candidate_subject_registrations (user_id, examination_session_id);
CREATE TABLE IF NOT EXISTS pending_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_key TEXT NOT NULL UNIQUE,
  email TEXT,
  phone_e164 TEXT,
  username TEXT,
  password_hash TEXT NOT NULL,
  registration_payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled', 'locked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS otp_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL REFERENCES pending_registrations(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('registration', 'recovery', 'contact_change')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  destination_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_challenges_registration_idx ON otp_challenges (registration_id, created_at DESC);
CREATE TABLE IF NOT EXISTS consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES pending_registrations(id) ON DELETE SET NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('terms', 'privacy', 'communications')),
  policy_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash TEXT,
  user_agent_hash TEXT
);
CREATE TABLE IF NOT EXISTS identity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  registration_id UUID REFERENCES pending_registrations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  result TEXT NOT NULL,
  reason TEXT,
  request_id TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE identity_events ADD COLUMN IF NOT EXISTS ip_hash TEXT;
ALTER TABLE identity_events ADD COLUMN IF NOT EXISTS user_agent_hash TEXT;
CREATE INDEX IF NOT EXISTS identity_events_created_idx ON identity_events (created_at DESC);

INSERT INTO examination_sessions (name, year, status)
SELECT 'G.C.E. Ordinary Level', EXTRACT(YEAR FROM CURRENT_DATE)::INT, 'open'
WHERE NOT EXISTS (SELECT 1 FROM examination_sessions WHERE name = 'G.C.E. Ordinary Level' AND year = EXTRACT(YEAR FROM CURRENT_DATE)::INT);
UPDATE examination_sessions SET registration_fee = 9000.00, franking_fee = 1000.00 WHERE name = 'G.C.E. Advanced Level (General Education)' AND year = EXTRACT(YEAR FROM CURRENT_DATE)::INT;
INSERT INTO examination_sessions (name, year, status, registration_fee, franking_fee)
SELECT 'G.C.E. Advanced Level (General Education)', EXTRACT(YEAR FROM CURRENT_DATE)::INT, 'open', 9000.00, 1000.00
WHERE NOT EXISTS (SELECT 1 FROM examination_sessions WHERE name = 'G.C.E. Advanced Level (General Education)' AND year = EXTRACT(YEAR FROM CURRENT_DATE)::INT);
INSERT INTO examination_centres (code, name, status)
SELECT 'CENTRE-DEMO', 'Demo Examination Centre', 'active'
WHERE NOT EXISTS (SELECT 1 FROM examination_centres WHERE code = 'CENTRE-DEMO');
INSERT INTO examination_centres (code, name, status) VALUES
  ('12196', 'Cameroon GCE Centre 12196', 'active'),
  ('11389', 'Cameroon GCE Centre 11389', 'active'),
  ('11411', 'Cameroon GCE Centre 11411', 'active')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, status = 'active';
INSERT INTO centre_numbers (centre_id, centre_number)
SELECT id, code FROM examination_centres
WHERE code ~ '^[0-9]{5}$'
ON CONFLICT (centre_id) DO UPDATE SET centre_number = EXCLUDED.centre_number;
UPDATE examination_subjects SET status = 'inactive' WHERE code IN ('ENG', 'MATH', 'SCI', 'SOC');
INSERT INTO examination_subjects (code, name, amount, subject_group, paper_fee, practical_fee, practical_required, status)
VALUES
  ('ALE-ENG', 'English Language', 2000, 'Arts / Humanities', 2000, 0, false, 'active'),
  ('ALE-LIT', 'Literature in English', 2000, 'Arts / Humanities', 2000, 0, false, 'active'),
  ('ALE-FRE', 'French', 2000, 'Arts / Humanities', 2000, 0, false, 'active'),
  ('ALE-HIS', 'History', 2000, 'Arts / Humanities', 2000, 0, false, 'active'),
  ('ALE-GEO', 'Geography', 7000, 'Arts / Humanities', 2000, 5000, true, 'active'),
  ('ALE-ECO', 'Economics', 2000, 'Arts / Humanities', 2000, 0, false, 'active'),
  ('ALE-PHI', 'Philosophy', 2000, 'Arts / Humanities', 2000, 0, false, 'active'),
  ('ALE-REL', 'Religious Studies', 2000, 'Arts / Humanities', 2000, 0, false, 'active'),
  ('ALE-ACC', 'Accounting', 2000, 'Arts / Humanities', 2000, 0, false, 'active'),
  ('ALE-FSN', 'Food Science and Nutrition', 7000, 'Arts / Humanities', 2000, 5000, true, 'active'),
  ('ALE-BIO', 'Biology', 7000, 'Science', 2000, 5000, true, 'active'),
  ('ALE-CHE', 'Chemistry', 7000, 'Science', 2000, 5000, true, 'active'),
  ('ALE-PHY', 'Physics', 7000, 'Science', 2000, 5000, true, 'active'),
  ('ALE-PMM', 'Pure Mathematics with Mechanics', 2000, 'Science', 2000, 0, false, 'active'),
  ('ALE-PMS', 'Pure Mathematics with Statistics', 2000, 'Science', 2000, 0, false, 'active'),
  ('ALE-FMA', 'Further Mathematics', 2000, 'Science', 2000, 0, false, 'active'),
  ('ALE-GEOLOGY', 'Geology', 7000, 'Science', 2000, 5000, true, 'active'),
  ('ALE-CS', 'Computer Science', 7000, 'Science', 2000, 5000, true, 'active'),
  ('ALE-ICT', 'Information and Communication Technology (ICT)', 7000, 'Science', 2000, 5000, true, 'active'),
  ('ALE-SBEF', 'Special Bilingual Education French', 2000, 'Special Bilingual Education', 2000, 0, false, 'active')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, amount = EXCLUDED.amount, subject_group = EXCLUDED.subject_group, paper_fee = EXCLUDED.paper_fee, practical_fee = EXCLUDED.practical_fee, practical_required = EXCLUDED.practical_required, status = 'active';
