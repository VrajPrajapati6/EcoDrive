import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getOrganizationRidesReport } from '../services/api';
import { Building2, Users, Settings, Sliders, BarChart3, ShieldCheck, Car, DollarSign, Calendar, MapPin } from 'lucide-react';
import { supabase } from '../services/supabaseClient';


export default function AdminDashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        () => {
          loadReports();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          loadReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadReports = async () => {
    try {
      const data = await getOrganizationRidesReport();
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activeRides = reports.filter(r => r.status === 'Open' || r.status === 'In Progress').length;
  const completedRides = reports.filter(r => r.status === 'Completed').length;
  const totalRides = reports.length;

  return (
    <div className="odoo-container">
      {/* Odoo Hero Banner */}
      <div className="odoo-hero" style={{ background: 'linear-gradient(135deg, #3b2a37 0%, var(--odoo-violet) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="odoo-badge" style={{ background: 'rgba(255,215,0,0.2)', color: '#ffd700', borderColor: 'rgba(255,215,0,0.3)', marginBottom: '0.75rem', display: 'inline-block' }}>
              COMPANY ADMINISTRATOR PORTAL
            </span>
            <h1>{user?.organization?.name} Administration</h1>
            <p>Configure organization carpooling rules, operational fuel rates, and manage registered commuter profiles.</p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.12)', padding: '1.25rem', borderRadius: '10px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.25)', minWidth: '240px' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>ADMINISTRATOR</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.25rem 0' }}>{user?.fullName}</div>
            <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} color="#ffd700" />
              <span>Full Governance Access</span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Stats Row */}
      <div className="grid-3" style={{ marginBottom: '2.5rem' }}>
        <div className="odoo-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL RIDES OFFERED</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--odoo-violet)' }}>{totalRides}</div>
            </div>
            <Car size={32} color="var(--odoo-violet)" opacity={0.8} />
          </div>
        </div>
        <div className="odoo-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>ACTIVE / OPEN RIDES</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--odoo-teal)' }}>{activeRides}</div>
            </div>
            <Sliders size={32} color="var(--odoo-teal)" opacity={0.8} />
          </div>
        </div>
        <div className="odoo-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>COMPLETED RIDES</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#2b8a3e' }}>{completedRides}</div>
            </div>
            <BarChart3 size={32} color="#2b8a3e" opacity={0.8} />
          </div>
        </div>
      </div>

      {/* Admin Reports Table */}
      <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--odoo-violet)' }}>
        Organization Ride Reports
      </h3>
      <div className="odoo-card" style={{ overflowX: 'auto' }}>
        {loading ? (
          <p>Loading reports...</p>
        ) : reports.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No rides have been offered in your organization yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Route</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Schedule</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Driver</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Vehicle</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Seats (Booked/Total)</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Fare</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(ride => {
                const totalSeats = ride.available_seats + ride.total_booked;
                return (
                  <tr key={ride.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>{ride.pickup_location} → {ride.destination}</td>
                    <td style={{ padding: '1rem 0.5rem', color: 'var(--text-muted)' }}>
                      <div>{new Date(ride.departure_date).toLocaleDateString()}</div>
                      <div>{ride.departure_time}</div>
                    </td>
                    <td style={{ padding: '1rem 0.5rem' }}>
                      <div>{ride.driver_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ride.driver_email}</div>
                    </td>
                    <td style={{ padding: '1rem 0.5rem' }}>
                      <div>{ride.vehicle_make}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ride.license_plate}</div>
                    </td>
                    <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                      {ride.total_booked} / {totalSeats}
                    </td>
                    <td style={{ padding: '1rem 0.5rem' }}>${ride.fare_per_seat}</td>
                    <td style={{ padding: '1rem 0.5rem' }}>
                      <span className={`odoo-badge ${ride.status === 'Completed' ? 'odoo-badge-teal' : ''}`} style={{ background: ride.status === 'Cancelled' ? '#f8d7da' : '', color: ride.status === 'Cancelled' ? '#721c24' : '' }}>
                        {ride.status} {ride.cancellation_reason && `(Reason: ${ride.cancellation_reason})`}
                      </span>
                    </td>                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
