'use strict';

const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'LifeLink API', time: new Date().toISOString() } });
});

router.use('/auth', require('./authRoutes'));
router.use('/cases', require('./caseRoutes'));
router.use('/donations', require('./donationRoutes'));
router.use('/saved', require('./savedRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/history', require('./historyRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/profile', require('./profileRoutes'));

module.exports = router;
