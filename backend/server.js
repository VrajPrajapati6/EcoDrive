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

// Get chat messages
app.get('/api/rides/:id/messages', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, sender_id as "senderId", sender_name as "senderName", message, timestamp FROM ride_messages WHERE ride_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
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

  // Initiate Call - Ring other users
  socket.on('initiate_call', ({ rideId, callerName }) => {
    const roomName = `ride_${rideId}`;
    // Broadcast to the text chat room to ring other users
    socket.to(roomName).emit('incoming_call', { callerName });
  });

  // WebRTC Audio Voice Call Signaling Relays
  socket.on('join_voice_call', ({ rideId, userId, userName }) => {
    const roomName = `voice_${rideId}`;
    socket.join(roomName);
    console.log(`User ${userName} (${userId}) joined voice room ${roomName}`);
    
    // Broadcast to other peers in this room that a new peer joined
    socket.to(roomName).emit('user_joined_voice', {
      socketId: socket.id,
      userId,
      userName
    });
  });

  socket.on('send_signal', ({ targetSocketId, signal }) => {
    // Relay WebRTC signal to target peer
    io.to(targetSocketId).emit('receive_signal', {
      senderSocketId: socket.id,
      signal
    });
  });

  socket.on('leave_voice_call', ({ rideId }) => {
    const roomName = `voice_${rideId}`;
    socket.leave(roomName);
    socket.to(roomName).emit('user_left_voice', { socketId: socket.id });
    console.log(`Socket ${socket.id} left voice room ${roomName}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    // Broadcast exit to any room this socket was in
    socket.broadcast.emit('user_left_voice', { socketId: socket.id });
  });
});

server.listen(PORT, () => {
  console.log(` EcoDrive Backend Server listening on port ${PORT}`);
});
