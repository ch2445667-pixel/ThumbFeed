import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertResolvedPublicUrl, readResponseBufferWithLimit } from './ssrfFetch';
import { isSafeYouTubeUrl } from './urlSafety';

describe('ssrfFetch DNS and size limits', () => {
  it('blocks hostnames whose DNS resolves to private or loopback IPs (DNS rebinding guard)', async () => {
    await assert.rejects(
      () =>
        assertResolvedPublicUrl('https://rebind.example.com/videos', {
          lookupFn: async () => [{ address: '127.0.0.1', family: 4 }],
        }),
      /private or loopback/
    );

    await assert.rejects(
      () =>
        assertResolvedPublicUrl('https://metadata.example.com/latest', {
          lookupFn: async () => [{ address: '169.254.169.254', family: 4 }],
        }),
      /private or loopback/
    );
  });

  it('allows public hostnames resolving strictly to public IPs and passing domain check', async () => {
    const url = await assertResolvedPublicUrl('https://www.youtube.com/@mkbhd', {
      allowedUrlCheck: isSafeYouTubeUrl,
      lookupFn: async () => [{ address: '142.250.72.142', family: 4 }],
    });
    assert.equal(url.hostname, 'www.youtube.com');
  });

  it('enforces streaming response byte limits cleanly', async () => {
    const largeChunk = new Uint8Array(2048).fill(65);
    const mockRes = new Response(largeChunk, { status: 200 });
    await assert.rejects(() => readResponseBufferWithLimit(mockRes, 1024), /exceeds 1024 bytes/);
  });
});
