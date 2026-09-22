'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, signInWithGoogle, logout, onAuthStateChanged, User } from './firebase';

export const ADMIN_EMAIL = 'shivashiva66407@gmail.com';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  signIn: () => Promise<User | null>;
  signOut: () => Promise<void>;
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
  clearError: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
      if (authErr?.code === 'auth/popup-closed-by-user') {
        // User voluntarily dismissed popup
        return null;
      }
      if (authErr?.code === 'auth/popup-blocked') {
        setError('Sign-in pop-up was blocked by your browser. Please allow pop-ups for this site or open in a new tab.');
      } else if (authErr?.code === 'auth/cancelled-popup-request') {
        // Ignored
        return null;
      } else {
        setError(authErr?.message || 'Failed to sign in with Google');
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
    } catch (err: unknown) {
      const authErr = err as { message?: string };
      setError(authErr?.message || 'Failed to sign out');
    }
  }, []);

  const isAdmin = Boolean(
    user?.email && user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading,
        signingIn,
        error,
        signIn: handleSignIn,
        signOut: handleSignOut,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
