'use strict';

const { Case, Donation } = require('../models');
const ApiError = require('../utils/ApiError');
const { uid, today, mapDonation } = require('../utils/helpers');

const VERIFIED_CASE_STATUSES = ['approved', 'active', 'completed'];
const PENDING_PAYMENT = 'Pending Verification';
const VERIFIED_PAYMENT = 'Verified';
const REJECTED_PAYMENT = 'Rejected';

async function createDonation(req, res) {
  const body = req.body || {};
  const caseId = String(body.caseId || '').trim();
  const amount = Number(body.amount);
  const paymentRef = String(body.paymentRef || '').trim();
  if (!caseId) throw ApiError.badRequest('Case ID is required.');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    throw ApiError.badRequest('Enter a valid donation amount greater than zero.');
  }
  if (paymentRef.length < 6 || paymentRef.length > 120) {
    throw ApiError.badRequest('Enter the UPI transaction reference/UTR (6–120 characters).');
  }

  const caseRow = await Case.findOne({ id: caseId }).lean();
  if (!caseRow || !VERIFIED_CASE_STATUSES.includes(caseRow.status)) {
    throw ApiError.notFound('This case is not available for donations.');
  }
  if (!caseRow.payment_upi_id && !caseRow.payment_qr_data) {
    throw ApiError.badRequest('This case does not have hospital UPI payment details.');
  }

  const existingRef = await Donation.findOne({ payment_ref: paymentRef }).lean();
  if (existingRef) {
    throw ApiError.badRequest('This transaction reference has already been submitted.');
  }

  const donor = req.user;
  const row = await Donation.create({
    id: uid('DON'),
    case_id: caseRow.id,
    donor_id: donor.id,
    patient: caseRow.patient_name,
    amount,
    date: today(),
    status: PENDING_PAYMENT,
    payment_ref: paymentRef,
    donor_name: donor.name || donor.email || 'Donor'
  });

  // Deliberately do not change Case.raised_amount here. Only a verified payment
  // is included in the fundraising total.
  res.status(201).json({
    success: true,
    data: {
      donation: mapDonation(row.toObject()),
      message: 'Payment submitted for manual verification. The fundraising total has not changed yet.'
    }
  });
}

async function myDonations(req, res) {
  const rows = await Donation.find({ donor_id: req.user.id }).sort({ created_at: -1 }).lean();
  res.json({ success: true, data: { donations: rows.map(mapDonation) } });
}

async function caseDonations(req, res) {
  const caseRow = await Case.findOne({ id: req.params.caseId }).lean();
  if (!caseRow) throw ApiError.notFound('Case not found.');
  if (req.user.role === 'hospital' && caseRow.hospital_id !== req.user.id) {
    throw ApiError.forbidden('You can only view donations for your own cases.');
  }
  const rows = await Donation.find({ case_id: caseRow.id }).sort({ created_at: -1 }).lean();
  const total = rows.filter(r => r.status === VERIFIED_PAYMENT).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  res.json({ success: true, data: { donations: rows.map(mapDonation), total } });
}

async function verifyDonation(req, res) {
  const donation = await Donation.findOne({ id: req.params.id }).lean();
  if (!donation) throw ApiError.notFound('Donation not found.');
  const caseRow = await Case.findOne({ id: donation.case_id }).lean();
  if (!caseRow) throw ApiError.notFound('Case not found.');
  if (req.user.role === 'hospital' && caseRow.hospital_id !== req.user.id) {
    throw ApiError.forbidden('You can only verify donations for your own cases.');
  }
  if (donation.status !== PENDING_PAYMENT) {
    throw ApiError.badRequest('Only pending donations can be verified.');
  }

  // Conditional update prevents the same donation from being counted twice.
  const updated = await Donation.findOneAndUpdate(
    { id: donation.id, status: PENDING_PAYMENT },
    { $set: { status: VERIFIED_PAYMENT, verified_by: req.user.id, verified_at: new Date().toISOString() } },
    { new: true }
  );
  if (!updated) throw ApiError.badRequest('This donation has already been processed.');

  await Case.updateOne(
    { id: caseRow.id },
    {
      $inc: { raised_amount: donation.amount },
      $push: { donors: { name: donation.donor_name || 'Donor', amount: donation.amount, date: donation.date, donationId: donation.id } }
    }
  );

  res.json({ success: true, data: { donation: mapDonation(updated.toObject()), message: 'Donation verified and added to the fundraising total.' } });
}

async function rejectDonation(req, res) {
  const donation = await Donation.findOne({ id: req.params.id }).lean();
  if (!donation) throw ApiError.notFound('Donation not found.');
  const caseRow = await Case.findOne({ id: donation.case_id }).lean();
  if (!caseRow) throw ApiError.notFound('Case not found.');
  if (req.user.role === 'hospital' && caseRow.hospital_id !== req.user.id) {
    throw ApiError.forbidden('You can only review donations for your own cases.');
  }
  if (donation.status !== PENDING_PAYMENT) {
    throw ApiError.badRequest('Only pending donations can be rejected.');
  }
  const updated = await Donation.findOneAndUpdate(
    { id: donation.id, status: PENDING_PAYMENT },
    { $set: { status: REJECTED_PAYMENT, verified_by: req.user.id, verified_at: new Date().toISOString(), rejection_reason: String(req.body?.reason || '').trim() } },
    { new: true }
  );
  if (!updated) throw ApiError.badRequest('This donation has already been processed.');
  res.json({ success: true, data: { donation: mapDonation(updated.toObject()), message: 'Donation rejected. The fundraising total was not changed.' } });
}

module.exports = { createDonation, myDonations, caseDonations, verifyDonation, rejectDonation };
