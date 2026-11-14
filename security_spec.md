# Security Specification — ThumbFeed Firestore Rules

## 1. Data Invariants

1. **Default-Deny Baseline**: Every path not explicitly matched is denied for both read and write (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Identity**: All authenticated mutations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Admin Allowlist With Verified Email**: Only verified admin emails (`canonwater2025@gmail.com`, `shivashiva66407@gmail.com`) with `email_verified == true` qualify for `isAdmin()`. Unverified tokens claiming an admin email are rejected.
4. **PII Isolation (`/users/{userId}`)**:
   - No `list` access is granted on `/users` (only `get`, `create`, `update`, `delete` for `isOwner(userId) || isAdmin()`).
   - Creation requires exact allowed keys (`id`, `email`, `displayName`, `photoURL`, `createdAt`, `updatedAt`), `id == userId`, `email == request.auth.token.email`, bounded string sizes, and server timestamp (`createdAt == request.time && updatedAt == request.time`).
   - Updates forbid modifying `id`, `email`, or `createdAt`, allow only `['displayName', 'photoURL', 'updatedAt']`, and enforce `updatedAt == request.time`.
   - Privilege/shadow fields (`role`, `isAdmin`, `plan`, `verified`) are rejected by `hasOnly(...)`.
5. **Owner-Isolated Boards (`/collections/{collectionId}`)**:
   - `get` and `delete` require `isSignedIn() && isValidId(collectionId) && (existing().userId == request.auth.uid || isAdmin())`.
   - `list` enforces `isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin())` directly against `resource.data` without `get()` lookups or client delegation.
   - `create` enforces `incoming().userId == request.auth.uid`, exact key allowlist (`id`, `userId`, `name`, `description`, `thumbnailIds`, `colorTheme`, `createdAt`, `updatedAt`), `thumbnailIds.size() <= 2000`, string bounds, `id == collectionId`, and `createdAt == request.time && updatedAt == request.time`.
   - `update` forbids changing `id`, `userId`, or `createdAt`, validates schema via `isValidCollectionBoardUpdate(incoming())`, restricts modified fields to `['name', 'description', 'thumbnailIds', 'colorTheme', 'updatedAt']`, and checks `updatedAt == request.time`.
6. **Public Gallery / Admin-Only Writes (`/thumbnails/{thumbnailId}`)**:
   - Public `get` and `list` are allowed (`if true;`).
   - `create`, `update`, and `delete` require `isAdmin() && isValidId(thumbnailId)`, bounded strings/arrays, and server timestamp integrity (`createdAt`/`updatedAt == request.time`).
7. **ID Poisoning Guard**: Every single-doc `get`, `create`, `update`, `delete` enforces `isValidId(docId)` (`1 <= size <= 128` and `^[a-zA-Z0-9_\-]+$`).

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)

1. **Privilege Escalation on User Create (`/users/u1`)**:
   `{"id":"u1","email":"u1@example.com","displayName":"U1","photoURL":"","role":"admin","isAdmin":true,"createdAt":"REQUEST_TIME","updatedAt":"REQUEST_TIME"}`
2. **Email Spoofing Admin Bypass (`email_verified: false`, email = `canonwater2025@gmail.com`)**:
   Write to `/thumbnails/thumb_1` with `{"id":"thumb_1","title":"X","imageUrl":"https://i.ytimg.com/vi/abc12345678/hqdefault.jpg","createdAt":"REQUEST_TIME","updatedAt":"REQUEST_TIME"}`
3. **Cross-User Profile PII Read (`GET /users/victim_uid` as `attacker_uid`)**:
   Unprivileged user attempts `get` or `list` on another user's `/users` document.
4. **Profile Email Tampering on Update (`/users/u1`)**:
   `{"id":"u1","email":"canonwater2025@gmail.com","displayName":"U1","photoURL":"","createdAt":"ORIG_TIME","updatedAt":"REQUEST_TIME"}`
5. **Client Timestamp Forgery (`/users/u1` or `/collections/board_1`)**:
   `{"id":"board_1","userId":"u1","name":"My Board","thumbnailIds":[],"createdAt":"2020-01-01T00:00:00Z","updatedAt":"2020-01-01T00:00:00Z"}`
6. **Collection Identity Spoofing (`create /collections/board_x` with `userId: "victim_uid"`)**:
   `{"id":"board_x","userId":"victim_uid","name":"Spoofed","thumbnailIds":[],"createdAt":"REQUEST_TIME","updatedAt":"REQUEST_TIME"}`
7. **Cross-Owner Collection Scraping (`LIST /collections` without `where('userId', '==', uid)`)**:
   Signed-in non-admin runs `getDocs(collection(db, 'collections'))` to scrape all boards.
8. **Cross-Owner Collection Hijack (`update /collections/victim_board`)**:
   Non-owner updates `name` or reassigns `userId` on someone else's board.
9. **ID Poisoning / Path Traversal (`create /collections/..%2Fadmin` or 500-char ID)**:
   Document ID fails `^[a-zA-Z0-9_\-]+$` or exceeds 128 characters.
10. **Non-Admin Thumbnail Creation/Deletion (`create` or `delete /thumbnails/t1` by ordinary signed-in user)**:
    Verified regular user writes `{"id":"t1","title":"Spam","imageUrl":"https://example.com/a.jpg","createdAt":"REQUEST_TIME","updatedAt":"REQUEST_TIME"}`.
11. **Value Poisoning on Collection Update (`thumbnailIds` > 2000 items or non-string element `[123]`)**:
    `{"id":"board_1","userId":"u1","name":"Board","thumbnailIds":[123],"createdAt":"ORIG_TIME","updatedAt":"REQUEST_TIME"}`
12. **Ghost/Shadow Field Injection on Collection Update**:
    `{"id":"board_1","userId":"u1","name":"Board","thumbnailIds":[],"verified":true,"createdAt":"ORIG_TIME","updatedAt":"REQUEST_TIME"}`
