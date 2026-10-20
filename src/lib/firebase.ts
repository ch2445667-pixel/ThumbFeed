import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Suggest account selection prompt
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (user) {
      try {
        // Loaded on demand: the Firestore SDK is large and only a signed-in
        // owner ever needs it. Importing it at module scope made every
        // anonymous visitor download it to render the gallery.
        const { getFirestore, doc, setDoc } = await import('firebase/firestore');
        const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          id: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          lastLoginAt: new Date().toISOString()
        }, { merge: true });
      } catch (profileErr) {
        console.warn('Firestore profile sync note:', profileErr);
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

export { onAuthStateChanged };
export type { User };
