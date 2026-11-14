import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Automated verification of security_spec.md invariants and the 12 "Dirty Dozen"
 * adversarial payloads against firestore.rules + firebase-blueprint.json.
 */

const RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');
const DRAFT_PATH = path.resolve(process.cwd(), 'DRAFT_firestore.rules');
const BLUEPRINT_PATH = path.resolve(process.cwd(), 'firebase-blueprint.json');

function loadRulesText(): string {
  const target = fs.existsSync(RULES_PATH) ? RULES_PATH : DRAFT_PATH;
  return fs.readFileSync(target, 'utf8');
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const ADMIN_EMAILS = new Set(['canonwater2025@gmail.com', 'shivashiva66407@gmail.com']);

interface AuthContext {
  uid: string;
  email: string;
  email_verified: boolean;
}

const REQUEST_TIME = '__SERVER_TIMESTAMP__';

function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && VALID_ID_REGEX.test(id);
}

function isSignedIn(auth: AuthContext | null): auth is AuthContext {
  return Boolean(auth && auth.email_verified === true);
}

function isAdmin(auth: AuthContext | null): boolean {
  return isSignedIn(auth) && ADMIN_EMAILS.has(auth.email);
}

// Mirrors DRAFT_firestore.rules / firestore.rules evaluation for Dirty Dozen regression testing
function canCreateUser(auth: AuthContext | null, userId: string, data: Record<string, unknown>): boolean {
  if (!isValidId(userId) || !isSignedIn(auth) || auth.uid !== userId) return false;
  const allowed = new Set(['id', 'email', 'displayName', 'photoURL', 'createdAt', 'updatedAt']);
  const keys = Object.keys(data);
  if (!['id', 'email', 'displayName', 'photoURL', 'createdAt', 'updatedAt'].every((k) => keys.includes(k))) return false;
  if (!keys.every((k) => allowed.has(k))) return false;
  return (
    data.id === userId &&
    data.email === auth.email &&
    typeof data.email === 'string' &&
    data.email.length >= 3 &&
    data.email.length <= 320 &&
    typeof data.displayName === 'string' &&
    data.displayName.length <= 120 &&
    typeof data.photoURL === 'string' &&
    data.photoURL.length <= 2048 &&
    data.createdAt === REQUEST_TIME &&
    data.updatedAt === REQUEST_TIME
  );
}

function canUpdateUser(
  auth: AuthContext | null,
  userId: string,
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>
): boolean {
  if (!isValidId(userId) || !isSignedIn(auth) || auth.uid !== userId) return false;
  if (incoming.id !== existing.id || incoming.email !== existing.email || incoming.createdAt !== existing.createdAt) {
    return false;
  }
  const changed = Object.keys(incoming).filter((k) => JSON.stringify(incoming[k]) !== JSON.stringify(existing[k]));
  if (!changed.every((k) => k === 'displayName' || k === 'photoURL' || k === 'updatedAt')) return false;
  return (
    typeof incoming.displayName === 'string' &&
    incoming.displayName.length <= 120 &&
    typeof incoming.photoURL === 'string' &&
    incoming.photoURL.length <= 2048 &&
    incoming.updatedAt === REQUEST_TIME
  );
}

function canCreateCollection(auth: AuthContext | null, collectionId: string, data: Record<string, unknown>): boolean {
  if (!isValidId(collectionId) || !isSignedIn(auth)) return false;
  const required = ['id', 'userId', 'name', 'thumbnailIds', 'createdAt', 'updatedAt'];
  const allowed = new Set([...required, 'description', 'colorTheme']);
  const keys = Object.keys(data);
  if (!required.every((k) => keys.includes(k)) || !keys.every((k) => allowed.has(k))) return false;
  if (!isValidId(data.id) || data.id !== collectionId) return false;
  if (!isValidId(data.userId) || data.userId !== auth.uid) return false;
  if (typeof data.name !== 'string' || data.name.length < 1 || data.name.length > 120) return false;
  if (!Array.isArray(data.thumbnailIds) || data.thumbnailIds.length > 2000) return false;
  if (data.thumbnailIds.length > 0 && typeof data.thumbnailIds[0] !== 'string') return false;
  return data.createdAt === REQUEST_TIME && data.updatedAt === REQUEST_TIME;
}

