import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('mplad_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('mplad_token') || null;
  });

  const [isLoading, setIsLoading] = useState(true);

  // Sync to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('mplad_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('mplad_user');
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('mplad_token', token);
    } else {
      localStorage.removeItem('mplad_token');
    }
  }, [token]);

  // Verify session with backend to get authoritative server-verified role
  const verifyTokenWithServer = useCallback(async (activeToken: string) => {
    try {
      const res = await fetch('/api/auth/verify-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify({ token: activeToken })
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return data.user;
      } else {
        // Token invalid or expired
        setUser(null);
        setToken(null);
        return null;
      }
    } catch (e) {
      console.warn('Session verification warning:', e);
      return null;
    }
  }, []);

  // Initialize auth state and listen for Supabase OAuth / session changes
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        // 1. Check if Supabase has a session (e.g. from Google OAuth callback)
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.access_token) {
          if (isMounted) {
            setToken(session.access_token);
            await verifyTokenWithServer(session.access_token);
            setIsLoading(false);
          }
          return;
        }

        // 2. Fall back to existing token in localStorage
        const storedToken = localStorage.getItem('mplad_token');
        if (storedToken) {
          await verifyTokenWithServer(storedToken);
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    // 3. Listen to Supabase auth events (OAuth redirect, sign in, sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && session.access_token) {
        setToken(session.access_token);
        await verifyTokenWithServer(session.access_token);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setToken(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [verifyTokenWithServer]);

  // Email / Password Login
  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: password || 'DefaultPass#2024' })
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(data.token);
        setIsLoading(false);
        return { success: true };
      } else {
        const err = await res.json();
        setIsLoading(false);
        return { success: false, error: err.error || 'Authentication failed.' };
      }
    } catch (e: any) {
      setIsLoading(false);
      return { success: false, error: 'Network error communicating with authentication service.' };
    }
  };

  // User Registration / Sign-Up
  const signup = async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(data.token);
        setIsLoading(false);
        return { success: true };
      } else {
        const err = await res.json();
        setIsLoading(false);
        return { success: false, error: err.error || 'Registration failed.' };
      }
    } catch (e: any) {
      setIsLoading(false);
      return { success: false, error: 'Network error communicating with authentication service.' };
    }
  };

  // Google OAuth Sign-In via Supabase
  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard'
        }
      });
      if (error) {
        console.error('Google OAuth error:', error);
        throw error;
      }
    } catch (e) {
      console.error('Failed to initiate Google sign in:', e);
      throw e;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Ignore
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem('mplad_user');
    localStorage.removeItem('mplad_token');
  };

  const refreshSession = async () => {
    if (token) {
      await verifyTokenWithServer(token);
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        signup,
        loginWithGoogle,
        logout,
        refreshSession,
        isAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
