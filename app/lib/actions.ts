'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import sql from './postgres';
import bcrypt from 'bcrypt';
import { clearSession, getCurrentUserId, setSession, isAdmin } from './auth';
import { revokeCertificate } from './certificates';

export async function login(formData: FormData) {
  const email = z.string().trim().email().safeParse(formData.get('email'));
  const password = z.string().min(6).safeParse(formData.get('password'));
  if (!email.success || !password.success) redirect('/login?error=Invalid%20email%20or%20password');

  const users = await sql`SELECT id, password FROM users WHERE email = ${email.data.toLowerCase()} LIMIT 1`;
  const valid = users.length > 0 && await bcrypt.compare(password.data, users[0].password);
  if (!valid) redirect('/login?error=Invalid%20email%20or%20password');
  await setSession(users[0].id);
  const next = z.string().refine((value) => value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')).safeParse(formData.get('next'));
  redirect(next.success ? next.data : '/dashboard');
}

export async function signup(formData: FormData) {
  const name = z.string().trim().min(2).max(255).safeParse(formData.get('name'));
  const email = z.string().email().safeParse(formData.get('email'));
  const password = z.string().min(8).max(128).safeParse(formData.get('password'));
  if (!name.success || !email.success || !password.success) redirect('/signup?error=Invalid signup details');
  const normalizedEmail = email.data.toLowerCase();
  if ((await sql`SELECT id FROM users WHERE email = ${normalizedEmail} LIMIT 1`).length) redirect('/signup?error=Email already registered');
  const hash = await bcrypt.hash(password.data, 12);
  const rows = await sql`INSERT INTO users (name, email, password, role) VALUES (${name.data}, ${normalizedEmail}, ${hash}, 'citizen') RETURNING id`;
  await setSession(rows[0].id);
  redirect('/dashboard');
}

export async function logout() {
  await clearSession();
  redirect('/login');
}

export async function revokeCertificateAction(formData: FormData) {
  if (!(await isAdmin())) redirect('/login');
  const id = z.string().uuid().parse(formData.get('id'));
  const reason = z.string().max(280).optional().parse(formData.get('reason') || undefined);
  const revoked = await revokeCertificate(id, reason);
  if (!revoked) throw new Error('Certificate not found or already revoked.');
  revalidatePath('/dashboard/certificates');
}
