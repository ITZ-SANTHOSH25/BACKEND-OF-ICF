'use strict';

const express = require('express');
const ctrl = require('../controllers/donationController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.post('/', requireAuth, requireRole('donor'), asyncHandler(ctrl.createDonation));
router.get('/', requireAuth, requireRole('donor'), asyncHandler(ctrl.myDonations));
router.get('/case/:caseId', requireAuth, requireRole('hospital', 'authority'), asyncHandler(ctrl.caseDonations));

module.exports = router;
