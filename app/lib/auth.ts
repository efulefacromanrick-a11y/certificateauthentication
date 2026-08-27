import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import sql from './postgres';

const SESSION_COOKIE = 'cert_session';

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error('AUTH_SECRET environment variable is required.');
  return value;
}

function sign(value: string) {
  return crypto.createHmac('sha256', secret()).update(value).digest('hex');
}

export function createSession(userId: string) {
  const payload = `${userId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSession(value?: string) {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [userId, issuedAt, signature] = parts;
  const payload = `${userId}.${issuedAt}`;
  if (!/^\d+$/.test(issuedAt)) return false;
  if (Date.now() - Number(issuedAt) > 1000 * 60 * 60 * 24 * 7) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function getSessionUserId(value?: string) {
  if (!isValidSession(value)) return null;
  return value!.split('.')[0];
}

export async function hasSession() {
  return Boolean(getSessionUserId((await cookies()).get(SESSION_COOKIE)?.value));
}

export async function getCurrentUserId() {
  return getSessionUserId((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function getCurrentUser() {
  const id = await getCurrentUserId();
  if (!id) return null;
  const rows = await sql<{ id: string; name: string; email: string; role: 'admin' | 'citizen' }[]>`
    SELECT id, name, email, role FROM users WHERE id = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function isAdmin() { return (await getCurrentUser())?.role === 'admin'; }

export async function setSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, createSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
