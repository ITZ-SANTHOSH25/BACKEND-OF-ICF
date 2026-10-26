'use strict';

const {
  User,
  Donation,
  Saved,
  Hospital,
  Authority,
  Settings
} = require('../models');

const ApiError = require('../utils/ApiError');
const { publicUser } = require('./authController');
const { uid } = require('../utils/helpers');

async function getProfile(req, res) {
  const user = req.user;
  const data = {
    user: await publicUser(user)
  };

  if (user.role === 'donor') {
    const donations = await Donation.find({
      donor_id: user.id
    }).lean();

    data.stats = {
      totalDonated: donations.reduce(
        (sum, donation) => sum + donation.amount,
        0
      ),
      casesSupported: new Set(
        donations.map(donation => donation.case_id)
      ).size,
      savedCases: await Saved.countDocuments({
        donor_id: user.id
      })
    };
  }

  res.json({
    success: true,
    data
  });
}

async function updateProfile(req, res) {
  const b = req.body || {};
  const patch = {};

  for (const key of ['name', 'phone', 'location']) {
    if (b[key] !== undefined) {
      patch[key] = b[key];
    }
  }

  if (Object.keys(patch).length) {
    await User.updateOne(
      { id: req.user.id },
      { $set: patch }
    );
  }

  if (req.user.role === 'hospital' && b.org) {
    const x = b.org;
    const p = {};

    for (const [a, c] of [
      ['name', 'name'],
      ['address', 'address'],
      ['contact', 'contact'],
      ['email', 'email'],
      ['doctor', 'doctor']
    ]) {
      if (x[a] !== undefined) {
        p[c] = x[a];
      }
    }

    if (Object.keys(p).length) {
      await Hospital.updateOne(
        { user_id: req.user.id },
        { $set: p }
      );
    }
  }

  if (req.user.role === 'authority' && b.org) {
    const x = b.org;
    const p = {};

    for (const key of ['name', 'officer', 'email']) {
      if (x[key] !== undefined) {
        p[key] = x[key];
      }
    }

    if (Object.keys(p).length) {
      await Authority.updateOne(
        { user_id: req.user.id },
        { $set: p }
      );
    }
  }

  const fresh = await User.findOne({
    id: req.user.id
  }).lean();

  res.json({
    success: true,
    data: {
      user: await publicUser(fresh)
    }
  });
}

async function getSettings(req, res) {
  let row = await Settings.findOne({
    user_id: req.user.id
  }).lean();

  if (!row) {
    row = await Settings.create({
      id: uid('SET'),
      user_id: req.user.id
    });
  }

  res.json({
    success: true,
    data: {
      settings: {
        notifications: row.notifications,
        privacy: row.privacy
      }
    }
  });
}

async function updateSettings(req, res) {
  const b = req.body || {};
  const set = {};

  if (b.notifications !== undefined) {
    if (typeof b.notifications === 'boolean') {
      set.notifications = b.notifications;
    } else if (typeof b.notifications === 'string') {
      const value = b.notifications.toLowerCase();

      if (['enabled', 'true'].includes(value)) {
        set.notifications = true;
      } else if (['muted', 'disabled', 'false'].includes(value)) {
        set.notifications = false;
      } else {
        throw new ApiError(400, 'Invalid notifications value');
      }
    } else {
      throw new ApiError(400, 'Invalid notifications value');
    }
  }

  if (b.privacy !== undefined) {
    if (
      typeof b.privacy !== 'string' ||
      !['public', 'private'].includes(b.privacy.toLowerCase())
    ) {
      throw new ApiError(400, 'Invalid privacy value');
    }

    set.privacy = b.privacy.toLowerCase();
  }

  const row = await Settings.findOneAndUpdate(
    { user_id: req.user.id },
    {
      $set: set,
      $setOnInsert: {
        id: uid('SET'),
        user_id: req.user.id
      }
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  res.json({
    success: true,
    data: {
      settings: {
        notifications: row.notifications,
        privacy: row.privacy
      }
    }
  });
}

module.exports = {
  getProfile,
  updateProfile,
  getSettings,
  updateSettings
};
