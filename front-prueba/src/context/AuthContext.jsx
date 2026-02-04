import { createContext, useContext, useState, useEffect } from 'react';
import { getToken, setToken, getUser, setUser } from '../api/api';
import { api } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(getUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) {
      api('GET', '/auth/profile')
        .then((r) => {
          const u = r?.data ?? null;
          setUser(u);
          setUserState(u);
        })
        .catch(() => {
          setToken('');
          setUser(null);
          setUserState(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    setToken(token);
    setUser(userData);
    setUserState(userData);
  };

  const logout = () => {
    setToken('');
    setUser(null);
    setUserState(null);
  };

  const refreshUser = async () => {
    const r = await api('GET', '/auth/profile');
    const u = r?.data ?? null;
    setUser(u);
    setUserState(u);
    return u;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
