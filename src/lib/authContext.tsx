'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  auth,
  signInWithGoogle,
  logout,
  onAuthStateChanged,
  getFirebaseIdToken,
  User
} from './firebase';

export const ADMIN_EMAILS = ['canonwater2025@gmail.com', 'shivashiva66407@gmail.com'];
export const ADMIN_EMAIL = 'canonwater2025@gmail.com';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  signIn: () => Promise<User | null>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  signingIn: false,
  error: null,
  signIn: async () => null,
  signOut: async () => {},
  getIdToken: async () => null,
  clearError: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleSignIn = useCallback(async (): Promise<User | null> => {
    setSigningIn(true);
    setError(null);
    try {
      const signedInUser = await signInWithGoogle();
      return signedInUser;
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      if (authErr?.code === 'auth/popup-closed-by-user' || authErr?.code === 'auth/cancelled-popup-request') {
        return null;
      }
      if (authErr?.code === 'auth/popup-blocked') {
        setError('Sign-in pop-up was blocked by your browser. Please allow pop-ups for this site or open in a new tab.');
      } else if (authErr?.code === 'auth/unauthorized-domain') {
        setError('Sign-in is not enabled for this domain yet.');
      } else {
        setError('Failed to sign in with Google. Please try again.');
      }
      return null;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const handleSignOut = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await logout();
    } catch {
      setError('Failed to sign out. Please try again.');
    }
  }, []);

  const isAdmin = Boolean(
    user?.email &&
    user.emailVerified !== false &&
    ADMIN_EMAILS.some((e) => e.toLowerCase() === user.email?.trim().toLowerCase())
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading: !mounted || loading,
        signingIn,
        error,
        signIn: handleSignIn,
        signOut: handleSignOut,
        getIdToken: getFirebaseIdToken,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
