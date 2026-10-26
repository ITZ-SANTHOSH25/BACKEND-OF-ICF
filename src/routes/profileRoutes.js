'use strict';

const express = require('express');
const ctrl = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.use(requireAuth);
router.get('/', asyncHandler(ctrl.getProfile));
router.put('/', asyncHandler(ctrl.updateProfile));
router.get('/settings', asyncHandler(ctrl.getSettings));
router.put('/settings', asyncHandler(ctrl.updateSettings));

module.exports = router;
