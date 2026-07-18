const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const orgRoutes = require('./routes/orgRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const rideRoutes = require('./routes/rideRoutes');
const adminRoutes = require('./routes/adminRoutes');
const walletRoutes = require('./routes/walletRoutes');
const { pool } = require('./config/supabase');

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
app.use('/api/wallet', walletRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'EcoDrive Backend with Supabase is running accurately!' });
});



const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.io connection logic
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Join a specific ride room
  socket.on('join_ride', ({ rideId, userId, userName }) => {
    const roomName = `ride_${rideId}`;
    socket.join(roomName);
    console.log(`User ${userName} (${userId}) joined room ${roomName}`);
  });

  // Handle live location update from driver
  socket.on('update_location', async ({ rideId, lat, lon, eta }) => {
    const roomName = `ride_${rideId}`;
    // Broadcast to all passengers in the ride room
    io.to(roomName).emit('location_updated', { lat, lon, eta });
    // Persist to DB
    try {
      await pool.query(
        'UPDATE rides SET current_lat = $1, current_lon = $2, current_eta = $3 WHERE id = $4',
        [lat, lon, eta, rideId]
      );
    } catch (err) {
      console.error('Error saving live location to DB:', err);
    }
  });

  // Handle live text message
  socket.on('send_message', async ({ rideId, message, senderId, senderName }) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      const res = await pool.query(
        'INSERT INTO ride_messages (ride_id, sender_id, sender_name, message, timestamp) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [rideId, senderId, senderName, message, timestamp]
      );
      const roomName = `ride_${rideId}`;
      io.to(roomName).emit('receive_message', {
        id: res.rows[0].id,
        message,
        senderId,
        senderName,
        timestamp
      });
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(` EcoDrive Backend Server listening on port ${PORT}`);
});

// Global error handling to prevent unexpected crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});
