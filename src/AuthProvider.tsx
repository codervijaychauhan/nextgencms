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

  const fetchProfile = async (currentUser: User) => {
    try {
      const data = await api.post<UserProfile>('/api/auth/sync', {
        name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User'
      });

      if (data.disabled) {
        await firebaseSignOut(auth);
        setProfile(null);
        setIsAdmin(false);
        setIsManager(false);
        setIsStaff(false);
        setUser(null);
        return;
      }

      setProfile(data);
      const isSuper = data.role === 'super_admin' || currentUser.email === 'vijaychauhanofficial01@gmail.com';
      const isMngr = data.role === 'admin' || data.role === 'manager';
      setIsAdmin(isSuper);
      setIsManager(isMngr);
      setIsStaff(isSuper || isMngr);
    } catch (error) {
      console.error('Error syncing SQL profile:', error);
      // Fallback local profile if backend is initializing
      const isSuperAdmin = currentUser.email === 'vijaychauhanofficial01@gmail.com';
      setProfile({
        uid: currentUser.uid,
        username: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        email: currentUser.email,
        role: isSuperAdmin ? 'super_admin' : 'guest',
        permissions: isSuperAdmin ? { voters: 'vcud', users: 'vcud', demographics: 'vcud', mandals: 'vcud' } : {}
      });
      setIsAdmin(isSuperAdmin);
      setIsStaff(isSuperAdmin);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setIsManager(false);
        setIsStaff(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
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
