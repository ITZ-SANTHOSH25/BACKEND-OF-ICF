'use strict';

const { db } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { uid, today, mapDonation } = require('../utils/helpers');
const { notify } = require('./notificationController');

const VERIFIED = ['approved', 'active', 'completed'];

/**
 * POST /api/donations  (donor)
 * Body: { caseId, amount, anonymous? }
 */
function createDonation(req, res) {
  const { caseId, amount, anonymous } = req.body || {};
  const amt = Number(amount);

  if (!caseId) throw ApiError.badRequest('caseId is required.');
  if (!amt || amt < 100) throw ApiError.badRequest('Minimum donation is ₹100.');

  const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId);
  if (!c) throw ApiError.notFound('Case not found.');
  if (!VERIFIED.includes(c.status)) throw ApiError.badRequest('This case is not open for donations.');

  const donorName = anonymous ? 'Anonymous' : (req.user.name || 'Anonymous');

  const run = db.transaction(() => {
    // Cap the raised amount at the estimated cost.
    const newRaised = Math.min(c.estimated_cost, c.raised_amount + amt);
    db.prepare(`UPDATE cases SET raised_amount = ?, updated_at = datetime('now') WHERE id = ?`).run(newRaised, c.id);

    db.prepare(
      `INSERT INTO case_donors (case_id, donor_id, name, amount, date) VALUES (?, ?, ?, ?, ?)`
    ).run(c.id, req.user.id, donorName, amt, today());

    const donId = uid('DON');
    db.prepare(
      `INSERT INTO donations (id, case_id, donor_id, patient, amount, date, status, payment_ref)
       VALUES (?, ?, ?, ?, ?, ?, 'Active', ?)`
    ).run(donId, c.id, req.user.id, c.patient_name, amt, today(), uid('PAY'));

    return donId;
  });

  const donId = run();

  if (c.hospital_id) {
    notify(c.hospital_id, 'New donation received', `₹${amt.toLocaleString('en-IN')} contributed to ${c.patient_name} (${c.id}).`);
  }
  notify(req.user.id, 'Donation confirmed', `Thank you! Your ₹${amt.toLocaleString('en-IN')} contribution to ${c.patient_name} was recorded.`);

  const donation = db.prepare('SELECT * FROM donations WHERE id = ?').get(donId);
  res.status(201).json({ success: true, data: { donation: mapDonation(donation) } });
}

/** GET /api/donations  (donor) — own donation history */
function myDonations(req, res) {
  const rows = db
    .prepare('SELECT * FROM donations WHERE donor_id = ? ORDER BY id DESC')
    .all(req.user.id);
  res.json({ success: true, data: { donations: rows.map(mapDonation) } });
}

/** GET /api/donations/case/:caseId  (hospital owner or authority) */
function caseDonations(req, res) {
  const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.caseId);
  if (!c) throw ApiError.notFound('Case not found.');

  if (req.user.role === 'hospital' && c.hospital_id !== req.user.id) {
    throw ApiError.forbidden('You can only view donations for your own cases.');
  }

  const rows = db
    .prepare('SELECT * FROM donations WHERE case_id = ? ORDER BY id DESC')
    .all(c.id);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  res.json({ success: true, data: { donations: rows.map(mapDonation), total } });
}

module.exports = { createDonation, myDonations, caseDonations };
