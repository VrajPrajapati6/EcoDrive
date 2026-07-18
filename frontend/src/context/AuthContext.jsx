import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const token = localStorage.getItem('ecodrive_token');
      if (token) {
        try {
          const userData = await getMe();
          setUser(userData);
        } catch (error) {
          console.error('Failed to authenticate stored token:', error);
          localStorage.removeItem('ecodrive_token');
          setUser(null);
        }
      }
      setLoading(false);
    }
    initAuth();
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('ecodrive_token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('ecodrive_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
