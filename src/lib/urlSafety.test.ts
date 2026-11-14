import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPrivateOrLoopbackHostname,
  isSafeExternalHttpUrl,
  isSafeYouTubeUrl,
  isSafePinterestUrl,
  sanitizeMediaKey,
  isValidR2AccountId,
  isValidR2BucketName,
  sanitizeSafeHref,
  sanitizeSafeImageSrc,
} from './urlSafety';

describe('urlSafety SSRF protections', () => {
  it('blocks loopback, RFC1918, metadata, and integer IPs', () => {
    assert.equal(isPrivateOrLoopbackHostname('localhost'), true);
    assert.equal(isPrivateOrLoopbackHostname('127.0.0.1'), true);
    assert.equal(isPrivateOrLoopbackHostname('169.254.169.254'), true);
    assert.equal(isPrivateOrLoopbackHostname('10.0.0.1'), true);
    assert.equal(isPrivateOrLoopbackHostname('172.16.5.10'), true);
    assert.equal(isPrivateOrLoopbackHostname('192.168.1.50'), true);
    assert.equal(isPrivateOrLoopbackHostname('[::1]'), true);
    assert.equal(isPrivateOrLoopbackHostname('[::ffff:127.0.0.1]'), true);
    assert.equal(isPrivateOrLoopbackHostname('2130706433'), true);
    assert.equal(isPrivateOrLoopbackHostname('metadata.google.internal'), true);
    assert.equal(isPrivateOrLoopbackHostname('i.ytimg.com'), false);
  });

  it('validates external HTTP/HTTPS URLs and rejects embedded credentials', () => {
    assert.equal(isSafeExternalHttpUrl('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'), true);
    assert.equal(isSafeExternalHttpUrl('http://127.0.0.1:3000/api/r2/status'), false);
    assert.equal(isSafeExternalHttpUrl('http://169.254.169.254/latest/meta-data/'), false);
    assert.equal(isSafeExternalHttpUrl('https://user:pass@example.com/a.jpg'), false);
    assert.equal(isSafeExternalHttpUrl('file:///etc/passwd'), false);
    assert.equal(isSafeExternalHttpUrl('javascript:alert(1)'), false);
  });

  it('enforces YouTube and Pinterest domain allowlists', () => {
    assert.equal(isSafeYouTubeUrl('https://www.youtube.com/@mkbhd/videos'), true);
    assert.equal(isSafeYouTubeUrl('https://youtu.be/dQw4w9WgXcQ'), true);
    assert.equal(isSafeYouTubeUrl('https://evil.com/youtube.com'), false);

    assert.equal(isSafePinterestUrl('https://www.pinterest.com/pin/12345/'), true);
    assert.equal(isSafePinterestUrl('https://uk.pinterest.com/pin/12345/'), true);
    assert.equal(isSafePinterestUrl('https://pin.it/abc123'), true);
    assert.equal(isSafePinterestUrl('https://i.pinimg.com/736x/ab/cd/ef.jpg'), true);
    assert.equal(isSafePinterestUrl('http://127.0.0.1/pin/123'), false);
    assert.equal(isSafePinterestUrl('https://attacker.com/pinterest.com'), false);
  });
});

describe('sanitizeMediaKey', () => {
  it('blocks internal _app_data JSON and path traversal', () => {
    assert.equal(sanitizeMediaKey('_app_data/thumbnails.json'), null);
    assert.equal(sanitizeMediaKey('_app_data/user-profile.json'), null);
    assert.equal(sanitizeMediaKey('../_app_data/thumbnails.json'), null);
    assert.equal(sanitizeMediaKey('thumbnails/%2e%2e/_app_data/boards.json'), null);
    assert.equal(sanitizeMediaKey('thumbnails/photo.jpg\0.png'), null);
    assert.equal(sanitizeMediaKey('thumbnails/photo.html'), null);
    assert.equal(sanitizeMediaKey('thumbnails/vector.svg'), null);
    assert.equal(sanitizeMediaKey('thumbnails/vector.SVG'), null);
  });

  it('allows valid image keys', () => {
    assert.equal(sanitizeMediaKey('thumbnails/hero_abc12.jpg'), 'thumbnails/hero_abc12.jpg');
    assert.equal(sanitizeMediaKey('small/hero_abc12.webp'), 'small/hero_abc12.webp');
    assert.equal(sanitizeMediaKey('posters/poster_123.png'), 'posters/poster_123.png');
  });
});

describe('R2 credential and UI URL sanitizers', () => {
  it('validates Cloudflare R2 accountId and bucketName formats', () => {
    assert.equal(isValidR2AccountId('10f56e78581e96288edbb3e87d59bf87'), true);
    assert.equal(isValidR2AccountId('evil.com#@'), false);
    assert.equal(isValidR2BucketName('thumbfeed-bucket'), true);
    assert.equal(isValidR2BucketName('Invalid_Bucket/..'), false);
  });

  it('sanitizes clickable hrefs and image sources against XSS schemes', () => {
    assert.equal(sanitizeSafeHref('javascript:alert(1)'), undefined);
    assert.equal(sanitizeSafeHref('data:text/html,<script>alert(1)</script>'), undefined);
    assert.equal(sanitizeSafeHref('https://www.youtube.com/watch?v=abc'), 'https://www.youtube.com/watch?v=abc');
    assert.equal(sanitizeSafeHref('/api/media/thumb.jpg'), '/api/media/thumb.jpg');

    assert.equal(sanitizeSafeImageSrc('data:text/html,<svg onload=alert(1)>'), undefined);
    assert.equal(sanitizeSafeImageSrc('data:image/svg+xml;base64,PHN2Zz4='), undefined);
    assert.equal(sanitizeSafeImageSrc('data:image/png;base64,iVBORw0KGgo='), 'data:image/png;base64,iVBORw0KGgo=');
    assert.equal(sanitizeSafeImageSrc('/api/media/test.jpg'), '/api/media/test.jpg');
  });
});
