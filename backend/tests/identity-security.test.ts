import assert from 'node:assert/strict';
import test from 'node:test';
import {
  encryptMfaSecret,
  decryptMfaSecret,
  generateMfaSecret,
  generateTotpCode,
  verifyTotpCode,
  buildOtpAuthUri,
} from '../src/security/identityService.js';

test('MFA secret encryption round-trip', () => {
  const secret = generateMfaSecret();
  const encrypted = encryptMfaSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptMfaSecret(encrypted), secret);
});

test('TOTP code generation and verification', () => {
  const secret = generateMfaSecret();
  const code = generateTotpCode(secret);
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyTotpCode(secret, code), true);
  assert.equal(verifyTotpCode(secret, '000000'), false);
});

test('otpauth URI includes email and secret', () => {
  const secret = generateMfaSecret();
  const uri = buildOtpAuthUri('user@example.com', secret);
  assert.ok(uri.startsWith('otpauth://totp/'));
  assert.ok(uri.includes(secret));
});