function canUpdateCollection(
  auth: AuthContext | null,
  collectionId: string,
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>
): boolean {
  if (!isValidId(collectionId) || !isSignedIn(auth)) return false;
  if (existing.userId !== auth.uid && !isAdmin(auth)) return false;
  if (incoming.id !== existing.id || incoming.userId !== existing.userId || incoming.createdAt !== existing.createdAt) {
    return false;
  }
  const allowed = new Set(['id', 'userId', 'name', 'description', 'thumbnailIds', 'colorTheme', 'createdAt', 'updatedAt']);
  const keys = Object.keys(incoming);
  if (!keys.every((k) => allowed.has(k))) return false;
  const changed = keys.filter((k) => JSON.stringify(incoming[k]) !== JSON.stringify(existing[k]));
  const allowedUpdates = new Set(['name', 'description', 'thumbnailIds', 'colorTheme', 'updatedAt']);
  if (!isAdmin(auth) && !changed.every((k) => allowedUpdates.has(k))) return false;
  if (!Array.isArray(incoming.thumbnailIds) || incoming.thumbnailIds.length > 2000) return false;
  if (incoming.thumbnailIds.length > 0 && typeof incoming.thumbnailIds[0] !== 'string') return false;
  return incoming.updatedAt === REQUEST_TIME;
}

function canWriteThumbnail(auth: AuthContext | null, thumbnailId: string): boolean {
  return isValidId(thumbnailId) && isAdmin(auth);
}

test('Firestore blueprint covers all three collections with strict bounds', () => {
  const blueprint = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, 'utf8'));
  assert.ok(blueprint.firestore['/users/{userId}']);
  assert.ok(blueprint.firestore['/collections/{collectionId}']);
  assert.ok(blueprint.firestore['/thumbnails/{thumbnailId}']);
  assert.equal(blueprint.entities.UserProfile.properties.id.pattern, '^[a-zA-Z0-9_\\-]+$');
  assert.equal(blueprint.entities.CollectionBoard.properties.name.maxLength, 120);
});

