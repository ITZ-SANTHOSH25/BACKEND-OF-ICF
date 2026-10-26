'use strict';

const express = require('express');
const ctrl = require('../controllers/donationController');
const paymentCtrl = require('../controllers/paymentController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.post('/create-order', requireAuth, requireRole('donor'), asyncHandler(paymentCtrl.createGatewayOrder));
router.get('/status/:orderId', requireAuth, requireRole('donor'), asyncHandler(paymentCtrl.checkGatewayStatus));
router.get('/', requireAuth, requireRole('donor'), asyncHandler(ctrl.myDonations));
router.get('/case/:caseId', requireAuth, requireRole('hospital', 'authority'), asyncHandler(ctrl.caseDonations));

module.exports = router;
