/**
 * Input validation, character sanitization, and security utilities.
 * Defense-in-depth: enforces client-side hygiene while the database enforces authoritative integrity.
 */

// Basic email RFC-compliant pattern preventing ReDoS
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Standard UUIDv4 pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateEmail(email: string | null | undefined): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email address is required.' };
  }

  const trimmed = email.trim();
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email address exceeds maximum length.' };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  return { valid: true };
}

export function validatePassword(password: string | null | undefined): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }

  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters.' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password exceeds maximum length (128 characters).' };
  }

  return { valid: true };
}

export function validateUUID(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Strips dangerous HTML tags and script elements to eliminate XSS vectors
 */
export function sanitizeString(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // Strip brackets
    .slice(0, 1000); // Prevent buffer/payload flooding
}

/**
 * Sanitizes uploaded file names to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed_file';
  // Remove directory traversal characters and non-alphanumeric (except dots, dashes, underscores)
  const cleaned = filename
    .replace(/^.*[\\/]/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100);
  return cleaned || 'file';
}

/**
 * Lightweight client-side attempt throttle
 * Deterrent against automated rapid-fire button clicking (Backend rate limiting remains authoritative)
 */
export class ClientRateLimiter {
  private attempts: number[] = [];
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  check(): { allowed: boolean; retryAfterSec?: number } {
    const now = Date.now();
    this.attempts = this.attempts.filter((ts) => now - ts < this.windowMs);

    if (this.attempts.length >= this.maxAttempts) {
      const oldestAttempt = this.attempts[0];
      const retryAfterSec = Math.ceil((oldestAttempt + this.windowMs - now) / 1000);
      return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
    }

    this.attempts.push(now);
    return { allowed: true };
  }

  reset(): void {
    this.attempts = [];
  }
}
