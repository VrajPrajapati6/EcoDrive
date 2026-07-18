const express = require('express');
const router = express.Router();
const { 
  getOrganizationRidesReport, 
  getOrganizationEmployees, 
  toggleEmployeeStatus,
  getOrganizationVehicles,
  toggleVehicleApproval,
  updateOrganizationSettings,
  adminAddEmployee,
  adminAddVehicle
} = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.get('/reports/rides', getOrganizationRidesReport);
router.get('/employees', getOrganizationEmployees);
router.post('/employees', adminAddEmployee);
router.put('/employees/:employeeId/status', toggleEmployeeStatus);
router.get('/vehicles', getOrganizationVehicles);
router.post('/vehicles', adminAddVehicle);
router.put('/vehicles/:vehicleId/status', toggleVehicleApproval);
router.put('/settings', updateOrganizationSettings);

module.exports = router;
