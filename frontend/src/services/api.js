const API_BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = localStorage.getItem('ecodrive_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong during API request');
  }
  return data;
}

// Auth & Orgs
export async function getOrganizations() { return request('/organizations'); }
export async function createOrganization(orgData) { return request('/organizations', { method: 'POST', body: JSON.stringify(orgData) }); }
export async function registerUser(userData) { return request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }); }
export async function loginUser(credentials) { return request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }); }
export async function getMe() { return request('/auth/me'); }

// Vehicles
export async function addVehicle(vehicleData) { return request('/vehicles', { method: 'POST', body: JSON.stringify(vehicleData) }); }
export async function getMyVehicles() { return request('/vehicles'); }

// Rides
export async function offerRide(rideData) { return request('/rides/offer', { method: 'POST', body: JSON.stringify(rideData) }); }
export async function searchRides() { return request('/rides/search'); }
export async function bookRide(bookingData) { return request('/rides/book', { method: 'POST', body: JSON.stringify(bookingData) }); }
export async function getRideHistory() { return request('/rides/history'); }
export async function completeOrDeleteRide(id, action, reason) { return request(`/rides/${id}/complete`, { method: 'PUT', body: JSON.stringify({ action, reason }) }); }
export async function updateBookingStatus(bookingId, status, reason) { return request(`/rides/bookings/${bookingId}/status`, { method: 'PUT', body: JSON.stringify({ status, reason }) }); }
// Admin
export async function getOrganizationRidesReport() { return request('/admin/reports/rides'); }
export async function getOrganizationEmployees() { return request('/admin/employees'); }
export async function toggleEmployeeStatus(employeeId, isActive) { return request(`/admin/employees/${employeeId}/status`, { method: 'PUT', body: JSON.stringify({ isActive }) }); }
export async function getOrganizationVehicles() { return request('/admin/vehicles'); }
export async function toggleVehicleApproval(vehicleId, isApproved) { return request(`/admin/vehicles/${vehicleId}/status`, { method: 'PUT', body: JSON.stringify({ isApproved }) }); }
export async function updateOrganizationSettings(settings) { return request('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }); }
export async function adminAddEmployee(employeeData) { return request('/admin/employees', { method: 'POST', body: JSON.stringify(employeeData) }); }
export async function adminAddVehicle(vehicleData) { return request('/admin/vehicles', { method: 'POST', body: JSON.stringify(vehicleData) }); }
