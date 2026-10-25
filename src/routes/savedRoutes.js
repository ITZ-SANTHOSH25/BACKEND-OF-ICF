'use strict';

const express = require('express');
const ctrl = require('../controllers/savedController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.use(requireAuth, requireRole('donor'));
router.get('/', asyncHandler(ctrl.listSaved));
router.post('/:caseId', asyncHandler(ctrl.addSaved));
router.delete('/:caseId', asyncHandler(ctrl.removeSaved));

module.exports = router;
