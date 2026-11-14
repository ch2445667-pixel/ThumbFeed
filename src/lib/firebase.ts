import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  try {
    const current = auth.currentUser;
    if (!current) return null;
    return await current.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (user) {
      const userPath = `users/${user.uid}`;
      try {
        const [{ doc, getDoc, setDoc, updateDoc, serverTimestamp }, { db }] = await Promise.all([
          import('firebase/firestore'),
          import('./firestore'),
        ]);
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        const safeDisplayName = (user.displayName || '').slice(0, 120);
        const safePhotoURL = (user.photoURL || '').slice(0, 2048);
        if (!snap.exists()) {
          await setDoc(userRef, {
            id: user.uid,
            email: (user.email || '').slice(0, 320),
            displayName: safeDisplayName,
            photoURL: safePhotoURL,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(userRef, {
            displayName: safeDisplayName,
            photoURL: safePhotoURL,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (profileErr) {
        try {
          handleFirestoreError(profileErr, OperationType.WRITE, userPath);
        } catch (wrapped) {
          console.warn('Firestore profile sync note:', wrapped);
        }
      }
    }
    return user;
  } catch (error: unknown) {
    console.error('Google sign-in error:', error);
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: unknown) {
    console.error('Sign-out error:', error);
    throw error;
  }
}

export async function deleteCurrentUserAccount(): Promise<void> {
  const current = auth.currentUser;
  if (!current) {
    throw new Error('You must be signed in to delete your account.');
  }

  const uid = current.uid;
  const token = await current.getIdToken(true);

  const serverRes = await fetch('/api/profile', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!serverRes.ok) {
    const errData = await serverRes.json().catch(() => ({}));
    throw new Error(errData?.error || 'Failed to delete server profile and boards.');
  }

  // Delete Firestore user-owned collections and user profile document
  try {
    const [{ collection, query, where, getDocs, deleteDoc, doc }, { db }] = await Promise.all([
      import('firebase/firestore'),
      import('./firestore'),
    ]);
    const colQuery = query(collection(db, 'collections'), where('userId', '==', uid));
    const snap = await getDocs(colQuery);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'collections', d.id));
    }
    await deleteDoc(doc(db, 'users', uid));
  } catch (fsErr) {
    try {
      handleFirestoreError(fsErr, OperationType.DELETE, `users/${uid}`);
    } catch (wrapped) {
      console.warn('Firestore account cleanup warning:', wrapped);
    }
  }

  // Delete Firebase Auth identity
  try {
    await deleteUser(current);
  } catch (authErr: unknown) {
    const code = (authErr as { code?: string })?.code;
    if (code === 'auth/requires-recent-login') {
      await reauthenticateWithPopup(current, googleProvider);
      await deleteUser(current);
    } else {
      throw authErr;
    }
  }

  // Clear local browser data belonging to the deleted user
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('thumbvault_collections_v2000');
      localStorage.removeItem('thumbfeed_profile_v1');
      localStorage.removeItem('thumbvault_yt_metadata_cache_v2');
    } catch {}
  }
}

export { onAuthStateChanged };
export type { User };
