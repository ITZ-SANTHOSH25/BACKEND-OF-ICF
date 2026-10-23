'use strict';

const express = require('express');
const ctrl = require('../controllers/caseController');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Public / donor browsing (personalised when authenticated).
router.get('/', optionalAuth, asyncHandler(ctrl.listCases));
router.get('/meta', asyncHandler(ctrl.caseMeta));
router.get('/:id', optionalAuth, asyncHandler(ctrl.getCase));

// Hospital management.
router.post('/', requireAuth, requireRole('hospital'), asyncHandler(ctrl.createCase));
router.put('/:id', requireAuth, requireRole('hospital'), asyncHandler(ctrl.updateCase));
router.post('/:id/documents', requireAuth, requireRole('hospital'), upload.single('file'), asyncHandler(ctrl.addDocument));
router.delete('/:id/documents/:docId', requireAuth, requireRole('hospital'), asyncHandler(ctrl.removeDocument));
router.post('/:id/resubmit', requireAuth, requireRole('hospital'), asyncHandler(ctrl.resubmitCase));
router.post('/:id/start', requireAuth, requireRole('hospital'), asyncHandler(ctrl.startTreatment));
router.post('/:id/complete', requireAuth, requireRole('hospital'), asyncHandler(ctrl.completeTreatment));

// Authority verification.
router.post('/:id/verify', requireAuth, requireRole('authority'), asyncHandler(ctrl.verifyCase));
router.post('/:id/decline', requireAuth, requireRole('authority'), asyncHandler(ctrl.declineCase));

module.exports = router;
