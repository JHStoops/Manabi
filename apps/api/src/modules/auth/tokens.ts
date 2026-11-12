import { createHash, randomBytes } from 'node:crypto';

/**
 * NFR-10: session, invite and reset tokens are 256 random bits, sent to the client as 43
 * base64url characters and stored only as the lowercase hex SHA-256 of that string (the 64-hex
 * CHECK on every token_hash column).
 *
 * A plain hash, not an HMAC with SESSION_SECRET: the token already carries 256 bits of entropy,
 * so a leaked database gives nothing to brute-force, and a plain digest keeps every session and
 * invite valid if the secret is ever rotated.
 */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
