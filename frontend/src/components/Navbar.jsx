import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onNavigate, currentPage }) {
  const { user, logout } = useAuth();

  return (
    <nav className="odoo-navbar" style={{ background: '#000000', borderBottom: '4px solid var(--odoo-teal)' }}>
      <a 
        href="#" 
        className="odoo-navbar-brand"
        onClick={(e) => {
          e.preventDefault();
          onNavigate(user ? 'dashboard' : 'auth');
        }}
        style={{ letterSpacing: '2px', textTransform: 'uppercase' }}
      >
        <div className="odoo-navbar-logo-icon" style={{ borderRadius: '0', background: 'var(--odoo-teal)', color: '#ffffff' }}>E</div>
        <span style={{ fontWeight: 900 }}>EcoDrive</span>
      </a>

      <div className="odoo-navbar-links">
        {user ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#222222', padding: '0.5rem 1rem', border: '1px solid #444444' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {user.organization?.name || 'My Organization'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase' }}>{user.fullName}</span>
              <span style={{
                fontSize: '0.7rem',
                background: 'var(--odoo-teal)',
                color: '#ffffff',
                padding: '0.2rem 0.5rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                {user.role === 'Company Administrator' ? 'ADMIN' : 'EMPLOYEE'}
              </span>
            </div>

            <button 
              onClick={() => {
                logout();
                onNavigate('auth');
              }}
              className="btn btn-outline-white"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}
            >
              <span>LOG OUT</span>
            </button>
          </>
        ) : (
          <>
            <span 
              onClick={() => onNavigate('auth')} 
              className="odoo-nav-link"
              style={{ fontWeight: currentPage === 'auth' ? 800 : 600, textTransform: 'uppercase', letterSpacing: '1px' }}
            >
              AUTHENTICATION
            </span>
          </>
        )}
      </div>
    </nav>
  );
}
