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

// Online presence registry: userId -> Set of socket.ids
const onlineUsers = new Map();

// Socket.io connection logic
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Register user for presence status tracking
  socket.on('register_user', ({ userId }) => {
    if (!userId) return;
    const strUserId = String(userId);
    socket.userId = strUserId;
    if (!onlineUsers.has(strUserId)) {
      onlineUsers.set(strUserId, new Set());
    }
    onlineUsers.get(strUserId).add(socket.id);
    console.log(`User ${strUserId} registered. Active sockets: ${onlineUsers.get(strUserId).size}`);
    
    // Broadcast user online status
    io.emit('user_presence', { userId: strUserId, status: 'Online' });
  });

  // Check presence manually
  socket.on('check_user_presence', ({ targetUserId }, callback) => {
    if (!targetUserId) return;
    const strTarget = String(targetUserId);
    const isOnline = onlineUsers.has(strTarget) && onlineUsers.get(strTarget).size > 0;
    if (typeof callback === 'function') {
      callback({ status: isOnline ? 'Online' : 'Offline' });
    }
  });

  // Join a booking conversation room
  socket.on('join_booking_chat', ({ bookingId, userId, userName }) => {
    const roomName = `booking_${bookingId}`;
    socket.join(roomName);
    console.log(`User ${userName} (${userId}) joined chat room ${roomName}`);
  });

  // Join a specific ride room (legacy/location updates)
  socket.on('join_ride', ({ rideId, userId, userName }) => {
    const roomName = `ride_${rideId}`;
    socket.join(roomName);
    console.log(`User ${userName} (${userId}) joined room ${roomName}`);
  });

  // Handle live location update from driver
  socket.on('update_location', async ({ rideId, lat, lon, eta }) => {
    const roomName = `ride_${rideId}`;
    io.to(roomName).emit('location_updated', { lat, lon, eta });
    try {
      await pool.query(
        'UPDATE rides SET current_lat = $1, current_lon = $2, current_eta = $3 WHERE id = $4',
        [lat, lon, eta, rideId]
      );
    } catch (err) {
      console.error('Error saving live location to DB:', err);
    }
  });

  // Typing status indicator update
  socket.on('typing_status', ({ bookingId, isTyping, userName }) => {
    const roomName = `booking_${bookingId}`;
    socket.to(roomName).emit('typing_status', { bookingId, isTyping, userName });
  });

  // Send booking one-to-one message
  socket.on('send_booking_message', async ({ bookingId, message, senderId, senderName, clientId }) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      // 1. Deduplicate message using clientId
      if (clientId) {
        const duplicateCheck = await pool.query(
          'SELECT id FROM ride_messages WHERE client_id = $1',
          [clientId]
        );
        if (duplicateCheck.rows.length > 0) {
          console.log(`Duplicate message block blocked for clientId ${clientId}`);
          return;
        }
      }

      // 2. Fetch booking to identify ride_id and recipient_id
      const bookingRes = await pool.query(`
        SELECT b.passenger_id, r.driver_id, r.id as ride_id
        FROM bookings b
        JOIN rides r ON b.ride_id = r.id
        WHERE b.id = $1
      `, [bookingId]);

      if (bookingRes.rows.length === 0) return;
      const booking = bookingRes.rows[0];
      const recipientId = String(senderId) === String(booking.passenger_id) ? booking.driver_id : booking.passenger_id;

      // 3. Check if recipient is online
      const isRecipientOnline = onlineUsers.has(String(recipientId)) && onlineUsers.get(String(recipientId)).size > 0;
      const status = isRecipientOnline ? 'Delivered' : 'Sent';

      // 4. Save to database
      const res = await pool.query(`
        INSERT INTO ride_messages (ride_id, booking_id, sender_id, sender_name, message, timestamp, client_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, created_at
      `, [booking.ride_id, bookingId, senderId, senderName, message, timestamp, clientId || null, status]);

      const messageId = res.rows[0].id;
      const createdAt = res.rows[0].created_at;

      // 5. Broadcast to room
      const roomName = `booking_${bookingId}`;
      io.to(roomName).emit('receive_booking_message', {
        id: messageId,
        bookingId,
        message,
        senderId,
        senderName,
        timestamp,
        clientId,
        status,
        createdAt
      });
    } catch (err) {
      console.error('Error handling send_booking_message:', err);
    }
  });

  // Mark messages as read
  socket.on('read_booking_messages', async ({ bookingId, userId }) => {
    try {
      await pool.query(`
        UPDATE ride_messages 
        SET status = 'Read' 
        WHERE booking_id = $1 AND sender_id != $2 AND status != 'Read'
      `, [bookingId, userId]);

      const roomName = `booking_${bookingId}`;
      socket.to(roomName).emit('messages_read_receipt', { bookingId, readBy: userId });
    } catch (err) {
      console.error('Error updating read receipts:', err);
    }
  });

  // Mark message as delivered
  socket.on('mark_message_delivered', async ({ messageId, bookingId }) => {
    try {
      await pool.query(`
        UPDATE ride_messages 
        SET status = 'Delivered' 
        WHERE id = $1 AND status = 'Sent'
      `, [messageId]);

      const roomName = `booking_${bookingId}`;
      socket.to(roomName).emit('message_status_update', { messageId, status: 'Delivered' });
    } catch (err) {
      console.error('Error updating delivery receipt:', err);
    }
  });

  // Legacy send_message support
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
      console.error('Error saving legacy message:', err);
    }
  });

  // Disconnect presence tracking
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (socket.userId) {
      const userSockets = onlineUsers.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(socket.userId);
          io.emit('user_presence', { userId: socket.userId, status: 'Offline', lastActive: new Date() });
          console.log(`User ${socket.userId} went completely offline.`);
        }
      }
    }
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
