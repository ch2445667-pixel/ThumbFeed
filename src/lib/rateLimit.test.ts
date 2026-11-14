import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit } from './rateLimit';

describe('rateLimit persistent window counters', () => {
  it('allows requests within quota, blocks excess, and resets after window expires', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thumbfeed-rl-'));
    const storeFile = path.join(tmpDir, 'rate-limits.json');
    const t0 = 1_750_000_000_000;

    try {
      const r1 = await checkRateLimit({ key: 'upload:1.2.3.4', limit: 2, windowMs: 60_000, filePath: storeFile, nowMs: t0 });
      assert.equal(r1.allowed, true);
      assert.equal(r1.remaining, 1);

      const r2 = await checkRateLimit({ key: 'upload:1.2.3.4', limit: 2, windowMs: 60_000, filePath: storeFile, nowMs: t0 + 1000 });
      assert.equal(r2.allowed, true);
      assert.equal(r2.remaining, 0);

      const r3 = await checkRateLimit({ key: 'upload:1.2.3.4', limit: 2, windowMs: 60_000, filePath: storeFile, nowMs: t0 + 2000 });
      assert.equal(r3.allowed, false);
      assert.ok(r3.retryAfterSeconds >= 58);

      const r4 = await checkRateLimit({ key: 'upload:1.2.3.4', limit: 2, windowMs: 60_000, filePath: storeFile, nowMs: t0 + 61_000 });
      assert.equal(r4.allowed, true);
      assert.equal(r4.remaining, 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
