import crypto from 'node:crypto';
import { NextRequest } from 'next/server';

type WindowEntry = { count: number; resetAt: number };
const windows = new Map<string, WindowEntry>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

export function requestId(request: NextRequest) {
  return request.headers.get('x-request-id')?.slice(0, 100) || crypto.randomUUID();
}

export function clientAddress(request: NextRequest) {
  return (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown').slice(0, 120);
}

export function checkRateLimit(key: string, limit = MAX_REQUESTS) {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 60 };
  }
  current.count += 1;
  return { allowed: current.count <= limit, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

export function securityHeaders(id: string, retryAfter?: number) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Request-ID': id });
  if (retryAfter) headers.set('Retry-After', String(retryAfter));
  return headers;
}