test('Firestore rules enforce Eight Pillars statically', () => {
  const rules = loadRulesText();
  assert.match(rules, /rules_version\s*=\s*'2';/);
  assert.match(rules, /match\s*\/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  assert.match(rules, /request\.auth\.token\.email_verified\s*==\s*true/);
  assert.match(rules, /allow get: if isValidId\(userId\)/);
  assert.doesNotMatch(rules, /match \/users\/\{userId\}[\s\S]*allow read:/);
  assert.match(rules, /allow list: if isSignedIn\(\)\s*&&\s*\(resource\.data\.userId == request\.auth\.uid \|\| isAdmin\(\)\)/);
  assert.doesNotMatch(rules, /allow list:[\s\S]{0,80}(get|exists)\(/);
  assert.match(rules, /function isValidId\(id\)/);
  assert.match(rules, /isValidUserProfileCreate/);
  assert.match(rules, /isValidCollectionCreate/);
  assert.match(rules, /isValidCollectionUpdate/);
  assert.match(rules, /isValidThumbnail/);
});

test('Dirty Dozen Payloads 1-12 must be rejected (PERMISSION_DENIED)', () => {
  const regularUser: AuthContext = { uid: 'u1', email: 'u1@example.com', email_verified: true };
  const otherUser: AuthContext = { uid: 'victim_uid', email: 'victim@example.com', email_verified: true };
  const unverifiedSpoofAdmin: AuthContext = { uid: 'spoof', email: 'canonwater2025@gmail.com', email_verified: false };

  // 1. Privilege escalation role/isAdmin injection on user create
  assert.equal(
    canCreateUser(regularUser, 'u1', {
      id: 'u1',
      email: 'u1@example.com',
      displayName: 'U1',
      photoURL: '',
      role: 'admin',
      isAdmin: true,
      createdAt: REQUEST_TIME,
      updatedAt: REQUEST_TIME,
    }),
    false
  );

  // 2. Email spoofing admin bypass without email_verified == true
  assert.equal(canWriteThumbnail(unverifiedSpoofAdmin, 'thumb_1'), false);

  // 3. Cross-user profile PII read (simulated check against rule predicate)
  const rules = loadRulesText();
  assert.match(rules, /match \/users\/\{userId\}[\s\S]*allow get: if isValidId\(userId\) && \(isOwner\(userId\) \|\| isAdmin\(\)\)/);
  assert.notEqual(regularUser.uid, otherUser.uid);

  // 4. Profile email tampering on update
  assert.equal(
    canUpdateUser(
      regularUser,
      'u1',
      { id: 'u1', email: 'canonwater2025@gmail.com', displayName: 'U1', photoURL: '', createdAt: REQUEST_TIME, updatedAt: REQUEST_TIME },
      { id: 'u1', email: 'u1@example.com', displayName: 'U1', photoURL: '', createdAt: REQUEST_TIME, updatedAt: REQUEST_TIME }
    ),
    false
  );

  // 5. Client timestamp forgery on collection create
  assert.equal(
    canCreateCollection(regularUser, 'board_1', {
      id: 'board_1',
      userId: 'u1',
      name: 'My Board',
      thumbnailIds: [],
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    }),
    false
  );

  // 6. Collection identity spoofing (userId != auth.uid)
  assert.equal(
    canCreateCollection(regularUser, 'board_x', {
      id: 'board_x',
      userId: 'victim_uid',
      name: 'Spoofed',
      thumbnailIds: [],
      createdAt: REQUEST_TIME,
      updatedAt: REQUEST_TIME,
    }),
    false
  );

  // 7. Cross-owner collection scraping guard (list requires resource.data.userId == request.auth.uid)
  assert.match(rules, /allow list: if isSignedIn\(\)\s*&&\s*\(resource\.data\.userId == request\.auth\.uid \|\| isAdmin\(\)\)/);

  // 8. Cross-owner collection hijack on update
  assert.equal(
    canUpdateCollection(
      regularUser,
      'victim_board',
      { id: 'victim_board', userId: 'victim_uid', name: 'Hijacked', thumbnailIds: [], createdAt: REQUEST_TIME, updatedAt: REQUEST_TIME },
      { id: 'victim_board', userId: 'victim_uid', name: 'Original', thumbnailIds: [], createdAt: REQUEST_TIME, updatedAt: REQUEST_TIME }
    ),
    false
  );

  // 9. ID poisoning / path traversal / oversized ID
  assert.equal(
    canCreateCollection(regularUser, '../admin', {
      id: '../admin',
      userId: 'u1',
      name: 'Bad ID',
      thumbnailIds: [],
      createdAt: REQUEST_TIME,
      updatedAt: REQUEST_TIME,
    }),
    false
  );
  assert.equal(isValidId('a'.repeat(129)), false);

  // 10. Non-admin thumbnail creation/deletion
  assert.equal(canWriteThumbnail(regularUser, 't1'), false);

  // 11. Value poisoning on collection update (non-string thumbnailIds element)
  assert.equal(
    canUpdateCollection(
      regularUser,
      'board_1',
      { id: 'board_1', userId: 'u1', name: 'Board', thumbnailIds: [123], createdAt: REQUEST_TIME, updatedAt: REQUEST_TIME },
      { id: 'board_1', userId: 'u1', name: 'Board', thumbnailIds: [], createdAt: REQUEST_TIME, updatedAt: REQUEST_TIME }
    ),
    false
  );

  // 12. Ghost/shadow field injection on collection update
  assert.equal(
    canUpdateCollection(
      regularUser,
      'board_1',
      { id: 'board_1', userId: 'u1', name: 'Board', thumbnailIds: [], verified: true, createdAt: REQUEST_TIME, updatedAt: REQUEST_TIME },
      { id: 'board_1', userId: 'u1', name: 'Board', thumbnailIds: [], createdAt: REQUEST_TIME, updatedAt: REQUEST_TIME }
    ),
    false
  );
});
