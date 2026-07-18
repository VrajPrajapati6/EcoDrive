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

export async function getOrganizations() {
  return request('/organizations');
}

export async function createOrganization(orgData) {
  return request('/organizations', {
    method: 'POST',
    body: JSON.stringify(orgData)
  });
}

export async function registerUser(userData) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

export async function loginUser(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
}

export async function getMe() {
  return request('/auth/me');
}
