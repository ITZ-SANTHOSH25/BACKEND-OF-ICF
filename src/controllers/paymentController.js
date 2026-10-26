'use strict';

const { Case, Donation } = require('../models');
const ApiError = require('../utils/ApiError');
const { uid, today, mapDonation } = require('../utils/helpers');
const env = require('../config/env');

function cashfreeBase() {
  return env.cashfreeEnvironment === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';
}
async function cashfreeRequest(path, options = {}) {
  if (!env.cashfreeAppId || !env.cashfreeSecretKey) {
    throw ApiError.badRequest('Cashfree is not configured. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY in Render environment variables.');
  }
  const response = await fetch(`${cashfreeBase()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': env.cashfreeAppId,
      'x-client-secret': env.cashfreeSecretKey,
      'x-api-version': env.cashfreeApiVersion,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(15000)
  });
  let body = {};
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    const message = body.message || body.type || 'Cashfree request failed.';
    throw ApiError.badRequest(`Payment gateway: ${message}`);
  }
  return body;
}
async function createGatewayOrder(req, res) {
  const caseId = String(req.body?.caseId || '').trim();
  const amount = Number(req.body?.amount);
  if (!caseId) throw ApiError.badRequest('Case ID is required.');
  if (!Number.isFinite(amount) || amount < 1 || amount > 1000000) {
    throw ApiError.badRequest('Enter a donation amount between ₹1 and ₹10,00,000.');
  }
  const caseRow = await Case.findOne({ id: caseId }).lean();
  if (!caseRow || !['approved', 'active', 'completed'].includes(caseRow.status)) {
    throw ApiError.notFound('This case is not available for donations.');
  }
  const donor = req.user;
  if (!donor.phone || !/^\d{10}$/.test(String(donor.phone).replace(/\D/g, '').slice(-10))) {
    throw ApiError.badRequest('Add a valid 10-digit mobile number to your donor profile before paying.');
  }
  const orderId = `ICF${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const returnUrl = env.frontendReturnUrl
    ? `${env.frontendReturnUrl}${env.frontendReturnUrl.includes('?') ? '&' : '?'}payment_order_id=${encodeURIComponent(orderId)}`
    : undefined;
  const customerPhone = String(donor.phone).replace(/\D/g, '').slice(-10);
  const orderPayload = {
    order_id: orderId,
    order_amount: Number(amount.toFixed(2)),
    order_currency: 'INR',
    customer_details: {
      customer_id: String(donor.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50),
      customer_name: String(donor.name || 'ICF Donor').slice(0, 100),
      customer_email: String(donor.email).slice(0, 100),
      customer_phone: customerPhone
    },
    order_note: `ICF donation ${caseRow.id}`,
    order_meta: returnUrl ? { return_url: returnUrl } : undefined
  };
  const cf = await cashfreeRequest('/orders', { method: 'POST', body: JSON.stringify(orderPayload) });
  if (!cf.payment_session_id) throw ApiError.badRequest('Cashfree did not return a payment session. Please try again.');
  const donation = await Donation.create({
    id: uid('DON'), case_id: caseRow.id, donor_id: donor.id,
    patient: caseRow.patient_name, amount: Number(amount.toFixed(2)),
    date: today(), status: 'Pending Payment', payment_ref: '',
    cashfree_order_id: orderId, payment_session_id: cf.payment_session_id,
    donor_name: donor.name || donor.email || 'Donor'
  });
  res.status(201).json({
    success: true,
    data: { orderId, paymentSessionId: cf.payment_session_id, donation: mapDonation(donation.toObject()), environment: env.cashfreeEnvironment }
  });
}
async function checkGatewayStatus(req, res) {
  const orderId = String(req.params.orderId || '');
  const donation = await Donation.findOne({ cashfree_order_id: orderId, donor_id: req.user.id });
  if (!donation) throw ApiError.notFound('Payment order not found.');
  if (donation.status === 'Verified') {
    return res.json({ success: true, data: { status: 'SUCCESS', donation: mapDonation(donation.toObject()), message: 'Payment is already confirmed.' } });
  }
  const orders = await cashfreeRequest(`/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
  const paymentStatus = String(orders.order_status || '').toUpperCase();
  if (paymentStatus === 'PAID') {
    const caseRow = await Case.findOne({ id: donation.case_id }).lean();
    if (!caseRow) throw ApiError.notFound('Treatment case not found.');
    const updated = await Donation.findOneAndUpdate(
      { id: donation.id, status: { $ne: 'Verified' } },
      { $set: { status: 'Verified', payment_ref: orderId, verified_by: 'cashfree', verified_at: new Date().toISOString() } },
      { new: true }
    );
    if (updated) {
      await Case.updateOne(
        { id: caseRow.id },
        { $inc: { raised_amount: donation.amount },
          $push: { donors: { name: donation.donor_name || 'Donor', amount: donation.amount, date: donation.date, donationId: donation.id } } }
      );
    }
    const latest = updated || await Donation.findOne({ id: donation.id });
    return res.json({ success: true, data: { status: 'SUCCESS', donation: mapDonation(latest.toObject()), message: 'Cashfree confirmed the payment.' } });
  }
  if (['EXPIRED', 'TERMINATED', 'CANCELLED'].includes(paymentStatus)) {
    donation.status = 'Payment Failed';
    await donation.save();
  }
  res.json({ success: true, data: { status: paymentStatus || 'PENDING', donation: mapDonation(donation.toObject()), message: paymentStatus === 'PAID' ? 'Payment confirmed.' : 'Payment is not yet confirmed. Refresh status in a moment.' } });
}
module.exports = { createGatewayOrder, checkGatewayStatus };
