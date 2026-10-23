'use strict';

const { db } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { hydrate } = require('./caseController');

/** GET /api/saved  (donor) — full case objects the donor has saved. */
function listSaved(req, res) {
  const rows = db
    .prepare(
      `SELECT c.* FROM saved_cases s
       JOIN cases c ON c.id = s.case_id
       WHERE s.donor_id = ?
       ORDER BY s.created_at DESC`
    )
    .all(req.user.id);
  res.json({ success: true, data: { cases: rows.map(hydrate), ids: rows.map((r) => r.id) } });
}

/** POST /api/saved/:caseId  (donor) */
function addSaved(req, res) {
  const c = db.prepare('SELECT id FROM cases WHERE id = ?').get(req.params.caseId);
  if (!c) throw ApiError.notFound('Case not found.');
  db.prepare('INSERT OR IGNORE INTO saved_cases (donor_id, case_id) VALUES (?, ?)').run(req.user.id, c.id);
  res.status(201).json({ success: true, data: { saved: true, caseId: c.id } });
}

/** DELETE /api/saved/:caseId  (donor) */
function removeSaved(req, res) {
  db.prepare('DELETE FROM saved_cases WHERE donor_id = ? AND case_id = ?').run(req.user.id, req.params.caseId);
  res.json({ success: true, data: { saved: false, caseId: req.params.caseId } });
}

module.exports = { listSaved, addSaved, removeSaved };
