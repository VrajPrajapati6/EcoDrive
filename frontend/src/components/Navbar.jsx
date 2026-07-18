import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Building2, UserCheck, Shield } from 'lucide-react';

export default function Navbar({ onNavigate, currentPage }) {
  const { user, logout } = useAuth();

  return (
    <nav className="odoo-navbar">
      <a 
        href="#" 
        className="odoo-navbar-brand"
        onClick={(e) => {
          e.preventDefault();
          onNavigate(user ? 'dashboard' : 'auth');
        }}
      >
        <div className="odoo-navbar-logo-icon">E</div>
        <span>EcoDrive</span>
      </a>

      <div className="odoo-navbar-links">
        {user ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.12)', padding: '0.35rem 0.85rem', borderRadius: '6px' }}>
              <Building2 size={16} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {user.organization?.name || 'My Organization'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {user.role === 'Company Administrator' ? (
                <Shield size={16} color="#ffd700" />
              ) : (
                <UserCheck size={16} />
              )}
              <span style={{ fontSize: '0.9rem' }}>{user.fullName}</span>
              <span style={{
                fontSize: '0.7rem',
                background: user.role === 'Company Administrator' ? 'rgba(255, 215, 0, 0.25)' : 'rgba(255,255,255,0.2)',
                padding: '0.15rem 0.5rem',
                borderRadius: '12px',
                fontWeight: 600
              }}>
                {user.role === 'Company Administrator' ? 'Admin' : 'Employee'}
              </span>
            </div>

            <button 
              onClick={() => {
                logout();
                onNavigate('auth');
              }}
              className="btn btn-outline-white"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            >
              <LogOut size={14} />
              <span>Log Out</span>
            </button>
          </>
        ) : (
          <>
            <span 
              onClick={() => onNavigate('auth')} 
              className="odoo-nav-link"
              style={{ fontWeight: currentPage === 'auth' ? 700 : 500 }}
            >
              Authentication
            </span>
          </>
        )}
      </div>
    </nav>
  );
}
