import { createContext, useContext, useState, useEffect } from 'react';
import { api, setCsrfToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then((data) => {
        setUser(data.user);
        if (data.csrfToken) setCsrfToken(data.csrfToken);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setUser(data.user);
    // Fetch CSRF token after login (new session)
    try {
      const me = await api.get('/auth/me');
      if (me.csrfToken) setCsrfToken(me.csrfToken);
    } catch (_) {}
    return data.user;
  };

  const register = async (email, password, name, ownerType) => {
    const data = await api.post('/auth/register', { email, password, name, owner_type: ownerType });
    setUser(data.user);
    try {
      const me = await api.get('/auth/me');
      if (me.csrfToken) setCsrfToken(me.csrfToken);
    } catch (_) {}
    return data.user;
  };

  const refreshUser = async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
    } catch (_) {}
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    setCsrfToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
