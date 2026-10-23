'use strict';

const express = require('express');
const ctrl = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.use(requireAuth);
router.get('/', asyncHandler(ctrl.listNotifications));
router.put('/read-all', asyncHandler(ctrl.markAllRead));
router.put('/:id/read', asyncHandler(ctrl.markRead));

module.exports = router;
