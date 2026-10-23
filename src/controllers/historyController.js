'use strict';

const { db } = require('../config/db');
const { today } = require('../utils/helpers');

/** Internal helper — append an entry to the verification audit trail. */
function logHistory(caseId, action, actor, actorId) {
  db.prepare(
    `INSERT INTO verification_history (case_id, action, actor, actor_id, date)
     VALUES (?, ?, ?, ?, ?)`
  ).run(caseId, action, actor || '', actorId || null, today());
}

/** GET /api/history  (authority) — optional ?caseId= */
function listHistory(req, res) {
  const { caseId } = req.query;
  const rows = caseId
    ? db.prepare('SELECT * FROM verification_history WHERE case_id = ? ORDER BY id DESC').all(caseId)
    : db.prepare('SELECT * FROM verification_history ORDER BY id DESC LIMIT 200').all();

  res.json({
    success: true,
    data: {
      history: rows.map((r) => ({
        id: r.case_id,
        action: r.action,
        by: r.actor,
        date: r.date,
      })),
    },
  });
}

module.exports = { logHistory, listHistory };
