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

  // Handle live text message
  socket.on('send_message', ({ rideId, message, senderId, senderName }) => {
    const roomName = `ride_${rideId}`;
    io.to(roomName).emit('receive_message', {
      id: Math.random().toString(36).substring(7),
      message,
      senderId,
      senderName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // Handle voice chat push-to-talk broadcast
  socket.on('voice_note', ({ rideId, audioBase64, senderId, senderName }) => {
    const roomName = `ride_${rideId}`;
    socket.to(roomName).emit('receive_voice_note', {
      id: Math.random().toString(36).substring(7),
      audioBase64,
      senderId,
      senderName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
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
