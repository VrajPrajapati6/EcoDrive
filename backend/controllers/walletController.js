const { pool } = require('../config/supabase');

async function getWalletBalance(req, res) {
  const userId = req.user.id;
  try {
    const balanceRes = await pool.query(
      'SELECT wallet_balance FROM users WHERE id = $1',
      [userId]
    );
    const txRes = await pool.query(
      'SELECT id, amount, type, description, created_at FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
      [userId]
    );
    res.json({
      balance: balanceRes.rows[0]?.wallet_balance || 0,
      transactions: txRes.rows
    });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({ error: 'Failed to fetch wallet data' });
  }
}

async function rechargeWallet(req, res) {
  const userId = req.user.id;
  const { amount } = req.body;
  const parsedAmount = parseFloat(amount);
  if (!parsedAmount || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid recharge amount' });
  }
  try {
    await pool.query('BEGIN');
    await pool.query(
      'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
      [parsedAmount, userId]
    );
    await pool.query(
      'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
      [userId, parsedAmount, 'Recharge', `Wallet recharged with $${parsedAmount.toFixed(2)}`]
    );
    await pool.query('COMMIT');
    const newBalanceRes = await pool.query('SELECT wallet_balance FROM users WHERE id = $1', [userId]);
    res.json({ message: 'Wallet recharged successfully', balance: newBalanceRes.rows[0].wallet_balance });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error recharging wallet:', error);
    res.status(500).json({ error: 'Failed to recharge wallet' });
  }
}

async function payBooking(req, res) {
  const userId = req.user.id;
  const { bookingId, method } = req.body;

  const validMethods = ['Cash', 'Card', 'UPI', 'Wallet'];
  if (!bookingId || !validMethods.includes(method)) {
    return res.status(400).json({ error: 'Invalid payment request. Provide bookingId and a valid method.' });
  }

  try {
    await pool.query('BEGIN');

    // Fetch booking and join ride for fare details
    const bookingRes = await pool.query(`
      SELECT b.*, r.driver_id, r.pickup_location, r.destination
      FROM bookings b
      JOIN rides r ON b.ride_id = r.id
      WHERE b.id = $1 AND b.passenger_id = $2
    `, [bookingId, userId]);

    if (bookingRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found or not authorized' });
    }

    const booking = bookingRes.rows[0];

    if (booking.payment_status === 'Paid') {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'This booking has already been paid' });
    }

    if (booking.status !== 'Confirmed') {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Only confirmed bookings can be paid' });
    }

    const fare = parseFloat(booking.fare) || 0;
    const description = `Ride: ${booking.pickup_location} → ${booking.destination}`;

    if (method === 'Wallet') {
      // Check passenger balance
      const passengerRes = await pool.query('SELECT wallet_balance FROM users WHERE id = $1', [userId]);
      const balance = parseFloat(passengerRes.rows[0].wallet_balance) || 0;
      if (balance < fare) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient wallet balance. You have $${balance.toFixed(2)}, but need $${fare.toFixed(2)}.` });
      }
      // Deduct from passenger
      await pool.query('UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2', [fare, userId]);
      // Add to driver
      await pool.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [fare, booking.driver_id]);
      // Log passenger payment transaction
      await pool.query(
        'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
        [userId, -fare, 'Payment', `Payment for: ${description}`]
      );
      // Log driver received transaction
      await pool.query(
        'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
        [booking.driver_id, fare, 'Received', `Received for: ${description}`]
      );
    }

    // Mark booking as paid
    await pool.query(
      'UPDATE bookings SET payment_status = $1, payment_method = $2 WHERE id = $3',
      ['Paid', method, bookingId]
    );

    await pool.query('COMMIT');
    res.json({ message: `Payment of $${fare.toFixed(2)} via ${method} recorded successfully` });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
}

// Get completed, unpaid bookings for current user (as passenger)
async function getUnpaidBookings(req, res) {
  const userId = req.user.id;
  try {
    const result = await pool.query(`
      SELECT b.id as booking_id, b.seats_booked, b.fare, b.payment_status, b.payment_method,
             b.pickup_location as my_pickup_location,
             r.pickup_location, r.destination, r.departure_date, r.departure_time,
             u.full_name as driver_name
      FROM bookings b
      JOIN rides r ON b.ride_id = r.id
      JOIN users u ON r.driver_id = u.id
      WHERE b.passenger_id = $1
        AND b.status = 'Confirmed'
        AND (r.status = 'Completed' OR r.status = 'Open' OR r.status = 'In Progress')
        AND b.payment_status = 'Unpaid'
      ORDER BY r.departure_date DESC
    `, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching unpaid bookings:', error);
    res.status(500).json({ error: 'Failed to fetch unpaid bookings' });
  }
}

module.exports = { getWalletBalance, rechargeWallet, payBooking, getUnpaidBookings };
