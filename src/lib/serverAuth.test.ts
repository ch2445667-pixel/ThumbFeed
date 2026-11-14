import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_EMAILS,
  isAdminEmail,
  isValidFirebaseUid,
  verifyJwtWithCerts,
} from './serverAuth';

// Generate an ephemeral RSA keypair and self-signed cert in memory purely for unit testing RS256 verification.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

const exportedPub = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signTestJwt(
  payload: Record<string, unknown>,
  headerOverrides: Record<string, unknown> = {}
): string {
  const header = { alg: 'RS256', kid: 'test-kid-1', typ: 'JWT', ...headerOverrides };
  const h = b64url(header);
  const p = b64url(payload);
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${h}.${p}`);
  signer.end();
  const sig = signer
    .sign(privateKey)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${h}.${p}.${sig}`;
}

describe('serverAuth JWT & RBAC', () => {
  const now = 1_750_000_000;
  const projectId = 'alien-memento-jkm1r';
  const basePayload = {
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: 'user_abc_123',
    auth_time: now - 60,
    iat: now - 30,
    exp: now + 3600,
    email: ADMIN_EMAILS[0],
    email_verified: true,
    name: 'Admin User',
  };

  const certs = { 'test-kid-1': exportedPub };

  it('accepts a valid Firebase ID token', () => {
    const token = signTestJwt(basePayload);
    const verified = verifyJwtWithCerts(token, certs, { nowSeconds: now, projectId });
    assert.ok(verified);
    assert.equal(verified.uid, 'user_abc_123');
    assert.equal(verified.email, ADMIN_EMAILS[0]);
    assert.equal(isAdminEmail(verified.email), true);
  });

  it('rejects expired tokens, wrong audience, unverified email, and bad signatures', () => {
    const expired = signTestJwt({ ...basePayload, exp: now - 10 });
    assert.equal(verifyJwtWithCerts(expired, certs, { nowSeconds: now, projectId }), null);

    const wrongAud = signTestJwt({ ...basePayload, aud: 'other-project' });
    assert.equal(verifyJwtWithCerts(wrongAud, certs, { nowSeconds: now, projectId }), null);

    const unverifiedEmail = signTestJwt({ ...basePayload, email_verified: false });
    assert.equal(verifyJwtWithCerts(unverifiedEmail, certs, { nowSeconds: now, projectId }), null);

    const wrongAlg = signTestJwt(basePayload, { alg: 'HS256' });
    assert.equal(verifyJwtWithCerts(wrongAlg, certs, { nowSeconds: now, projectId }), null);

    const tamperedParts = signTestJwt(basePayload).split('.');
    const tamperedPayload = b64url({ ...basePayload, sub: 'victim_uid' });
    const forged = `${tamperedParts[0]}.${tamperedPayload}.${tamperedParts[2]}`;
    assert.equal(verifyJwtWithCerts(forged, certs, { nowSeconds: now, projectId }), null);
  });

  it('validates UID format and admin allowlist cleanly', () => {
    assert.equal(isValidFirebaseUid('uid_123-ABC'), true);
    assert.equal(isValidFirebaseUid('../etc/passwd'), false);
    assert.equal(isValidFirebaseUid(''), false);

    assert.equal(isAdminEmail('CanonWater2025@gmail.com'), true);
    assert.equal(isAdminEmail('randomuser@gmail.com'), false);
  });
});
