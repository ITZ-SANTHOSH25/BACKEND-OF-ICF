'use strict';

const express = require('express');
const ctrl = require('../controllers/dashboardController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.get('/donor', requireAuth, requireRole('donor'), asyncHandler(ctrl.donorDashboard));
router.get('/hospital', requireAuth, requireRole('hospital'), asyncHandler(ctrl.hospitalDashboard));
router.get('/authority', requireAuth, requireRole('authority'), asyncHandler(ctrl.authorityDashboard));

module.exports = router;
