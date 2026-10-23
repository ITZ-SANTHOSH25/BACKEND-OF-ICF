'use strict';

const { db } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { uid, today, mapCase } = require('../utils/helpers');
const { notify } = require('./notificationController');
const { logHistory } = require('./historyController');

const VERIFIED = ['approved', 'active', 'completed'];

/** Load documents + donor-tracking entries for a case id. */
function hydrate(row) {
  if (!row) return null;
  const documents = db
    .prepare('SELECT doc_type AS key, name, status FROM case_documents WHERE case_id = ? ORDER BY id')
    .all(row.id);
  const donors = db
    .prepare('SELECT name, amount, date FROM case_donors WHERE case_id = ? ORDER BY id DESC')
    .all(row.id);
  return mapCase(row, { documents, donors });
}

/** Fetch a case row or throw 404. */
function mustFind(id) {
  const row = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
  if (!row) throw ApiError.notFound('Case not found.');
  return row;
}

/**
 * GET /api/cases
 * Query: q, condition, type, amount(low|mid|high), duration(short|medium|long),
 *        location, sort(recent|funded), status, scope(mine|verified|all)
 * Donors only ever see verified cases; hospitals see their own; authorities see all.
 */
function listCases(req, res) {
  const {
    q = '', condition = '', type = '', amount = '', duration = '',
    location = '', sort = '', status = '', scope = '',
  } = req.query;

  const where = [];
  const params = [];

  const role = req.user ? req.user.role : null;

  if (role === 'hospital') {
    where.push('hospital_id = ?');
    params.push(req.user.id);
    if (status) { where.push('status = ?'); params.push(status); }
  } else if (role === 'authority') {
    if (status) { where.push('status = ?'); params.push(status); }
  } else {
    // donors / anonymous: only verified cases
    where.push(`status IN ('approved','active','completed')`);
  }

  if (q) {
    where.push('(patient_name LIKE ? OR diagnosis LIKE ? OR treatment LIKE ? OR hospital_name LIKE ? OR id LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (condition) { where.push('diagnosis = ?'); params.push(condition); }
  if (type) { where.push('treatment = ?'); params.push(type); }
  if (location) { where.push('location = ?'); params.push(location); }

  if (amount === 'low') where.push('estimated_cost < 500000');
  else if (amount === 'mid') where.push('estimated_cost BETWEEN 500000 AND 1500000');
  else if (amount === 'high') where.push('estimated_cost > 1500000');

  if (duration === 'short') where.push('duration_days < 60');
  else if (duration === 'medium') where.push('duration_days BETWEEN 60 AND 150');
  else if (duration === 'long') where.push('duration_days > 150');

  let order = 'submitted_date DESC, created_at DESC';
  if (sort === 'funded') order = '(raised_amount * 1.0 / NULLIF(estimated_cost,0)) DESC';
  if (sort === 'recent') order = 'submitted_date DESC, created_at DESC';

  const sql = `SELECT * FROM cases ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order}`;
  const rows = db.prepare(sql).all(...params);

  res.json({ success: true, data: { cases: rows.map(hydrate), count: rows.length } });
}

/** GET /api/cases/:id */
function getCase(req, res) {
  const row = mustFind(req.params.id);
  const role = req.user ? req.user.role : null;

  // Donors/anonymous may only view verified cases.
  if (!role || role === 'donor') {
    if (!VERIFIED.includes(row.status)) throw ApiError.notFound('Case not found.');
  }
  // Hospitals may only view their own cases.
  if (role === 'hospital' && row.hospital_id !== req.user.id) {
    throw ApiError.forbidden('You can only view your own cases.');
  }

  res.json({ success: true, data: { case: hydrate(row) } });
}

/** GET /api/cases/meta — distinct filter values for the donor toolbar. */
function caseMeta(req, res) {
  const conditions = db.prepare(`SELECT DISTINCT diagnosis AS v FROM cases WHERE status IN ('approved','active','completed') AND diagnosis <> '' ORDER BY v`).all().map(r => r.v);
  const types = db.prepare(`SELECT DISTINCT treatment AS v FROM cases WHERE status IN ('approved','active','completed') AND treatment <> '' ORDER BY v`).all().map(r => r.v);
  const locations = db.prepare(`SELECT DISTINCT location AS v FROM cases WHERE status IN ('approved','active','completed') AND location <> '' ORDER BY v`).all().map(r => r.v);
  res.json({ success: true, data: { conditions, types, locations } });
}

/**
 * POST /api/cases  (hospital)
 * Body: the wizard `data` object. Creates a case in `pending` state.
 */
function createCase(req, res) {
  const b = req.body || {};
  const required = ['patientName', 'age', 'diagnosis', 'treatment', 'estimatedCost', 'durationDays'];
  const missing = required.filter((k) => !String(b[k] ?? '').trim());
  if (missing.length) throw ApiError.badRequest(`Missing required fields: ${missing.join(', ')}`);

  const hospital = db.prepare('SELECT * FROM hospitals WHERE user_id = ?').get(req.user.id);
  const id = uid('CASE');

  db.prepare(
    `INSERT INTO cases (
       id, patient_name, age, gender, location, diagnosis, treatment, duration_days,
       emergency, estimated_cost, raised_amount, hospital_id, hospital_name, hospital_reg_id,
       hospital_address, hospital_contact, hospital_email, doctor_name, doctor_reg_no,
       status, submitted_date
     ) VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?, 'pending', ?)`
  ).run(
    id,
    b.patientName,
    Number(b.age) || 0,
    b.gender || '—',
    b.hospitalAddress || b.location || '—',
    b.diagnosis,
    b.treatment,
    Number(b.durationDays) || 0,
    ['High', 'Medium', 'Low'].includes(b.emergency) ? b.emergency : 'Medium',
    Number(b.estimatedCost) || 0,
    req.user.id,
    b.hospitalName || (hospital && hospital.name) || '',
    b.hospitalId || (hospital && hospital.reg_id) || '',
    b.hospitalAddress || (hospital && hospital.address) || '',
    b.hospitalContact || (hospital && hospital.contact) || '',
    b.hospitalEmail || (hospital && hospital.email) || '',
    b.doctorName || (hospital && hospital.doctor) || '',
    b.doctorRegNo || '',
    today()
  );

  logHistory(id, 'Submitted for verification', req.user.name || req.user.email, req.user.id);

  // Notify every authority officer about the new case.
  const officers = db.prepare(`SELECT id FROM users WHERE role = 'authority'`).all();
  officers.forEach((o) => notify(o.id, 'New case submitted', `${id} (${b.patientName}) awaits verification.`));

  const row = mustFind(id);
  res.status(201).json({ success: true, data: { case: hydrate(row) } });
}

/**
 * PUT /api/cases/:id  (hospital, only while pending/declined)
 */
function updateCase(req, res) {
  const row = mustFind(req.params.id);
  if (row.hospital_id !== req.user.id) throw ApiError.forbidden('You can only edit your own cases.');
  if (!['pending', 'declined'].includes(row.status)) {
    throw ApiError.badRequest('Only pending or declined cases can be edited.');
  }

  const b = req.body || {};
  const fields = {
    patient_name: b.patientName,
    age: b.age !== undefined ? Number(b.age) : undefined,
    diagnosis: b.diagnosis,
    treatment: b.treatment,
    duration_days: b.durationDays !== undefined ? Number(b.durationDays) : undefined,
    emergency: b.emergency,
    estimated_cost: b.estimatedCost !== undefined ? Number(b.estimatedCost) : undefined,
    hospital_address: b.hospitalAddress,
    hospital_contact: b.hospitalContact,
    hospital_email: b.hospitalEmail,
    doctor_name: b.doctorName,
    doctor_reg_no: b.doctorRegNo,
  };

  const sets = [];
  const params = [];
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) { sets.push(`${col} = ?`); params.push(val); }
  }
  if (!sets.length) throw ApiError.badRequest('No fields to update.');

  sets.push(`updated_at = datetime('now')`);
  params.push(row.id);
  db.prepare(`UPDATE cases SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  res.json({ success: true, data: { case: hydrate(mustFind(row.id)) } });
}

/** POST /api/cases/:id/documents  (hospital, multipart form-data, field "file") */
function addDocument(req, res) {
  const row = mustFind(req.params.id);
  if (row.hospital_id !== req.user.id) throw ApiError.forbidden('You can only upload to your own cases.');
  if (!req.file) throw ApiError.badRequest('No file uploaded (expected field "file").');

  const docType = req.body.docType || 'medical';
  db.prepare(
    `INSERT INTO case_documents (case_id, doc_type, name, stored_name, path, status)
     VALUES (?, ?, ?, ?, ?, 'Uploaded')`
  ).run(row.id, docType, req.file.originalname, req.file.filename, `/uploads/${req.file.filename}`);

  res.status(201).json({ success: true, data: { case: hydrate(mustFind(row.id)) } });
}

/** DELETE /api/cases/:id/documents/:docId  (hospital) */
function removeDocument(req, res) {
  const row = mustFind(req.params.id);
  if (row.hospital_id !== req.user.id) throw ApiError.forbidden('You can only modify your own cases.');
  db.prepare('DELETE FROM case_documents WHERE id = ? AND case_id = ?').run(req.params.docId, row.id);
  res.json({ success: true, data: { case: hydrate(mustFind(row.id)) } });
}

/** POST /api/cases/:id/resubmit  (hospital) */
function resubmitCase(req, res) {
  const row = mustFind(req.params.id);
  if (row.hospital_id !== req.user.id) throw ApiError.forbidden('You can only resubmit your own cases.');
  if (row.status !== 'declined') throw ApiError.badRequest('Only declined cases can be resubmitted.');

  db.prepare(`UPDATE cases SET status='pending', decline_reason='', updated_at=datetime('now') WHERE id = ?`).run(row.id);
  logHistory(row.id, 'Resubmitted for verification', req.user.name || req.user.email, req.user.id);

  const officers = db.prepare(`SELECT id FROM users WHERE role = 'authority'`).all();
  officers.forEach((o) => notify(o.id, 'Case resubmitted', `${row.id} is back in the verification queue.`));

  res.json({ success: true, data: { case: hydrate(mustFind(row.id)) } });
}

/** POST /api/cases/:id/verify  (authority) */
function verifyCase(req, res) {
  const row = mustFind(req.params.id);
  if (row.status !== 'pending') throw ApiError.badRequest('Only pending cases can be verified.');

  db.prepare(`UPDATE cases SET status='approved', verified_date=?, decline_reason='', updated_at=datetime('now') WHERE id = ?`)
    .run(today(), row.id);
  logHistory(row.id, 'Approved', req.user.name || req.user.email, req.user.id);

  // Notify the hospital and all donors.
  if (row.hospital_id) notify(row.hospital_id, 'Case verified', `${row.id} (${row.patient_name}) is now approved and open for donations.`);
  db.prepare(`SELECT id FROM users WHERE role='donor'`).all()
    .forEach((d) => notify(d.id, 'New verified case', `${row.id} (${row.patient_name}) is now open for donations.`));

  res.json({ success: true, data: { case: hydrate(mustFind(row.id)) } });
}

/** POST /api/cases/:id/decline  (authority) body { reason } */
function declineCase(req, res) {
  const row = mustFind(req.params.id);
  if (row.status !== 'pending') throw ApiError.badRequest('Only pending cases can be declined.');

  const reason = (req.body && req.body.reason ? String(req.body.reason) : '').trim();
  if (!reason) throw ApiError.badRequest('A reason is required to decline a case.');

  db.prepare(`UPDATE cases SET status='declined', decline_reason=?, updated_at=datetime('now') WHERE id = ?`)
    .run(reason, row.id);
  logHistory(row.id, 'Declined', req.user.name || req.user.email, req.user.id);

  if (row.hospital_id) notify(row.hospital_id, 'Case declined', `${row.id} was declined: ${reason}`);

  res.json({ success: true, data: { case: hydrate(mustFind(row.id)) } });
}

/** POST /api/cases/:id/start  (hospital) — approved -> active */
function startTreatment(req, res) {
  const row = mustFind(req.params.id);
  if (row.hospital_id !== req.user.id) throw ApiError.forbidden('You can only manage your own cases.');
  if (row.status !== 'approved') throw ApiError.badRequest('Only approved cases can start treatment.');

  db.prepare(`UPDATE cases SET status='active', updated_at=datetime('now') WHERE id = ?`).run(row.id);
  logHistory(row.id, 'Treatment started', req.user.name || req.user.email, req.user.id);
  res.json({ success: true, data: { case: hydrate(mustFind(row.id)) } });
}

/** POST /api/cases/:id/complete  (hospital) — active -> completed */
function completeTreatment(req, res) {
  const row = mustFind(req.params.id);
  if (row.hospital_id !== req.user.id) throw ApiError.forbidden('You can only manage your own cases.');
  if (row.status !== 'active') throw ApiError.badRequest('Only active cases can be completed.');

  db.prepare(`UPDATE cases SET status='completed', updated_at=datetime('now') WHERE id = ?`).run(row.id);
  logHistory(row.id, 'Completed', req.user.name || req.user.email, req.user.id);

  // Mark all donations for this case as Completed.
  db.prepare(`UPDATE donations SET status='Completed' WHERE case_id = ?`).run(row.id);
  res.json({ success: true, data: { case: hydrate(mustFind(row.id)) } });
}

module.exports = {
  listCases, getCase, caseMeta, createCase, updateCase,
  addDocument, removeDocument, resubmitCase,
  verifyCase, declineCase, startTreatment, completeTreatment,
  hydrate, mustFind,
};
