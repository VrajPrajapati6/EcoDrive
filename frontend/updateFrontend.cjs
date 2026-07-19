const fs = require('fs');
const path = 'c:/Users/Prince/OneDrive/Documents/Hackathon/ODOO/frontend/src/pages/EmployeeDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

const findRideUI = `
            <div>
              <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid var(--border-color)' }}>
                <h4 style={{ marginBottom: '1rem', color: 'var(--odoo-violet)' }}>Request a Recurring Ride</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <label style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                    Enable Recurring Request
                  </label>
                </div>
                {isRecurring && (
                  <form onSubmit={handleCreateRecurring} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label className="form-label">Pickup Location</label>
                        <input type="text" className="form-control" value={reqPickup} onChange={e=>setReqPickup(e.target.value)} required />
                      </div>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label className="form-label">Destination</label>
                        <input type="text" className="form-control" value={reqDest} onChange={e=>setReqDest(e.target.value)} required />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label className="form-label">Time</label>
                        <input type="time" className="form-control" value={reqTime} onChange={e=>setReqTime(e.target.value)} required />
                      </div>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label className="form-label">Seats Needed</label>
                        <input type="number" min="1" className="form-control" value={reqSeats} onChange={e=>setReqSeats(parseInt(e.target.value))} required />
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Select Days</label>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                          <div 
                            key={d}
                            onClick={() => {
                              const newDays = recurringDays.includes(d) ? recurringDays.filter(x => x !== d) : [...recurringDays, d];
                              setRecurringDays(newDays);
                            }}
                            style={{ padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid ' + (recurringDays.includes(d) ? 'var(--odoo-teal)' : '#ccc'), background: recurringDays.includes(d) ? 'var(--odoo-teal)' : '#f8f9fa', color: recurringDays.includes(d) ? '#fff' : '#000', fontWeight: 600 }}
                          >
                            {d}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button type="submit" className="odoo-btn" style={{ background: 'var(--odoo-teal)' }}>Send Recurring Request</button>
                  </form>
                )}
                
                {!isRecurring && recurringRequests.filter(r => r.passenger_id === user?.id).length > 0 && (
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <h5 style={{ marginBottom: '1rem' }}>My Sent Recurring Requests</h5>
                    {recurringRequests.filter(r => r.passenger_id === user?.id).map(r => (
                      <div key={r.id} style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '6px', marginBottom: '0.5rem', borderLeft: '4px solid ' + (r.status === 'Accepted' ? 'green' : 'gray') }}>
                        <strong>{r.pickup_location} {"->"} {r.destination}</strong> ({r.departure_time}) <br />
                        Days: {r.days.join(', ')} | Status: {r.status}
                      </div>
                    ))}
                  </div>
                )}
              </div>
`;

const offerRideUI = `
            <div>
              {recurringRequests.filter(r => r.passenger_id !== user?.id && (r.status === 'Open' || (r.status === 'Accepted' && r.accepted_driver_id === user?.id))).length > 0 && (
                <div style={{ background: 'var(--odoo-teal)', color: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <h4 style={{ marginBottom: '1rem' }}>Recurring Requests from Colleagues</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {recurringRequests.filter(r => r.passenger_id !== user?.id && (r.status === 'Open' || (r.status === 'Accepted' && r.accepted_driver_id === user?.id))).map(r => (
                      <div key={r.id} style={{ background: 'white', color: 'black', padding: '1rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                          <strong style={{ fontSize: '1.1rem', color: 'var(--odoo-violet)' }}>{r.passenger_name}</strong> needs a ride:<br/>
                          <b>{r.pickup_location}</b> to <b>{r.destination}</b><br/>
                          Time: <b>{r.departure_time}</b> | Days: <b>{r.days.join(', ')}</b> | Seats: <b>{r.seats_needed}</b>
                        </div>
                        <div>
                          {r.status === 'Open' ? (
                            <button onClick={() => handleAcceptRecurring(r.id)} className="odoo-btn" style={{ padding: '0.5rem 1rem' }}>ACCEPT REQUEST</button>
                          ) : (
                            <span style={{ fontWeight: 'bold', color: 'green', padding: '0.5rem 1rem', border: '2px solid green', borderRadius: '4px' }}>ACCEPTED BY YOU</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
`;

// Replace find UI
content = content.replace('{activeTab === "find" && (\r\n          <div>', '{activeTab === "find" && (\r\n          <div>\r\n' + findRideUI);
content = content.replace('{activeTab === "find" && (\n          <div>', '{activeTab === "find" && (\n          <div>\n' + findRideUI);

// Replace offer UI
content = content.replace('{activeTab === "offer" && (\r\n          <div>', '{activeTab === "offer" && (\r\n          <div>\r\n' + offerRideUI);
content = content.replace('{activeTab === "offer" && (\n          <div>', '{activeTab === "offer" && (\n          <div>\n' + offerRideUI);


const submitReqFn = `
  const handleCreateRecurring = async (e) => {
    e.preventDefault();
    if (!reqPickup || !reqDest || !reqTime || recurringDays.length === 0) {
      alert("Please fill all fields and select at least one day.");
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/rides/recurring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: \`Bearer \${token}\`
        },
        body: JSON.stringify({
          pickupLocation: reqPickup,
          destination: reqDest,
          departureTime: reqTime,
          days: recurringDays,
          seatsNeeded: reqSeats
        })
      });
      if (res.ok) {
        alert('Recurring Request Sent!');
        setReqPickup(''); setReqDest(''); setReqTime(''); setRecurringDays([]); setIsRecurring(false);
        loadRecurringRequests();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed');
      }
    } catch (err) {
      console.error(err);
    }
  };
`;

if (!content.includes('handleCreateRecurring')) {
   content = content.replace('const handleBookRide = async', submitReqFn + '\n  const handleBookRide = async');
}

fs.writeFileSync(path, content, 'utf8');
console.log('UI injected back.');
