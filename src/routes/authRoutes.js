'use strict';

const express = require('express');
const ctrl = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.post('/register', asyncHandler(ctrl.register));
router.post('/login', asyncHandler(ctrl.login));
router.post('/forgot-password', asyncHandler(ctrl.forgotPassword));
router.get('/me', requireAuth, asyncHandler(ctrl.me));
router.post('/logout', asyncHandler(ctrl.logout));

module.exports = router;
