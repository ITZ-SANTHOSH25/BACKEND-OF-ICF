'use strict';

const { customAlphabet } = require('nanoid');

const nano = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

/** Generate an id like `CASE-7F3K9Q` or `DON-2AB4CD`. */
function uid(prefix) {
  return `${prefix}-${nano()}`;
}

/** Today's date as YYYY-MM-DD. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Map a case row (snake_case) to the camelCase shape the frontend expects. */
function mapCase(row, extras = {}) {
  if (!row) return null;
  return {
    id: row.id,
    patientName: row.patient_name,
    age: row.age,
    gender: row.gender,
    location: row.location,
    diagnosis: row.diagnosis,
    treatment: row.treatment,
    durationDays: row.duration_days,
    emergency: row.emergency,
    estimatedCost: row.estimated_cost,
    raisedAmount: row.raised_amount,
    hospitalName: row.hospital_name,
    hospitalId: row.hospital_reg_id,
    hospitalAddress: row.hospital_address,
    hospitalContact: row.hospital_contact,
    hospitalEmail: row.hospital_email,
    doctorName: row.doctor_name,
    doctorRegNo: row.doctor_reg_no,
    status: row.status,
    submittedDate: row.submitted_date,
    verifiedDate: row.verified_date,
    declineReason: row.decline_reason,
    documents: extras.documents || [],
    donors: extras.donors || [],
  };
}

/** Map a donation row to the frontend shape. */
function mapDonation(row) {
  if (!row) return null;
  return {
    id: row.id,
    caseId: row.case_id,
    patient: row.patient,
    amount: row.amount,
    date: row.date,
    status: row.status,
    paymentRef: row.payment_ref,
  };
}

/** Map a notification row. */
function mapNotification(row) {
  return {
    id: row.id,
    t: row.title,
    d: row.detail,
    when: row.created_at,
    read: !!row.is_read,
  };
}

module.exports = { uid, today, mapCase, mapDonation, mapNotification };
