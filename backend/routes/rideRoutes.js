const express = require('express');
const router = express.Router();
const { offerRide, searchRides, bookRide, getRideHistory, completeOrDeleteRide, updateBookingStatus, startRide, getBookingMessages } = require('../controllers/rideController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/offer', offerRide);
router.get('/search', searchRides);
router.post('/book', bookRide);
router.get('/history', getRideHistory);
router.put('/:id/complete', completeOrDeleteRide);
router.put('/:id/start', startRide);
router.put('/bookings/:bookingId/status', updateBookingStatus);
router.get('/bookings/:bookingId/messages', getBookingMessages);

router.get('/:id/messages', async (req, res) => {
  console.log(`[backend] Fetching messages for ride ID: ${req.params.id}`);
  try {
    const { pool } = require('../config/supabase');
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

module.exports = router;
