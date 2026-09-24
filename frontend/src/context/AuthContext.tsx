import { createContext, useContext, useState, ReactNode } from 'react';
import { api } from '../api/client';

export type Role = 'ADMIN' | 'PROFESSOR' | 'STUDENT';

export interface PecodUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  institutionId: string | null;
}

interface AuthContextValue {
  user: PecodUser | null;
  login: (email: string, password: string) => Promise<PecodUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PecodUser | null>(() => {
    const stored = localStorage.getItem('pecod_user');
    return stored ? JSON.parse(stored) : null;
  });

  // HU10: login con email/contraseña; el rol devuelto define a qué vista redirigir.
  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('pecod_token', data.accessToken);
    localStorage.setItem('pecod_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user as PecodUser;
  }

  function logout() {
    localStorage.removeItem('pecod_token');
    localStorage.removeItem('pecod_user');
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
