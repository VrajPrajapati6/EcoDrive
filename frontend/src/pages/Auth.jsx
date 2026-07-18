import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getOrganizations, createOrganization, loginUser, registerUser } from '../services/api';
import { Building2, User, Mail, Lock, Phone, CreditCard, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';

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
    fetchOrgs();
  }, []);

  async function fetchOrgs() {
    try {
      const orgs = await getOrganizations();
      setOrganizations(orgs);
      if (orgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch (err) {
      console.error('Error loading organizations:', err);
    }
  }

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
    <div className="odoo-container" style={{ maxWidth: '680px', marginTop: '2rem' }}>
      <div className="odoo-card" style={{ padding: '2.5rem' }}>

        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'var(--odoo-violet)',
            color: 'white',
            fontSize: '1.75rem',
            fontWeight: 'bold',
            marginBottom: '0.75rem'
          }}>
            E
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--odoo-violet)' }}>
            Enterprise Carpooling Portal
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Seamless commuting for registered corporate organizations
          </p>
        </div>

        {/* Demo One-Click Fillers */}
        <div style={{
          background: '#f8f9fa',
          border: '1px dashed var(--border-color)',
          borderRadius: '8px',
          padding: '0.85rem 1.15rem',
          marginBottom: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Hackathon Quick Demo Login (1-Click)
          </span>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleDemoLogin('employee@techcorp.com', 'Employee')}
              className="btn btn-outline"
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
            >
              Demo Employee @ TechCorp
            </button>
            <button
              type="button"
              onClick={() => handleDemoLogin('admin@techcorp.com', 'Company Administrator')}
              className="btn btn-outline"
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem', borderColor: 'var(--odoo-teal)', color: 'var(--odoo-teal)' }}
            >
              Demo Admin @ TechCorp
            </button>
          </div>
        </div>

        {/* Auth Tabs */}
        <div className="odoo-tabs">
          <button
            type="button"
            className={`odoo-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); setError(''); }}
            style={{ flex: 1, textAlign: 'center' }}
          >
            Log In
          </button>
          <button
            type="button"
            className={`odoo-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); setError(''); }}
            style={{ flex: 1, textAlign: 'center' }}
          >
            Register Account
          </button>
        </div>

        {/* Role Selector Pill */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label className="form-label" style={{ marginBottom: '0.6rem' }}>Select Role</label>
          <div className="role-selector-group">
            <button
              type="button"
              className={`role-pill ${role === 'Employee' ? 'active' : ''}`}
              onClick={() => setRole('Employee')}
            >
              Employee
            </button>
            <button
              type="button"
              className={`role-pill ${role === 'Company Administrator' ? 'active' : ''}`}
              onClick={() => setRole('Company Administrator')}
            >
              Company Administrator
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{
            background: '#fff3cd',
            color: '#856404',
            border: '1px solid #ffeeba',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1.25rem',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: '#d4edda',
            color: '#155724',
            border: '1px solid #c3e6cb',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1.25rem',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit}>

          {/* Organization Selection */}
          <div className="form-group">
            <label className="form-label">
              <Building2 size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Organization Name
            </label>
            <select
              className="form-select"
              value={showNewOrgForm ? 'NEW' : selectedOrgId}
              onChange={handleOrgChange}
              required
            >
              <option value="" disabled>-- Select Your Organization --</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.domain || org.code})
                </option>
              ))}
              <option value="NEW" style={{ fontWeight: 'bold', color: 'var(--odoo-violet)' }}>
                + Register New Organization...
              </option>
            </select>
          </div>

          {/* Inline New Organization Form if "+ Register New" is selected */}
          {showNewOrgForm && (
            <div style={{
              background: 'var(--odoo-violet-bg)',
              border: '1px solid var(--odoo-violet-light)',
              padding: '1.25rem',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--odoo-violet)', marginBottom: '0.85rem' }}>
                🏢 Onboard New Corporate Organization
              </h4>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Organization Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., GreenPulse Labs"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
              </div>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Company Domain</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., greenpulse.io"
                    value={newOrgDomain}
                    onChange={(e) => setNewOrgDomain(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Org Code (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., GPL"
                    value={newOrgCode}
                    onChange={(e) => setNewOrgCode(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={handleCreateNewOrg}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
                >
                  Save Organization
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewOrgForm(false)}
                  className="btn btn-outline"
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Sign Up Fields */}
          {!isLogin && (
            <>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Employee ID</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. EMP-102"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="+1 555-0199"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Email ID */}
          <div className="form-group">
            <label className="form-label">Work Email ID *</label>
            <input
              type="email"
              className="form-control"
              placeholder="e.g. employee@techcorp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', fontSize: '1.05rem', marginTop: '0.75rem' }}
            disabled={loading}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{isLogin ? 'Log In to Portal' : 'Create Account'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer Note */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          By continuing, you agree to EcoDrive's enterprise sustainability and ride-sharing policies.
        </div>
      </div>
    </div>
  );
}
