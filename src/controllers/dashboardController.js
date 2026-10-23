'use strict';

const { db } = require('../config/db');
const { hydrate } = require('./caseController');

const VERIFIED = ['approved', 'active', 'completed'];

/** GET /api/dashboard/donor */
function donorDashboard(req, res) {
  const verified = db.prepare(`SELECT * FROM cases WHERE status IN ('approved','active','completed')`).all();
  const totalRaised = verified.reduce((s, c) => s + c.raised_amount, 0);
  const active = verified.filter((c) => c.status === 'active' || c.status === 'approved');
  const completed = verified.filter((c) => c.status === 'completed');
  const myDonations = db.prepare('SELECT * FROM donations WHERE donor_id = ?').all(req.user.id);
  const myTotal = myDonations.reduce((s, d) => s + d.amount, 0);

  const recent = [...verified]
    .sort((a, b) => (a.submitted_date < b.submitted_date ? 1 : -1))
    .slice(0, 3);

  res.json({
    success: true,
    data: {
      stats: {
        totalVerifiedCases: verified.length,
        totalAmountRaised: totalRaised,
        activeCampaigns: active.length,
        yourTotalDonations: myTotal,
        contributions: myDonations.length,
      },
      recentCases: recent.map(hydrate),
      completedCases: completed.map(hydrate),
    },
  });
}

/** GET /api/dashboard/hospital */
function hospitalDashboard(req, res) {
  const mine = db.prepare('SELECT * FROM cases WHERE hospital_id = ?').all(req.user.id);
  const by = (s) => mine.filter((c) => c.status === s).length;
  const totalEst = mine.reduce((s, c) => s + c.estimated_cost, 0);
  const recent = mine.slice(0, 3);

  res.json({
    success: true,
    data: {
      stats: {
        registeredCases: mine.length,
        pending: by('pending'),
        approved: by('approved') + by('active'),
        declined: by('declined'),
        activeCampaigns: by('active'),
        completed: by('completed'),
        totalEstimatedAmount: totalEst,
      },
      recentCases: recent.map(hydrate),
    },
  });
}

/** GET /api/dashboard/authority */
function authorityDashboard(req, res) {
  const all = db.prepare('SELECT * FROM cases').all();
  const by = (s) => all.filter((c) => c.status === s).length;
  const pending = all.filter((c) => c.status === 'pending');

  res.json({
    success: true,
    data: {
      stats: {
        pending: by('pending'),
        approved: by('approved') + by('active') + by('completed'),
        declined: by('declined'),
        active: by('active'),
        completed: by('completed'),
      },
      pendingCases: pending.slice(0, 3).map(hydrate),
    },
  });
}

module.exports = { donorDashboard, hospitalDashboard, authorityDashboard };
