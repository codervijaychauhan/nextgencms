import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from './lib/firebase';
import { api } from './lib/api';

interface UserProfile {
  uid: string;
  id?: string;
  username: string;
  name?: string;
  email: string | null;
  role: string;
  createdAt?: unknown;
  bio?: string;
  profilePicture?: string;
  disabled?: boolean;
  permissions?: Record<string, string>;
  rights?: Record<string, string>;
  assigned_booths?: string[];
  boothId?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (moduleId: string, right: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyProfile = (data: UserProfile, email?: string | null) => {
    setProfile(data);
    const userEmail = (email || data.email || '').toLowerCase();
    const isSuper = data.role === 'super_admin' || userEmail === 'vijaychauhanofficial01@gmail.com';
    const isMngr = data.role === 'admin' || data.role === 'manager';
    setIsAdmin(isSuper);
    setIsManager(isMngr);
    setIsStaff(isSuper || isMngr);
  };

  const fetchProfile = async (currentUser: User) => {
    try {
      const data = await api.post<UserProfile>('/api/auth/sync', {
        name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User'
      });

      if (data.disabled) {
        await firebaseSignOut(auth);
        localStorage.removeItem('nextgen_local_token');
        setProfile(null);
        setIsAdmin(false);
        setIsManager(false);
        setIsStaff(false);
        setUser(null);
        return;
      }

      applyProfile(data, currentUser.email);
    } catch (error) {
      console.error('Error syncing SQL profile:', error);
      // Fallback local profile if backend is initializing
      const userEmail = (currentUser.email || '').toLowerCase();
      const isSuperAdmin = userEmail === 'vijaychauhanofficial01@gmail.com';
      const fallback: UserProfile = {
        uid: currentUser.uid,
        username: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        email: currentUser.email,
        role: isSuperAdmin ? 'super_admin' : 'guest',
        permissions: isSuperAdmin ? { voters: 'vcud', users: 'vcud', demographics: 'vcud', mandals: 'vcud' } : {}
      };
      applyProfile(fallback, currentUser.email);
    }
  };

  const checkLocalAuth = async () => {
    const localToken = localStorage.getItem('nextgen_local_token');
    if (localToken) {
      try {
        const data = await api.get<UserProfile>('/api/auth/me');
        if (data && !data.disabled) {
          applyProfile(data, data.email);
          return true;
        }
      } catch (err) {
        console.warn('Local session invalid or expired:', err);
        localStorage.removeItem('nextgen_local_token');
      }
    }
    return false;
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    } else {
      await checkLocalAuth();
    }
  };

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        const hasLocal = await checkLocalAuth();
        if (!hasLocal && isMounted) {
          setProfile(null);
          setIsAdmin(false);
          setIsManager(false);
          setIsStaff(false);
        }
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    localStorage.removeItem('nextgen_local_token');
    try {
      await firebaseSignOut(auth);
    } catch {}
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setIsManager(false);
    setIsStaff(false);
  };

  const hasPermission = (moduleId: string, right: string) => {
    if (isAdmin) return true;
    const perms = profile?.permissions?.[moduleId] || profile?.rights?.[moduleId] || '';
    return perms.includes(right);
  };

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, isManager, isStaff, loading, signOut, refreshProfile, hasPermission }}>
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
