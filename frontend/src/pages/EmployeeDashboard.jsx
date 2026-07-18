import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getMyVehicles, 
  addVehicle, 
  searchRides, 
  bookRide, 
  offerRide, 
  getRideHistory, 
  completeOrDeleteRide,
  updateBookingStatus
} from '../services/api';
import { 
  Car, 
  Search, 
  PlusCircle, 
  MapPin, 
  Calendar, 
  Clock, 
  DollarSign, 
  Users, 
  ShieldCheck, 
  Navigation, 
  History, 
  Plus, 
  AlertCircle, 
  CheckCircle2,
  XCircle,
  CheckCircle
} from 'lucide-react';
import LocationAutocomplete from '../components/LocationAutocomplete';
import MapDisplay from '../components/MapDisplay';
import { supabase } from '../services/supabaseClient';


// Helper: Geocode location name to coords via Nominatim
const geocodeLocation = async (address) => {
  if (!address) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data[0]) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      }
    }
  } catch (e) {
    console.error('Geocoding failed:', e);
  }
  return null;
};

// Helper: Fetch driving distance in km via OSRM
const fetchDistance = async (startLat, startLon, endLat, endLon) => {
  if (!startLat || !startLon || !endLat || !endLon) return null;
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=false`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        return data.routes[0].distance / 1000; // convert meters to km
      }
    }
  } catch (e) {
    console.error('Failed to calculate distance:', e);
  }
  return null;
};

// Helper: Fetch driving distance in km for multiple stops via OSRM
const fetchMultiStopDistance = async (stops) => {
  const validStops = stops.filter(s => s && s.lat && s.lon);
  if (validStops.length < 2) return 0;
  try {
    const coordsString = validStops.map(s => `${s.lon},${s.lat}`).join(';');
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=false`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        return data.routes[0].distance / 1000;
      }
    }
  } catch (e) {
    console.error('Failed to calculate multi-stop distance:', e);
  }
  return null;
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('find'); // find, current, offer, history, vehicles

  // State for Add Vehicle
  const [vehicles, setVehicles] = useState([]);
  const [newVehicle, setNewVehicle] = useState({ makeModel: '', licensePlate: '', capacity: '' });

  // State for Find Ride
  const [availableRides, setAvailableRides] = useState([]);
  const [activeBookingRideId, setActiveBookingRideId] = useState(null);
  const [bookingParams, setBookingParams] = useState({
    pickupLocation: '',
    pickupLat: null,
    pickupLon: null,
    seats: 1,
    distanceKm: null,
    fare: null
  });
  const [geocodedRide, setGeocodedRide] = useState(null);

  // State for Offer Ride
  const [offerForm, setOfferForm] = useState({
    vehicleId: '', 
    pickupLocation: '', 
    destination: '', 
    departureDate: '', 
    departureTime: '', 
    availableSeats: '', 
    farePerSeat: '',
    pickupLat: null,
    pickupLon: null,
    destinationLat: null,
    destinationLon: null
  });

  // State for History and Current Rides
  const [rideHistory, setRideHistory] = useState([]);
  const [requestDetours, setRequestDetours] = useState({});

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Calculate detour distances for pending requests
  useEffect(() => {
    const calculateAllDetours = async () => {
      const detoursMap = {};
      
      const activeDriverRides = rideHistory.filter(
        r => r.user_role === 'Driver' && (r.status === 'Open' || r.status === 'In Progress')
      );

      for (let ride of activeDriverRides) {
        const start = { lat: parseFloat(ride.pickup_lat), lon: parseFloat(ride.pickup_lon) };
        const end = { lat: parseFloat(ride.destination_lat), lon: parseFloat(ride.destination_lon) };

        if (!start.lat || !start.lon || !end.lat || !end.lon) continue;

        const confirmedRiders = (ride.bookings || []).filter(b => b.status === 'Confirmed');
        const confirmedStops = confirmedRiders.map(rider => ({
          lat: parseFloat(rider.pickup_lat),
          lon: parseFloat(rider.pickup_lon)
        })).filter(c => c.lat && c.lon);

        const baseDist = await fetchMultiStopDistance([start, ...confirmedStops, end]);
        
        const pendingRequests = (ride.bookings || []).filter(b => b.status === 'Requested');
        for (let req of pendingRequests) {
          const reqPickup = { lat: parseFloat(req.pickup_lat), lon: parseFloat(req.pickup_lon) };
          if (reqPickup.lat && reqPickup.lon) {
            const detourDist = await fetchMultiStopDistance([start, ...confirmedStops, reqPickup, end]);
            if (baseDist !== null && detourDist !== null) {
              const extraDist = detourDist - baseDist;
              detoursMap[req.id] = {
                baseDistance: parseFloat(baseDist.toFixed(2)),
                detourDistance: parseFloat(detourDist.toFixed(2)),
                extraDistance: parseFloat(Math.max(0, extraDist).toFixed(2))
              };
            }
          }
        }
      }

      setRequestDetours(detoursMap);
    };

    if (rideHistory.length > 0) {
      calculateAllDetours();
    }
  }, [rideHistory]);

  useEffect(() => {
    loadVehicles();
    loadRides();
    loadHistory();
  }, [activeTab]);

  useEffect(() => {
    const channel = supabase
      .channel('employee-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        () => {
          loadRides();
          loadHistory();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          loadRides();
          loadHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
      showMsg('Vehicle registered successfully!');
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
    if (!offerForm.pickupLat || !offerForm.destinationLat) {
      showMsg('Please select valid pickup and destination locations from the map recommendation dropdown.', true);
      return;
    }
    
    // Validate against selected vehicle's capacity
    const selectedVehicle = vehicles.find(v => v.id === offerForm.vehicleId);
    if (selectedVehicle && parseInt(offerForm.availableSeats) > selectedVehicle.capacity) {
      showMsg(`You cannot offer more seats than your vehicle's capacity (${selectedVehicle.capacity} seats).`, true);
      return;
    }

    setLoading(true);
    try {
      await offerRide(offerForm);
      showMsg('Ride offered successfully!');
      setOfferForm({ 
        vehicleId: '', 
        pickupLocation: '', 
        destination: '', 
        departureDate: '', 
        departureTime: '', 
        availableSeats: '', 
        farePerSeat: '',
        pickupLat: null,
        pickupLon: null,
        destinationLat: null,
        destinationLon: null
      });
      setActiveTab('current');
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  // Expand a ride card to enter custom pickup location, calculate distance, and show preview map
  const handleOpenBookingPanel = async (ride) => {
    setActiveBookingRideId(ride.id);
    setLoading(true);

    let lat = ride.pickup_lat;
    let lon = ride.pickup_lon;
    let destLat = ride.destination_lat;
    let destLon = ride.destination_lon;

    // Geocode fallback for legacy seeded data
    if (!lat || !lon) {
      const coords = await geocodeLocation(ride.pickup_location);
      if (coords) { lat = coords.lat; lon = coords.lon; }
    }
    if (!destLat || !destLon) {
      const coords = await geocodeLocation(ride.destination);
      if (coords) { destLat = coords.lat; destLon = coords.lon; }
    }

    const geocoded = {
      pickup_lat: lat,
      pickup_lon: lon,
      destination_lat: destLat,
      destination_lon: destLon
    };

    setGeocodedRide(geocoded);

    // Initialize booking params
    setBookingParams({
      pickupLocation: ride.pickup_location,
      pickupLat: lat,
      pickupLon: lon,
      seats: 1,
      distanceKm: null,
      fare: null
    });

    setLoading(false);
  };

  // Dynamically calculate distance and fare when pickup location or seats change
  useEffect(() => {
    if (!activeBookingRideId || !bookingParams.pickupLat || !bookingParams.pickupLon || !geocodedRide) return;

    const calculateDistanceAndFare = async () => {
      const ride = availableRides.find(r => r.id === activeBookingRideId);
      if (!ride) return;

      const dist = await fetchDistance(
        bookingParams.pickupLat,
        bookingParams.pickupLon,
        geocodedRide.destination_lat,
        geocodedRide.destination_lon
      );

      if (dist !== null) {
        const costPerKm = parseFloat(ride.fare_per_seat);
        const calculatedFare = dist * costPerKm * bookingParams.seats;
        setBookingParams(prev => ({
          ...prev,
          distanceKm: parseFloat(dist.toFixed(2)),
          fare: parseFloat(calculatedFare.toFixed(2))
        }));
      }
    };

    const timer = setTimeout(calculateDistanceAndFare, 200);
    return () => clearTimeout(timer);
  }, [bookingParams.pickupLat, bookingParams.pickupLon, bookingParams.seats, activeBookingRideId, geocodedRide, availableRides]);

  const handleSendBookingRequest = async (rideId) => {
    if (!bookingParams.pickupLat) {
      showMsg('Please select a valid pickup location.', true);
      return;
    }
    
    const ride = availableRides.find(r => r.id === rideId);
    if (ride && bookingParams.seats > ride.available_seats) {
      showMsg(`You cannot request more than the available ${ride.available_seats} seats.`, true);
      return;
    }

    setLoading(true);
    try {
      await bookRide({
        rideId,
        seats: bookingParams.seats,
        pickupLocation: bookingParams.pickupLocation,
        pickupLat: bookingParams.pickupLat,
        pickupLon: bookingParams.pickupLon,
        distanceKm: bookingParams.distanceKm,
        fare: bookingParams.fare
      });
      showMsg('Booking request submitted! Waiting for driver approval.');
      setActiveBookingRideId(null);
      loadRides();
      loadHistory();
      setActiveTab('current');
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBooking = async (bookingId, status) => {
    if (!window.confirm(`Are you sure you want to ${status === 'Confirmed' ? 'accept' : 'decline'} this passenger's request?`)) return;
    setLoading(true);
    try {
      await updateBookingStatus(bookingId, status);
      showMsg(`Request has been ${status === 'Confirmed' ? 'accepted' : 'declined'} successfully!`);
      loadHistory();
      loadRides();
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleRideAction = async (rideId, action) => {
    if (!window.confirm(`Are you sure you want to ${action === 'Delete' ? 'cancel' : 'complete'} this ride?`)) return;
    setLoading(true);
    try {
      await completeOrDeleteRide(rideId, action);
      showMsg(`Ride ${action === 'Delete' ? 'cancelled' : 'completed'} successfully!`);
      loadHistory();
    } catch (err) {
      showMsg(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  // Identify active rides (Open or In Progress) for Driver and Passenger
  const activeDriverRides = rideHistory.filter(
    r => r.user_role === 'Driver' && (r.status === 'Open' || r.status === 'In Progress')
  );

  const activePassengerRides = rideHistory.filter(
    r => r.user_role === 'Passenger' && (r.status === 'Open' || r.status === 'In Progress') && r.booking_status !== 'Declined'
  );

  // Focus a request to preview its detour on the map
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  return (
    <div className="odoo-container">
      {/* Welcome Banner */}
      <div className="odoo-hero" style={{ padding: '2.5rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="odoo-badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderColor: 'rgba(255,255,255,0.3)', marginBottom: '0.75rem', display: 'inline-block' }}>
              {user?.organization?.name}
            </span>
            <h1>Welcome, {user?.fullName}!</h1>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '1rem', borderRadius: '10px', minWidth: '200px' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>EMPLOYEE STATUS</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>Verified Commuter</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="odoo-tabs" style={{ marginBottom: '2rem' }}>
        <button className={`odoo-tab ${activeTab === 'find' ? 'active' : ''}`} onClick={() => setActiveTab('find')}>
          <Search size={16} style={{ display: 'inline', marginRight: '6px' }} /> Book a Ride
        </button>
        <button className={`odoo-tab ${activeTab === 'current' ? 'active' : ''}`} onClick={() => setActiveTab('current')}>
          <Navigation size={16} style={{ display: 'inline', marginRight: '6px' }} /> Current Ride
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

      {error && <div style={{ background: '#fff3cd', color: '#856404', padding: '1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 9999 }}><AlertCircle size={18} /> {error}</div>}
      {success && <div style={{ background: '#d4edda', color: '#155724', padding: '1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 9999 }}><CheckCircle2 size={18} /> {success}</div>}

      {/* Tab Content */}
      <div className="odoo-card">
        
        {/* Book Ride Tab */}
        {activeTab === 'find' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--odoo-violet)' }}>Available Rides in {user?.organization?.name}</h3>
            {availableRides.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No open rides available at the moment.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {availableRides.map(ride => {
                  const isBooking = activeBookingRideId === ride.id;
                  return (
                    <div key={ride.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem', background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <strong style={{ fontSize: '1.25rem', color: 'var(--odoo-violet)' }}>{ride.pickup_location} → {ride.destination}</strong>
                          <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                            <span><Calendar size={14} style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} /> {new Date(ride.departure_date).toLocaleDateString()}</span>
                            <span><Clock size={14} style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} /> {ride.departure_time}</span>
                            <span><Car size={14} style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} /> {ride.vehicle_make}</span>
                            <span><Users size={14} style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} /> {ride.available_seats} seats left</span>
                            <span><ShieldCheck size={14} style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} /> Driver: {ride.driver_name}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--odoo-teal)' }}>${ride.fare_per_seat}<span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>/km</span></div>
                          {!isBooking && (
                            <button className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={() => handleOpenBookingPanel(ride)} disabled={loading}>Book Ride</button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Booking Request Section */}
                      {isBooking && geocodedRide && (
                        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '1.25rem', paddingTop: '1.25rem' }}>
                          <h4 style={{ color: 'var(--odoo-teal)', marginBottom: '1rem' }}>Request Ride Booking</h4>
                          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 350px' }}>
                              <div className="form-group">
                                <label className="form-label">Customize Your Pickup Location</label>
                                <LocationAutocomplete
                                  value={bookingParams.pickupLocation}
                                  onChange={(val, item) => setBookingParams({
                                    ...bookingParams,
                                    pickupLocation: val,
                                    pickupLat: item ? parseFloat(item.lat) : null,
                                    pickupLon: item ? parseFloat(item.lon) : null
                                  })}
                                  placeholder="Enter custom pickup spot..."
                                  required
                                />
                                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                                  Default pickup: <b>{ride.pickup_location}</b>
                                </small>
                              </div>

                              <div className="form-group" style={{ maxWidth: '120px' }}>
                                <label className="form-label">Seats Required</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={ride.available_seats}
                                  className="form-control"
                                  value={bookingParams.seats}
                                  onChange={(e) => setBookingParams({ ...bookingParams, seats: Math.max(1, parseInt(e.target.value) || 1) })}
                                  required
                                />
                              </div>

                              <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '6px', marginBottom: '1.25rem', borderLeft: '4px solid var(--odoo-teal)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                  <span>Passenger Travel Distance:</span>
                                  <strong>{bookingParams.distanceKm !== null ? `${bookingParams.distanceKm} km` : 'Calculating...'}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                  <span>Rate per km:</span>
                                  <span>${ride.fare_per_seat}/km</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #dee2e6', marginTop: '0.5rem', paddingTop: '0.5rem', fontWeight: 700, color: 'var(--odoo-teal)' }}>
                                  <span>Total Payment (Fare):</span>
                                  <span>{bookingParams.fare !== null ? `$${bookingParams.fare}` : '--'}</span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button className="btn btn-teal" onClick={() => handleSendBookingRequest(ride.id)} disabled={loading || bookingParams.distanceKm === null}>
                                  Send Ride Request
                                </button>
                                <button className="btn btn-outline" onClick={() => setActiveBookingRideId(null)}>
                                  Cancel
                                </button>
                              </div>
                            </div>

                            <div style={{ flex: '1 1 300px', minHeight: '260px' }}>
                              <MapDisplay
                                startCoords={{ lat: geocodedRide.pickup_lat, lon: geocodedRide.pickup_lon }}
                                endCoords={{ lat: geocodedRide.destination_lat, lon: geocodedRide.destination_lon }}
                                requestCoords={bookingParams.pickupLat ? { lat: bookingParams.pickupLat, lon: bookingParams.pickupLon } : null}
                                height="280px"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Current Ride Tab */}
        {activeTab === 'current' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--odoo-violet)' }}>Your Active Rides & Requests</h3>
            
            {activeDriverRides.length === 0 && activePassengerRides.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#f8f9fa', borderRadius: '8px' }}>
                <Navigation size={48} color="var(--text-muted)" style={{ margin: '0 auto 1.5rem', opacity: 0.6 }} />
                <h4>No Active Rides Found</h4>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>You don't have any pending requests or confirmed carpools at the moment.</p>
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={() => setActiveTab('find')}>Find a Ride</button>
                  <button className="btn btn-teal" onClick={() => setActiveTab('offer')}>Offer a Ride</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* 1. Driver Active Rides */}
                {activeDriverRides.map(ride => {
                  const pendingRequests = (ride.bookings || []).filter(b => b.status === 'Requested');
                  const confirmedRiders = (ride.bookings || []).filter(b => b.status === 'Confirmed');
                  
                  // Get active request for map preview
                  const activeRequest = pendingRequests.find(r => r.id === selectedRequestId) || pendingRequests[0];
                  
                  return (
                    <div key={ride.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '2px solid var(--odoo-teal)', paddingBottom: '0.75rem' }}>
                        <div>
                          <span className="odoo-badge odoo-badge-teal" style={{ marginBottom: '0.5rem' }}>DRIVER ROLE</span>
                          <h4 style={{ fontSize: '1.35rem', color: 'var(--odoo-violet)' }}>{ride.pickup_location} → {ride.destination}</h4>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }} onClick={() => handleRideAction(ride.id, 'Complete')} disabled={loading}>Complete Ride</button>
                          <button className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', color: '#dc3545', borderColor: '#dc3545' }} onClick={() => handleRideAction(ride.id, 'Delete')} disabled={loading}>Cancel Ride</button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 500px' }}>
                          
                          {/* Confirmed Riders */}
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ fontWeight: 600, color: 'var(--odoo-teal)', marginBottom: '0.75rem' }}>Confirmed Riders ({confirmedRiders.length})</h5>
                            {confirmedRiders.length === 0 ? (
                              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No riders confirmed yet.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {confirmedRiders.map(rider => (
                                  <div key={rider.id} style={{ padding: '0.75rem 1rem', border: '1px solid #e9ecef', borderRadius: '6px', background: '#fcfcfc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <strong>{rider.passenger_name}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({rider.passenger_phone})</span>
                                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        Pickup: {rider.pickup_location}
                                      </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontWeight: 600, color: 'var(--odoo-teal)' }}>${rider.fare}</div>
                                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rider.seats_booked} seat(s) • {rider.distance_km} km</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Ride Requests */}
                          <div>
                            <h5 style={{ fontWeight: 600, color: '#e67e22', marginBottom: '0.75rem' }}>Pending Ride Requests ({pendingRequests.length})</h5>
                            {pendingRequests.length === 0 ? (
                              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No pending requests.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {pendingRequests.map(request => (
                                  <div 
                                    key={request.id} 
                                    style={{ 
                                      padding: '1rem', 
                                      border: `1px solid ${activeRequest?.id === request.id ? '#e67e22' : '#dee2e6'}`, 
                                      borderRadius: '6px', 
                                      background: activeRequest?.id === request.id ? 'rgba(230, 126, 34, 0.03)' : '#fff',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => setSelectedRequestId(request.id)}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <div>
                                        <strong>{request.passenger_name}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({request.passenger_phone})</span>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                          Requested Pickup: <b>{request.pickup_location}</b>
                                        </div>
                                      </div>
                                      <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--odoo-teal)', display: 'block' }}>${request.fare}</span>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{request.seats_booked} seat(s) • {request.distance_km} km</span>
                                        {requestDetours[request.id] && (
                                          <span style={{ fontSize: '0.8rem', color: '#e67e22', display: 'block', marginTop: '2px', fontWeight: 600 }}>
                                            Detour: +{requestDetours[request.id].extraDistance} km
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                      <button 
                                        className="btn btn-teal" 
                                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                                        onClick={(e) => { e.stopPropagation(); handleUpdateBooking(request.id, 'Confirmed'); }}
                                        disabled={loading}
                                      >
                                        <CheckCircle size={14} /> Accept
                                      </button>
                                      <button 
                                        className="btn btn-outline" 
                                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', color: '#dc3545', borderColor: '#dc3545' }}
                                        onClick={(e) => { e.stopPropagation(); handleUpdateBooking(request.id, 'Declined'); }}
                                        disabled={loading}
                                      >
                                        <XCircle size={14} /> Decline
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                        </div>

                        {/* Map Panel */}
                        <div style={{ flex: '1 1 400px', minHeight: '350px' }}>
                          <h5 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
                            Map Route
                            {activeRequest ? ' (With Pending Request Detour)' : ' (Confirmed Route)'}
                          </h5>
                          <MapDisplay
                            startCoords={{ lat: parseFloat(ride.pickup_lat), lon: parseFloat(ride.pickup_lon) }}
                            endCoords={{ lat: parseFloat(ride.destination_lat), lon: parseFloat(ride.destination_lon) }}
                            confirmedPickups={confirmedRiders.map(rider => ({
                              lat: parseFloat(rider.pickup_lat),
                              lon: parseFloat(rider.pickup_lon),
                              passenger_name: rider.passenger_name,
                              pickup_location: rider.pickup_location
                            })).filter(p => p.lat && p.lon)}
                            requestCoords={activeRequest ? {
                              lat: parseFloat(activeRequest.pickup_lat),
                              lon: parseFloat(activeRequest.pickup_lon),
                              passenger_name: activeRequest.passenger_name,
                              pickup_location: activeRequest.pickup_location
                            } : null}
                            height="350px"
                          />
                          {activeRequest && (
                            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '8px', textAlign: 'center' }}>
                              Map displays <b style={{ color: 'var(--odoo-violet)' }}>Original Route (S → D)</b> and <b style={{ color: '#e67e22' }}>Proposed Detour (S → P → D)</b> for <b>{activeRequest.passenger_name}</b>.
                            </small>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* 2. Passenger Active Bookings */}
                {activePassengerRides.map(ride => {
                  const isConfirmed = ride.booking_status === 'Confirmed';
                  
                  return (
                    <div key={ride.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '2px solid var(--odoo-violet)', paddingBottom: '0.75rem' }}>
                        <div>
                          <span className={`odoo-badge ${isConfirmed ? 'odoo-badge-teal' : ''}`} style={{ marginBottom: '0.5rem' }}>
                            {isConfirmed ? 'CONFIRMED CARPOOL' : 'PENDING APPROVAL'}
                          </span>
                          <h4 style={{ fontSize: '1.35rem', color: 'var(--odoo-violet)' }}>{ride.pickup_location} → {ride.destination}</h4>
                        </div>
                        <div>
                          {/* Cancel Request Button */}
                          <button 
                            className="btn btn-outline" 
                            style={{ color: '#dc3545', borderColor: '#dc3545', fontSize: '0.85rem', padding: '0.5rem 1rem' }} 
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to cancel your ride request?')) {
                                setLoading(true);
                                try {
                                  // Call completeOrDeleteRide in backend which also clears bookings (cascade deletes on db)
                                  await completeOrDeleteRide(ride.booking_id, 'Delete'); // or handle booking deletion
                                  showMsg('Booking request cancelled successfully!');
                                  loadHistory();
                                } catch(e) {
                                  // Alternative deletion pathway
                                  showMsg(e.message, true);
                                } finally {
                                  setLoading(false);
                                }
                              }
                            }}
                            disabled={loading}
                          >
                            Cancel Request
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 450px' }}>
                          <h5 style={{ fontWeight: 600, color: 'var(--odoo-violet)', marginBottom: '0.75rem' }}>Booking Information</h5>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem' }} className="form-group">
                            <div><b>Driver Name:</b> {ride.driver_name} ({ride.driver_phone || 'No phone number'})</div>
                            <div><b>Vehicle Make/Model:</b> {ride.vehicle_make}</div>
                            <div><b>Departure:</b> {new Date(ride.departure_date).toLocaleDateString()} at {ride.departure_time}</div>
                            <div><b>Your Pickup Spot:</b> {ride.my_pickup_location}</div>
                            <div><b>Travel Distance:</b> {ride.my_distance_km} km</div>
                            <div><b>Seats Reserved:</b> {ride.seats_booked} seat(s)</div>
                            
                            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '6px', marginTop: '0.5rem', borderLeft: '4px solid var(--odoo-teal)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--odoo-teal)' }}>
                                <span>Estimated Payment to Done:</span>
                                <span>${ride.my_fare}</span>
                              </div>
                              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                                Calculated as: distance ({ride.my_distance_km} km) * cost per seat per km (${ride.fare_per_seat}) * seats ({ride.seats_booked})
                              </small>
                            </div>
                          </div>

                          {/* Other passengers */}
                          {isConfirmed && (
                            <div style={{ marginTop: '1.25rem' }}>
                              <h6 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Other Confirmed Passenger(s) sharing this ride:</h6>
                              {ride.other_riders && ride.other_riders.length > 0 ? (
                                <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                                  {ride.other_riders.map((r, i) => (
                                    <li key={i}>{r.passenger_name} ({r.seats_booked} seats)</li>
                                  ))}
                                </ul>
                              ) : (
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No other passengers confirmed yet.</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Map Panel */}
                        <div style={{ flex: '1 1 350px', minHeight: '300px' }}>
                          <h5 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Route Map</h5>
                          <MapDisplay
                            startCoords={{ lat: parseFloat(ride.pickup_lat), lon: parseFloat(ride.pickup_lon) }}
                            endCoords={{ lat: parseFloat(ride.destination_lat), lon: parseFloat(ride.destination_lon) }}
                            confirmedPickups={[
                              ...(ride.other_riders || []).map(r => ({
                                lat: parseFloat(r.pickup_lat),
                                lon: parseFloat(r.pickup_lon),
                                passenger_name: r.passenger_name,
                                pickup_location: r.pickup_location
                              })),
                              isConfirmed ? {
                                lat: parseFloat(ride.my_pickup_lat),
                                lon: parseFloat(ride.my_pickup_lon),
                                passenger_name: 'You',
                                pickup_location: ride.my_pickup_location
                              } : null
                            ].filter(p => p && p.lat && p.lon)}
                            requestCoords={!isConfirmed ? {
                              lat: parseFloat(ride.my_pickup_lat),
                              lon: parseFloat(ride.my_pickup_lon),
                              passenger_name: 'You (Pending Request)',
                              pickup_location: ride.my_pickup_location
                            } : null}
                            height="300px"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

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
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  
                  {/* Form fields */}
                  <div style={{ flex: '1 1 500px' }}>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Pickup Location</label>
                        <LocationAutocomplete
                          value={offerForm.pickupLocation}
                          onChange={(val, item) => setOfferForm({
                            ...offerForm,
                            pickupLocation: val,
                            pickupLat: item ? parseFloat(item.lat) : null,
                            pickupLon: item ? parseFloat(item.lon) : null
                          })}
                          placeholder="Search pickup location..."
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Destination</label>
                        <LocationAutocomplete
                          value={offerForm.destination}
                          onChange={(val, item) => setOfferForm({
                            ...offerForm,
                            destination: val,
                            destinationLat: item ? parseFloat(item.lat) : null,
                            destinationLon: item ? parseFloat(item.lon) : null
                          })}
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
                          <input 
                            type="number" 
                            min="1" 
                            max={vehicles.find(v => v.id === offerForm.vehicleId)?.capacity || 10} 
                            className="form-control" 
                            required 
                            value={offerForm.availableSeats} 
                            onChange={e => setOfferForm({...offerForm, availableSeats: e.target.value})} 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Cost per km ($)</label>
                          <input type="number" min="0" step="0.01" className="form-control" required value={offerForm.farePerSeat} onChange={e => setOfferForm({...offerForm, farePerSeat: e.target.value})} />
                        </div>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-teal" style={{ marginTop: '1rem', width: '100%' }} disabled={loading}>Publish Ride</button>
                  </div>

                  {/* Route preview map */}
                  <div style={{ flex: '1 1 400px', minHeight: '380px' }}>
                    <h4 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Route Map Preview</h4>
                    <MapDisplay
                      startCoords={offerForm.pickupLat ? { lat: offerForm.pickupLat, lon: offerForm.pickupLon } : null}
                      endCoords={offerForm.destinationLat ? { lat: offerForm.destinationLat, lon: offerForm.destinationLon } : null}
                      height="380px"
                    />
                  </div>

                </div>
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
                        {ride.user_role === 'Passenger' && (
                          <span className={`odoo-badge ${ride.booking_status === 'Confirmed' ? 'odoo-badge-teal' : ''}`} style={{ background: ride.booking_status === 'Declined' ? '#f8d7da' : '', color: ride.booking_status === 'Declined' ? '#721c24' : '' }}>
                            {ride.booking_status}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(ride.departure_date).toLocaleDateString()} at {ride.departure_time} | 
                        {ride.user_role === 'Passenger' ? ` Driver: ${ride.driver_name}` : ` Vehicle: ${ride.vehicle_make}`}
                      </div>
                    </div>
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
