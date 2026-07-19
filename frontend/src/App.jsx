import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Auth from './pages/Auth';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';

function MainContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('auth');
  const [minSplashDone, setMinSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinSplashDone(true);
    }, 3500); // Match new animation duration
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user) {
      setCurrentPage('dashboard');
    } else {
      setCurrentPage('auth');
    }
  }, [user]);

  if (!minSplashDone || loading) {
    return (
      <div className="splash-container">
        <div className="splash-car"></div>
        <div className="splash-logo">Eco-Drive</div>
      </div>
    );
  }

  if (currentPage === 'auth' || !user) {
    return <Auth onNavigate={setCurrentPage} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar onNavigate={setCurrentPage} currentPage={currentPage} />
      
      <main style={{ flex: 1, paddingBottom: '3rem' }}>
        {user.role === 'Company Administrator' ? (
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
