const express = require('express');
const router = express.Router();
const { getOrganizations, createOrganization } = require('../controllers/orgController');

router.get('/', getOrganizations);
router.post('/', createOrganization);

module.exports = router;
