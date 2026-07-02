'use client';

// ──────────────────────────────────────────────
// EduPay — Auth Context
// ──────────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';
import type { School } from '@/types';

// ── Context shape ────────────────────────────

interface AuthContextValue {
  user: User | null;
  school: School | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ─────────────────────────────────

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Skip auth listener during SSR / prerender when Firebase isn't configured
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    const db = getFirebaseDb();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Set auth-token cookie for proxy
        const idToken = await firebaseUser.getIdToken();
        document.cookie = `auth-token=${idToken}; path=/; max-age=3600; SameSite=Strict`;

        // Fetch school document
        try {
          const schoolDoc = await getDoc(
            doc(db, 'schools', firebaseUser.uid)
          );
          if (schoolDoc.exists()) {
            setSchool(schoolDoc.data() as School);
          } else {
            setSchool(null);
          }
        } catch {
          setSchool(null);
        }
      } else {
        // Clear cookie when not authenticated
        document.cookie = 'auth-token=; path=/; max-age=0';
        setSchool(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
    document.cookie = 'auth-token=; path=/; max-age=0';
    setSchool(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, school, loading, signOut: handleSignOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────

function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      'useAuth must be used within an <AuthProvider>. ' +
        'Wrap your component tree with <AuthProvider> in the root layout.'
    );
  }
  return context;
}

export { AuthContext, AuthProvider, useAuth };
