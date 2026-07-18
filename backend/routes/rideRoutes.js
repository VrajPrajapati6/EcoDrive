const express = require('express');
const router = express.Router();
const { offerRide, searchRides, bookRide, getRideHistory, completeOrDeleteRide, updateBookingStatus } = require('../controllers/rideController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/offer', offerRide);
router.get('/search', searchRides);
router.post('/book', bookRide);
router.get('/history', getRideHistory);
router.put('/:id/complete', completeOrDeleteRide);
router.put('/bookings/:bookingId/status', updateBookingStatus);

module.exports = router;
