import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyVehicles, addVehicle, searchRides, bookRide, offerRide, getRideHistory, completeOrDeleteRide } from '../services/api';
import { Car, Search, PlusCircle, MapPin, Calendar, Clock, DollarSign, Users, ShieldCheck, Navigation, History, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import LocationAutocomplete from '../components/LocationAutocomplete';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('find'); // find, offer, vehicles, history

  // State for Add Vehicle
  const [vehicles, setVehicles] = useState([]);
  const [newVehicle, setNewVehicle] = useState({ makeModel: '', licensePlate: '', capacity: '' });

  // State for Find Ride
  const [availableRides, setAvailableRides] = useState([]);

  // State for Offer Ride
  const [offerForm, setOfferForm] = useState({
    vehicleId: '', pickupLocation: '', destination: '', departureDate: '', departureTime: '', availableSeats: '', farePerSeat: ''
  });

  // State for History
  const [rideHistory, setRideHistory] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadVehicles();
    loadRides();
    loadHistory();
  }, [activeTab]);

  const showMsg = (msg, isError = false) => {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  const loadVehicles = async () => {
    try { const v = await getMyVehicles(); setVehicles(v); }
    catch (err) { console.error(err); }
  };

  const loadRides = async () => {
    try { const r = await searchRides(); setAvailableRides(r); }
    catch (err) { console.error(err); }
  };

  const loadHistory = async () => {
    try { const h = await getRideHistory(); setRideHistory(h); }
    catch (err) { console.error(err); }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addVehicle(newVehicle);
      showMsg('Vehicle added successfully!');
      setNewVehicle({ makeModel: '', licensePlate: '', capacity: '' });
      loadVehicles();
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleOfferRide = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await offerRide(offerForm);
      showMsg('Ride offered successfully!');
      setOfferForm({ vehicleId: '', pickupLocation: '', destination: '', departureDate: '', departureTime: '', availableSeats: '', farePerSeat: '' });
      setActiveTab('history');
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleBookRide = async (rideId) => {
    setLoading(true);
    try {
      await bookRide(rideId, 1);
      showMsg('Ride booked successfully!');
      loadRides();
      loadHistory();
      setActiveTab('history');
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleRideAction = async (rideId, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this ride?`)) return;
    setLoading(true);
    try {
      await completeOrDeleteRide(rideId, action);
      showMsg(`Ride ${action}d successfully!`);
      loadHistory();
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="odoo-container">
      {/* Odoo Hero Welcome Banner */}
      <div className="odoo-hero" style={{ padding: '2.5rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="odoo-badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderColor: 'rgba(255,255,255,0.3)', marginBottom: '0.75rem', display: 'inline-block' }}>
              🏢 {user?.organization?.name}
            </span>
            <h1>Welcome, {user?.fullName}!</h1>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '1rem', borderRadius: '10px', minWidth: '200px' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>EMPLOYEE STATUS</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>Verified Commuter</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="odoo-tabs" style={{ marginBottom: '2rem' }}>
        <button className={`odoo-tab ${activeTab === 'find' ? 'active' : ''}`} onClick={() => setActiveTab('find')}>
          <Search size={16} style={{ display: 'inline', marginRight: '6px' }} /> Book a Ride
        </button>
        <button className={`odoo-tab ${activeTab === 'offer' ? 'active' : ''}`} onClick={() => setActiveTab('offer')}>
          <Car size={16} style={{ display: 'inline', marginRight: '6px' }} /> Offer a Ride
        </button>
        <button className={`odoo-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <History size={16} style={{ display: 'inline', marginRight: '6px' }} /> Ride History
        </button>
        <button className={`odoo-tab ${activeTab === 'vehicles' ? 'active' : ''}`} onClick={() => setActiveTab('vehicles')}>
          <PlusCircle size={16} style={{ display: 'inline', marginRight: '6px' }} /> My Vehicles
        </button>
      </div>

      {error && <div style={{ background: '#fff3cd', color: '#856404', padding: '1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertCircle size={18} /> {error}</div>}
      {success && <div style={{ background: '#d4edda', color: '#155724', padding: '1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={18} /> {success}</div>}

      {/* Tab Content */}
      <div className="odoo-card">
        
        {/* Book Ride Tab */}
        {activeTab === 'find' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--odoo-violet)' }}>Available Rides in {user?.organization?.name}</h3>
            {availableRides.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No open rides available at the moment.</p>
            ) : (
              <div className="grid-2">
                {availableRides.map(ride => (
                  <div key={ride.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '1.1rem' }}>{ride.pickup_location} → {ride.destination}</strong>
                      <span className="odoo-badge odoo-badge-teal">${ride.fare_per_seat}</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      <div><Calendar size={14} style={{ display: 'inline' }} /> {new Date(ride.departure_date).toLocaleDateString()} at {ride.departure_time}</div>
                      <div><Car size={14} style={{ display: 'inline' }} /> {ride.vehicle_make}</div>
                      <div><Users size={14} style={{ display: 'inline' }} /> {ride.available_seats} seats left</div>
                      <div><ShieldCheck size={14} style={{ display: 'inline' }} /> Driver: {ride.driver_name}</div>
                    </div>
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleBookRide(ride.id)} disabled={loading}>Book Ride</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Offer Ride Tab */}
        {activeTab === 'offer' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--odoo-teal)' }}>Publish a New Ride</h3>
            {vehicles.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
                <Car size={32} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
                <p>You need to add a vehicle before you can offer a ride.</p>
                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setActiveTab('vehicles')}>Go to My Vehicles</button>
              </div>
            ) : (
              <form onSubmit={handleOfferRide}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Pickup Location</label>
                    <LocationAutocomplete
                      value={offerForm.pickupLocation}
                      onChange={val => setOfferForm({...offerForm, pickupLocation: val})}
                      placeholder="Search pickup location..."
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Destination</label>
                    <LocationAutocomplete
                      value={offerForm.destination}
                      onChange={val => setOfferForm({...offerForm, destination: val})}
                      placeholder="Search destination..."
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-control" required value={offerForm.departureDate} onChange={e => setOfferForm({...offerForm, departureDate: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Time</label>
                    <input type="time" className="form-control" required value={offerForm.departureTime} onChange={e => setOfferForm({...offerForm, departureTime: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Select Vehicle</label>
                    <select className="form-select" required value={offerForm.vehicleId} onChange={e => setOfferForm({...offerForm, vehicleId: e.target.value})}>
                      <option value="">-- Choose Vehicle --</option>
                      {vehicles.map(v => <option key={v.id} value={v.id}>{v.make_model} ({v.license_plate})</option>)}
                    </select>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Seats</label>
                      <input type="number" min="1" max="10" className="form-control" required value={offerForm.availableSeats} onChange={e => setOfferForm({...offerForm, availableSeats: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fare ($)</label>
                      <input type="number" min="0" step="0.5" className="form-control" required value={offerForm.farePerSeat} onChange={e => setOfferForm({...offerForm, farePerSeat: e.target.value})} />
                    </div>
                  </div>
                </div>
                <button type="submit" className="btn btn-teal" disabled={loading}>Publish Ride</button>
              </form>
            )}
          </div>
        )}

        {/* Ride History Tab */}
        {activeTab === 'history' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>My Ride History</h3>
            {rideHistory.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No past rides found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {rideHistory.map(ride => (
                  <div key={ride.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: '1.1rem' }}>{ride.pickup_location} → {ride.destination}</strong>
                        <span className={`odoo-badge ${ride.user_role === 'Driver' ? 'odoo-badge-teal' : ''}`}>{ride.user_role}</span>
                        <span className="odoo-badge" style={{ background: '#e9ecef', color: '#495057' }}>{ride.status}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(ride.departure_date).toLocaleDateString()} at {ride.departure_time} | 
                        {ride.user_role === 'Passenger' ? ` Driver: ${ride.driver_name}` : ` Vehicle: ${ride.vehicle_make}`}
                      </div>
                    </div>
                    
                    {ride.user_role === 'Driver' && ride.status === 'Open' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }} onClick={() => handleRideAction(ride.id, 'Complete')} disabled={loading}>Complete</button>
                        <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', color: '#dc3545', borderColor: '#dc3545' }} onClick={() => handleRideAction(ride.id, 'Delete')} disabled={loading}>Cancel Ride</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add Vehicle Tab */}
        {activeTab === 'vehicles' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>My Registered Vehicles</h3>
            <div className="grid-2">
              <div>
                <form onSubmit={handleAddVehicle} style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ marginBottom: '1rem' }}>Add New Vehicle</h4>
                  <div className="form-group">
                    <label className="form-label">Make & Model</label>
                    <input type="text" className="form-control" required placeholder="e.g. Toyota Prius" value={newVehicle.makeModel} onChange={e => setNewVehicle({...newVehicle, makeModel: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">License Plate</label>
                    <input type="text" className="form-control" required placeholder="e.g. ABC-1234" value={newVehicle.licensePlate} onChange={e => setNewVehicle({...newVehicle, licensePlate: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Seat Capacity</label>
                    <input type="number" min="1" max="10" className="form-control" required value={newVehicle.capacity} onChange={e => setNewVehicle({...newVehicle, capacity: e.target.value})} />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading}><Plus size={16} /> Register Vehicle</button>
                </form>
              </div>
              <div>
                {vehicles.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>No vehicles registered yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {vehicles.map(v => (
                      <div key={v.id} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '1rem', background: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}><Car size={18} color="var(--odoo-violet)" /> {v.make_model}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Plate: {v.license_plate} | Capacity: {v.capacity} seats</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
