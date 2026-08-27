import bcrypt from 'bcrypt';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function GET(request: Request) {
  const token = process.env.SEED_TOKEN;
  if (!token) return Response.json({ error: 'SEED_TOKEN is not configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${token}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    await sql`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'citizen', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'citizen'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
    await sql`CREATE TABLE IF NOT EXISTS certificates (
      id UUID PRIMARY KEY, serial TEXT NOT NULL UNIQUE, holder_name TEXT NOT NULL,
      holder_email TEXT, type TEXT NOT NULL, issued_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ, signature TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
      revoked_at TIMESTAMPTZ, revoked_reason TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    for (const column of ['certificate_title TEXT', 'recipient_name TEXT', 'recipient_email TEXT', 'achievement TEXT', 'issue_date DATE', 'university_name TEXT', 'authorized_signature TEXT', 'official_stamp TEXT', 'signature_image TEXT', 'stamp_image TEXT']) {
      await sql.unsafe(`ALTER TABLE certificates ADD COLUMN IF NOT EXISTS ${column}`);
    }
    await sql`UPDATE certificates SET expires_at = NULL WHERE expires_at IS NOT NULL AND expires_at <= issued_at`;
    const password = await bcrypt.hash('123456', 12);
    await sql`INSERT INTO users (name, email, password, role)
      VALUES ('Administrator', 'user@nextmail.com', ${password}, 'admin')
      ON CONFLICT (email) DO UPDATE SET role = 'admin'`;
    await sql`CREATE TABLE IF NOT EXISTS certificate_audit_log (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), certificate_id UUID REFERENCES certificates(id) ON DELETE SET NULL,
      event TEXT NOT NULL, actor_id UUID NULL, result TEXT NULL, reason TEXT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    return Response.json({ message: 'Certificate service database seeded successfully' });
  } catch (error) {
    console.error('Seed failed:', error);
    return Response.json({ error: 'Database seed failed' }, { status: 500 });
  } finally {
    await sql.end();
  }
}
