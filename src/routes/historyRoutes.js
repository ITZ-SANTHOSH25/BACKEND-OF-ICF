'use strict';

const express = require('express');
const ctrl = require('../controllers/historyController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.get('/', requireAuth, requireRole('authority'), asyncHandler(ctrl.listHistory));

module.exports = router;
