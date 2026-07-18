const express = require('express');
const router = express.Router();
const { getOrganizationRidesReport } = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.get('/reports/rides', getOrganizationRidesReport);

module.exports = router;
