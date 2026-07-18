import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Auth from './pages/Auth';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';

function MainContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('auth');

  useEffect(() => {
    if (user) {
      setCurrentPage('dashboard');
    } else {
      setCurrentPage('auth');
    }
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem', background: 'var(--bg-page)' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'var(--odoo-violet)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          fontWeight: 800
        }}>
          E
        </div>
        <div style={{ fontWeight: 600, color: 'var(--odoo-violet)', fontSize: '1.1rem' }}>
          Loading EcoDrive Portal...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar onNavigate={setCurrentPage} currentPage={currentPage} />
      
      <main style={{ flex: 1, paddingBottom: '3rem' }}>
        {currentPage === 'auth' || !user ? (
          <Auth onNavigate={setCurrentPage} />
        ) : user.role === 'Company Administrator' ? (
          <AdminDashboard />
        ) : (
          <EmployeeDashboard />
        )}
      </main>

      <footer style={{
        background: '#fff',
        borderTop: '1px solid var(--border-color)',
        padding: '1.5rem',
        textAlign: 'center',
        fontSize: '0.85rem',
        color: 'var(--text-muted)'
      }}>
        EcoDrive Enterprise Carpooling Platform
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
