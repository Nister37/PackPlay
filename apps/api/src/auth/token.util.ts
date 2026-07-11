import { randomBytes, createHash } from 'crypto';

/**
 * Generates a cryptographically secure random token.
 * Returns hex-encoded string (64 chars = 32 bytes of entropy).
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hashes a token with SHA-256 for secure storage.
 * Raw tokens are never stored in the database.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
