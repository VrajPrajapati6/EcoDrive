const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const orgRoutes = require('./routes/orgRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const rideRoutes = require('./routes/rideRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'EcoDrive Backend with Supabase is running accurately!' });
});

app.listen(PORT, () => {
  console.log(`🚀 EcoDrive Backend Server listening on port ${PORT}`);
});
