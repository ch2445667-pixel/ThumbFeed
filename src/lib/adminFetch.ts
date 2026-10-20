import { auth } from './firebase';

/**
 * `fetch` that carries the signed-in owner's Firebase ID token.
 *
 * Mutating API routes now require proof that the caller is the owner. The
 * token is minted fresh per request (they expire after an hour), and a missing
 * user simply sends no token -- the server rejects it, which is the correct
 * outcome rather than a client-side guess.
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const user = auth.currentUser;
  let token = '';
  if (user) {
    try {
      token = await user.getIdToken();
    } catch {
      token = '';
    }
  }

  const headers = new Headers(init.headers);
  if (token) headers.set('x-admin-token', token);
  return fetch(input, { ...init, headers });
}
