'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// Role hierarchy: superadmin > admin_negeri > admin_hq > pegawai_daerah > pegawai
export type UserRole = 'superadmin' | 'admin_negeri' | 'admin_hq' | 'pegawai_daerah' | 'pegawai';

export const ALL_ROLES: UserRole[] = ['superadmin', 'admin_negeri', 'admin_hq', 'pegawai_daerah', 'pegawai'];

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: '🔴 Super Admin',
  admin_negeri: '🟠 Admin Negeri',
  admin_hq: '🔵 Admin HQ',
  pegawai_daerah: '🟤 Pegawai Daerah',
  pegawai: '🟢 Pegawai',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  superadmin: 'bg-red-100 text-red-700',
  admin_negeri: 'bg-orange-100 text-orange-700',
  admin_hq: 'bg-blue-100 text-blue-700',
  pegawai_daerah: 'bg-amber-100 text-amber-700',
  pegawai: 'bg-green-100 text-green-700',
};

// Pages in the app
export const APP_PAGES = [
  { key: 'profil_kebun', label: 'Profil & Kebun', path: '/' },
  { key: 'kalkulator', label: 'Kalkulator (Usia & Fasa)', path: '/kalkulator' },
  { key: 'dashboard_hq', label: 'Dashboard HQ', path: '/dashboard-hq' },
  { key: 'laporan', label: 'Laporan & Infografik', path: '/laporan' },
  { key: 'profil', label: 'Profil Saya', path: '/profil' },
  { key: 'admin', label: 'Admin Panel', path: '/admin' },
] as const;

// Default page access per role
export const DEFAULT_PAGE_ACCESS: Record<string, UserRole[]> = {
  profil_kebun: ['superadmin', 'admin_negeri', 'admin_hq', 'pegawai_daerah', 'pegawai'],
  kalkulator: ['superadmin', 'admin_negeri', 'admin_hq', 'pegawai_daerah', 'pegawai'],
  dashboard_hq: ['superadmin', 'admin_negeri', 'admin_hq'],
  laporan: ['superadmin', 'admin_negeri', 'admin_hq', 'pegawai_daerah', 'pegawai'],
  profil: ['superadmin', 'admin_negeri', 'admin_hq', 'pegawai_daerah', 'pegawai'],
  admin: ['superadmin', 'admin_negeri'],
};

export interface UserProfile {
  uid: string;
  email: string;
  nama: string;
  noPerkerja: string;
  negeri: string;
  daerah: string;
  role: UserRole;
  alamatPejabat?: string;
  noTelefon?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isOnline: boolean;
  isSuperAdmin: boolean;
  isAdminNegeri: boolean;
  isAdminHQ: boolean;
  isAnyAdmin: boolean;
  canCreateUser: boolean;
  pageAccess: Record<string, UserRole[]>;
  hasPageAccess: (pageKey: string) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [pageAccess, setPageAccess] = useState<Record<string, UserRole[]>>(DEFAULT_PAGE_ACCESS);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  // Fetch page access settings from Firestore
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'pageAccess'));
        if (settingsDoc.exists()) {
          setPageAccess(settingsDoc.data() as Record<string, UserRole[]>);
        }
      } catch (e) {
        console.warn('Using default page access settings');
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              nama: data.nama || '',
              noPerkerja: data.noPerkerja || '',
              negeri: data.negeri || '',
              daerah: data.daerah || '',
              role: (data.role as UserRole) || 'pegawai',
            });
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  };

  const isSuperAdmin = profile?.role === 'superadmin';
  const isAdminNegeri = profile?.role === 'admin_negeri';
  const isAdminHQ = profile?.role === 'admin_hq';
  const isAnyAdmin = isSuperAdmin || isAdminNegeri;
  const canCreateUser = isSuperAdmin || isAdminNegeri;

  const hasPageAccess = (pageKey: string): boolean => {
    if (!profile) return false;
    if (isSuperAdmin) return true; // Super admin access all
    const allowedRoles = pageAccess[pageKey] || [];
    return allowedRoles.includes(profile.role);
  };

  return (
    <AuthContext.Provider value={{
      user, profile, loading, isOnline,
      isSuperAdmin, isAdminNegeri, isAdminHQ, isAnyAdmin, canCreateUser,
      pageAccess, hasPageAccess,
      signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
