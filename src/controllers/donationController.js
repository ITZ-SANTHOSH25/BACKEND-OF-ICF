'use strict';

const { Case, Donation } = require('../models');
const ApiError = require('../utils/ApiError');
const { uid, today, mapDonation } = require('../utils/helpers');
const env = require('../config/env');

const VERIFIED_CASE_STATUSES = ['approved', 'active', 'completed'];
const PENDING_PAYMENT = 'Pending Verification';
const VERIFIED_PAYMENT = 'Verified';
const REJECTED_PAYMENT = 'Rejected';

/*
 * Provider contract expected by this adapter:
 * POST UPI_VERIFY_API_URL with JSON { utr, amount, payeeVpa, caseId }
 * Authorization: Bearer UPI_VERIFY_API_KEY
 * Response JSON must contain:
 * { status: "SUCCESS", utr: "...", amount: 123.45, payeeVpa: "hospital@upi" }
 * The real bank/PSP provider must support server-side transaction lookup.
 * A donor-entered UTR or a QR/UPI intent alone is never proof of payment.
 */
async function verifyWithProvider({ utr, amount, payeeVpa, caseId }) {
  if (!env.upiVerifyApiUrl || !env.upiVerifyApiKey) {
    return { verified: false, reason: 'Automatic UPI verification is not configured. Donation remains pending.' };
  }
  let response;
  try {
    response = await fetch(env.upiVerifyApiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${env.upiVerifyApiKey}`
      },
      body: JSON.stringify({ utr, amount, payeeVpa, caseId }),
      signal: AbortSignal.timeout(10000)
    });
  } catch {
    return { verified: false, reason: 'Payment provider is unavailable. Donation remains pending.' };
  }
  if (!response.ok) {
    return { verified: false, reason: 'Payment provider could not verify this transaction. Donation remains pending.' };
  }
  let result;
  try { result = await response.json(); } catch {
    return { verified: false, reason: 'Invalid payment-provider response. Donation remains pending.' };
  }
  const providerStatus = String(result.status || '').toUpperCase();
  const providerUtr = String(result.utr || result.transactionId || result.transaction_id || '').trim();
  const providerAmount = Number(result.amount);
  const providerPayee = String(result.payeeVpa || result.payee_vpa || result.creditVpa || '').trim().toLowerCase();
  const expectedPayee = String(payeeVpa || '').trim().toLowerCase();
  const sameAmount = Number.isFinite(providerAmount) && Math.round(providerAmount * 100) === Math.round(amount * 100);
  const sameUtr = providerUtr && providerUtr.toLowerCase() === utr.toLowerCase();
  const samePayee = expectedPayee && providerPayee === expectedPayee;
  if (providerStatus !== 'SUCCESS' || !sameUtr || !sameAmount || !samePayee) {
    return { verified: false, reason: 'Provider transaction status, UTR, amount, or hospital UPI ID did not match.' };
  }
  return { verified: true, providerTransactionId: providerUtr };
}

async function countVerifiedDonation(donation, caseRow, actorId) {
  const updated = await Donation.findOneAndUpdate(
    { id: donation.id, status: PENDING_PAYMENT },
    { $set: { status: VERIFIED_PAYMENT, verified_by: actorId || 'payment-provider', verified_at: new Date().toISOString() } },
    { new: true }
  );
  if (!updated) return null;
  await Case.updateOne(
    { id: caseRow.id },
    { $inc: { raised_amount: donation.amount },
      $push: { donors: { name: donation.donor_name || 'Donor', amount: donation.amount, date: donation.date, donationId: donation.id } } }
  );
  return updated;
}

async function createDonation(req, res) {
  const body = req.body || {};
  const caseId = String(body.caseId || '').trim();
  const amount = Number(body.amount);
  const paymentRef = String(body.paymentRef || '').trim();
  if (!caseId) throw ApiError.badRequest('Case ID is required.');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) throw ApiError.badRequest('Enter a valid donation amount greater than zero.');
  if (paymentRef.length < 6 || paymentRef.length > 120) throw ApiError.badRequest('Enter the UPI transaction reference/UTR (6–120 characters).');

  const caseRow = await Case.findOne({ id: caseId }).lean();
  if (!caseRow || !VERIFIED_CASE_STATUSES.includes(caseRow.status)) throw ApiError.notFound('This case is not available for donations.');
  if (!caseRow.payment_upi_id && !caseRow.payment_qr_data) throw ApiError.badRequest('This case does not have hospital UPI payment details.');
  if (await Donation.findOne({ payment_ref: paymentRef }).lean()) throw ApiError.badRequest('This transaction reference has already been submitted.');

  const donor = req.user;
  let row = await Donation.create({
    id: uid('DON'), case_id: caseRow.id, donor_id: donor.id, patient: caseRow.patient_name,
    amount, date: today(), status: PENDING_PAYMENT, payment_ref: paymentRef,
    donor_name: donor.name || donor.email || 'Donor'
  });

  // Try server-side provider verification immediately. Fail closed if provider is
  // absent, unavailable, or does not confirm every field.
  const providerResult = await verifyWithProvider({
    utr: paymentRef, amount, payeeVpa: caseRow.payment_upi_id, caseId: caseRow.id
  });
  if (providerResult.verified) {
    const updated = await countVerifiedDonation(row.toObject(), caseRow, 'payment-provider');
    if (updated) row = updated;
  }
  res.status(201).json({
    success: true,
    data: {
      donation: mapDonation(row.toObject()),
      message: row.status === VERIFIED_PAYMENT
        ? 'Payment verified by the provider and added to the fundraising total.'
        : providerResult.reason || 'Payment submitted. It remains pending until the payment provider confirms it.'
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
  if (req.user.role === 'hospital' && caseRow.hospital_id !== req.user.id) throw ApiError.forbidden('You can only view donations for your own cases.');
  const rows = await Donation.find({ case_id: caseRow.id }).sort({ created_at: -1 }).lean();
  const total = rows.filter(r => r.status === VERIFIED_PAYMENT).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  res.json({ success: true, data: { donations: rows.map(mapDonation), total } });
}

async function verifyDonation(req, res) {
  const donation = await Donation.findOne({ id: req.params.id }).lean();
  if (!donation) throw ApiError.notFound('Donation not found.');
  const caseRow = await Case.findOne({ id: donation.case_id }).lean();
  if (!caseRow) throw ApiError.notFound('Case not found.');
  if (req.user.role === 'hospital' && caseRow.hospital_id !== req.user.id) throw ApiError.forbidden('You can only review donations for your own cases.');
  if (donation.status !== PENDING_PAYMENT) throw ApiError.badRequest('Only pending donations can be checked.');
  const result = await verifyWithProvider({
    utr: donation.payment_ref, amount: Number(donation.amount), payeeVpa: caseRow.payment_upi_id, caseId: caseRow.id
  });
  if (!result.verified) {
    return res.status(202).json({ success: true, data: {
      donation: mapDonation(donation),
      message: result.reason || 'Provider did not confirm payment. Donation remains pending.'
    }});
  }
  const updated = await countVerifiedDonation(donation, caseRow, 'payment-provider');
  if (!updated) throw ApiError.badRequest('This donation has already been processed.');
  res.json({ success: true, data: { donation: mapDonation(updated.toObject()), message: 'Provider verified the UTR, amount, and hospital UPI ID. Donation added to fundraising total.' } });
}

async function rejectDonation(req, res) {
  const donation = await Donation.findOne({ id: req.params.id }).lean();
  if (!donation) throw ApiError.notFound('Donation not found.');
  const caseRow = await Case.findOne({ id: donation.case_id }).lean();
  if (!caseRow) throw ApiError.notFound('Case not found.');
  if (req.user.role === 'hospital' && caseRow.hospital_id !== req.user.id) throw ApiError.forbidden('You can only review donations for your own cases.');
  if (donation.status !== PENDING_PAYMENT) throw ApiError.badRequest('Only pending donations can be rejected.');
  const updated = await Donation.findOneAndUpdate(
    { id: donation.id, status: PENDING_PAYMENT },
    { $set: { status: REJECTED_PAYMENT, verified_by: req.user.id, verified_at: new Date().toISOString(), rejection_reason: String(req.body?.reason || '').trim() } },
    { new: true }
  );
  if (!updated) throw ApiError.badRequest('This donation has already been processed.');
  res.json({ success: true, data: { donation: mapDonation(updated.toObject()), message: 'Donation rejected. The fundraising total was not changed.' } });
}

module.exports = { createDonation, myDonations, caseDonations, verifyDonation, rejectDonation };
