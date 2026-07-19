import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getOrganizations, createOrganization, loginUser, registerUser } from '../services/api';


export default function Auth({ onNavigate }) {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('Employee'); // 'Employee' or 'Company Administrator'
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [showNewOrgForm, setShowNewOrgForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [phone, setPhone] = useState('');

  // New Organization fields
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDomain, setNewOrgDomain] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');

  useEffect(() => {
    async function fetchOrgs() {
      try {
        const orgs = await getOrganizations();
        setOrganizations(orgs);
        if (orgs.length > 0 && !selectedOrgId) {
          setSelectedOrgId(orgs[0].id);
        }
      } catch (err) {
        console.error('Failed to load organizations:', err);
      }
    }
    fetchOrgs();
  }, [selectedOrgId]);

  const handleOrgChange = (e) => {
    if (e.target.value === 'NEW') {
      setShowNewOrgForm(true);
    } else {
      setShowNewOrgForm(false);
      setSelectedOrgId(e.target.value);
    }
  };

  const handleCreateNewOrg = async (e) => {
    e.preventDefault();
    if (!newOrgName) {
      setError('Please enter an Organization Name.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const created = await createOrganization({
        name: newOrgName,
        domain: newOrgDomain,
        code: newOrgCode || newOrgName.substring(0, 4).toUpperCase()
      });
      await fetchOrgs();
      setSelectedOrgId(created.id);
      setShowNewOrgForm(false);
      setSuccessMsg(`Organization "${created.name}" created and selected!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!selectedOrgId && !showNewOrgForm) {
      setError('Please select an organization.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const res = await loginUser({
          email,
          password,
          role,
          organizationId: selectedOrgId
        });
        login(res.user, res.token);
        onNavigate('dashboard');
      } else {
        const res = await registerUser({
          fullName,
          email,
          password,
          role,
          organizationId: selectedOrgId,
          employeeId,
          phone
        });
        
        if (role === 'Employee') {
          setSuccessMsg('Registration successful! Your account is pending administrator approval. Please wait for an admin to activate your account.');
          setIsLogin(true);
          setPassword('');
        } else {
          login(res.user, res.token);
          onNavigate('dashboard');
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail, demoRole) => {
    const techCorp = organizations.find(o => o.name === 'TechCorp Global') || organizations[0];
    if (!techCorp) return;

    setRole(demoRole);
    setSelectedOrgId(techCorp.id);
    setEmail(demoEmail);
    setPassword('password123');
    setIsLogin(true);

    setLoading(true);
    setError('');
    try {
      const res = await loginUser({
        email: demoEmail,
        password: 'password123',
        role: demoRole,
        organizationId: techCorp.id
      });
      login(res.user, res.token);
      onNavigate('dashboard');
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/* LEFT HALF */}
      <div style={{
        flex: 1,
        backgroundColor: 'var(--odoo-teal)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '2rem',
      }}>
        <h1 style={{ fontSize: '4.5rem', fontWeight: 900, marginBottom: '1rem', lineHeight: 1.1 }}>
          DRIVE.<br />SHARE.<br />SUCCEED.
        </h1>
        <p style={{ fontSize: '1.25rem', opacity: 0.9, maxWidth: '500px' }}>
          Welcome to the premium Enterprise Carpooling platform. Join your colleagues in building a sustainable future today.
        </p>
      </div>

      {/* RIGHT HALF */}
      <div style={{
        flex: 1,
        backgroundColor: 'var(--bg-page)',
        display: 'flex',
        flexDirection: 'column',
        padding: '2rem',
        overflowY: 'auto'
      }}>
        <div style={{ maxWidth: '480px', width: '100%', margin: 'auto' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1rem', color: 'var(--text-main)', textTransform: 'uppercase' }}>
            Get Started
          </h2>
          
          {/* Demo One-Click Fillers */}
          <div style={{
            background: '#000000',
            color: '#ffffff',
            padding: '1.25rem',
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Quick Demo Login
            </span>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleDemoLogin('employee@techcorp.com', 'Employee')}
                style={{ background: 'transparent', border: '1px solid #ffffff', color: '#ffffff', padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
              >
                EMPLOYEE
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('admin@techcorp.com', 'Company Administrator')}
                style={{ background: '#ffffff', border: '1px solid #ffffff', color: '#000000', padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
              >
                ADMIN
              </button>
            </div>
          </div>

          {/* Auth Tabs */}
          <div style={{ display: 'flex', borderBottom: '3px solid #e5e5e5', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(''); }}
              style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: 'none', borderBottom: isLogin ? '3px solid #000000' : '3px solid transparent', marginBottom: '-3px', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', color: isLogin ? '#000000' : '#888888' }}
            >
              LOG IN
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(''); }}
              style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: 'none', borderBottom: !isLogin ? '3px solid #000000' : '3px solid transparent', marginBottom: '-3px', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', color: !isLogin ? '#000000' : '#888888' }}
            >
              REGISTER
            </button>
          </div>

          {/* Role Selector Pill */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.9rem' }}>SELECT ROLE</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setRole('Employee')}
                style={{ flex: 1, padding: '0.65rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', border: role === 'Employee' ? '2px solid #000000' : '2px solid #e5e5e5', background: role === 'Employee' ? '#000000' : 'transparent', color: role === 'Employee' ? '#ffffff' : '#000000' }}
              >
                EMPLOYEE
              </button>
              <button
                type="button"
                onClick={() => setRole('Company Administrator')}
                style={{ flex: 1, padding: '0.65rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', border: role === 'Company Administrator' ? '2px solid #000000' : '2px solid #e5e5e5', background: role === 'Company Administrator' ? '#000000' : 'transparent', color: role === 'Company Administrator' ? '#ffffff' : '#000000' }}
              >
                ADMIN
              </button>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div style={{ background: '#000000', color: '#ffffff', padding: '0.75rem', marginBottom: '1rem', fontWeight: 700, fontSize: '0.9rem' }}>
              ERROR: {error}
            </div>
          )}
          {successMsg && (
            <div style={{ background: 'var(--odoo-teal)', color: '#ffffff', padding: '0.75rem', marginBottom: '1rem', fontWeight: 700, fontSize: '0.9rem' }}>
              SUCCESS: {successMsg}
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSubmit}>
            {/* Organization Selection */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>ORGANIZATION</label>
              <select
                style={{ width: '100%', padding: '0.65rem', border: '2px solid #000000', fontSize: '1rem', fontWeight: 600, background: 'transparent' }}
                value={showNewOrgForm ? 'NEW' : selectedOrgId}
                onChange={handleOrgChange}
                required
              >
                <option value="" disabled>-- SELECT ORGANIZATION --</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.domain || org.code})
                  </option>
                ))}
                <option value="NEW">
                  + REGISTER NEW ORGANIZATION
                </option>
              </select>
            </div>

            {/* New Organization Form */}
            {showNewOrgForm && (
              <div style={{ background: '#f5f5f5', padding: '1.5rem', marginBottom: '1rem', borderLeft: '4px solid #000000' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem', textTransform: 'uppercase' }}>
                  NEW ORGANIZATION
                </h4>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.4rem', fontSize: '0.8rem' }}>NAME *</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '0.75rem', border: '2px solid #000000', fontSize: '0.9rem' }}
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.4rem', fontSize: '0.8rem' }}>DOMAIN</label>
                    <input
                      type="text"
                      style={{ width: '100%', padding: '0.75rem', border: '2px solid #000000', fontSize: '0.9rem' }}
                      value={newOrgDomain}
                      onChange={(e) => setNewOrgDomain(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.4rem', fontSize: '0.8rem' }}>CODE</label>
                    <input
                      type="text"
                      style={{ width: '100%', padding: '0.75rem', border: '2px solid #000000', fontSize: '0.9rem' }}
                      value={newOrgCode}
                      onChange={(e) => setNewOrgCode(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={handleCreateNewOrg} style={{ background: '#000000', color: '#ffffff', padding: '0.75rem 1rem', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                    SAVE
                  </button>
                  <button type="button" onClick={() => setShowNewOrgForm(false)} style={{ background: 'transparent', color: '#000000', padding: '0.75rem 1rem', border: '2px solid #000000', fontWeight: 700, cursor: 'pointer' }}>
                    CANCEL
                  </button>
                </div>
              </div>
            )}

            {/* Sign Up Fields */}
            {!isLogin && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>FULL NAME *</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '0.65rem', border: '2px solid #000000', fontSize: '1rem', fontWeight: 600 }}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>EMPLOYEE ID</label>
                    <input
                      type="text"
                      style={{ width: '100%', padding: '0.65rem', border: '2px solid #000000', fontSize: '1rem', fontWeight: 600 }}
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>PHONE NUMBER</label>
                    <input
                      type="tel"
                      style={{ width: '100%', padding: '0.65rem', border: '2px solid #000000', fontSize: '1rem', fontWeight: 600 }}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email ID */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>WORK EMAIL *</label>
              <input
                type="email"
                style={{ width: '100%', padding: '0.65rem', border: '2px solid #000000', fontSize: '1rem', fontWeight: 600 }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>PASSWORD *</label>
              <input
                type="password"
                style={{ width: '100%', padding: '0.65rem', border: '2px solid #000000', fontSize: '1rem', fontWeight: 600 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              style={{ width: '100%', padding: '0.75rem', background: 'var(--odoo-teal)', color: '#ffffff', border: 'none', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase' }}
              disabled={loading}
            >
              {loading ? 'AUTHENTICATING...' : (isLogin ? 'LOG IN' : 'CREATE ACCOUNT')}
            </button>
          </form>

          <div style={{ marginTop: '2rem', fontSize: '0.85rem', fontWeight: 600, color: '#888888' }}>
            By continuing, you agree to EcoDrive's enterprise sustainability and ride-sharing policies.
          </div>
        </div>
      </div>
    </div>
  );
}

