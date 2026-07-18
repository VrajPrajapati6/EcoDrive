const express = require('express');
const router = express.Router();
const { getWalletBalance, rechargeWallet, payBooking, getUnpaidBookings } = require('../controllers/walletController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/balance', getWalletBalance);
router.post('/recharge', rechargeWallet);
router.post('/pay', payBooking);
router.get('/unpaid-bookings', getUnpaidBookings);

module.exports = router;
