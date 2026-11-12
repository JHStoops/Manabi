import { COMMON_PASSWORDS } from './commonPasswords';
import { requiredRole } from './guard';
import {
  hashPassword,
  needsRehash,
  passwordProblem,
  verifyDummyPassword,
  verifyPassword,
} from './passwords';
import { hashToken, newToken } from './tokens';

// NFR-10, SDD section 11
describe('password hashing', () => {
  it('produces salted Argon2id PHC strings that verify', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword(a, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(a, 'correct horse batterY')).toBe(false);
    expect(needsRehash(a)).toBe(false);
  });

  it('treats a malformed hash as no match', async () => {
    expect(await verifyPassword('not a hash', 'x')).toBe(false);
  });

  it('flags hashes made with other parameters for rehashing', () => {
    expect(needsRehash('$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA')).toBe(
      true,
    );
  });

  it('checks a dummy hash for unknown accounts', async () => {
    expect(await verifyDummyPassword('anything')).toBe(false);
  });
});

describe('passwordProblem', () => {
  it('accepts an ordinary passphrase', () => {
    expect(passwordProblem('violet tram at dusk', 'hana')).toBeNull();
  });

  it.each(['1234567890', 'Password123', 'QWERTYUIOP'])('rejects the common password %s', (p) => {
    expect(passwordProblem(p, 'hana')).toMatch(/too common/);
  });

  it('rejects the username, ignoring case', () => {
    expect(passwordProblem('HanakoTaro', 'hanakotaro')).toMatch(/username/);
  });

  it('ships a list of lower-case entries of at least 10 characters', () => {
    expect(COMMON_PASSWORDS.length).toBeGreaterThan(2000);
    for (const p of COMMON_PASSWORDS) {
      expect(p.length).toBeGreaterThanOrEqual(10);
      expect(p).toBe(p.toLowerCase());
    }
  });
});

describe('tokens', () => {
  it('are 256-bit base64url strings stored as 64-hex SHA-256 digests', () => {
    const token = newToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('requiredRole (FR-006)', () => {
  it.each([
    ['/api/v1/admin', 'admin'],
    ['/api/v1/admin/users', 'admin'],
    ['/api/v1/authoring/items/:id', 'admin'],
    ['/api/v1/administrators', undefined],
    ['/api/v1/me', undefined],
  ])('%s needs %s', (url, role) => {
    expect(requiredRole(url)).toBe(role);
  });

  it('lets a route name its own role', () => {
    expect(requiredRole('/api/v1/me', 'admin')).toBe('admin');
  });
});
