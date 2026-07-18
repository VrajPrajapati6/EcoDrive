const express = require('express');
const router = express.Router();
const { addVehicle, getMyVehicles } = require('../controllers/vehicleController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.post('/', addVehicle);
router.get('/', getMyVehicles);

module.exports = router;
