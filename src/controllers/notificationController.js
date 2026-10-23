'use strict';

const { db } = require('../config/db');
const { mapNotification } = require('../utils/helpers');
const ApiError = require('../utils/ApiError');

/** Internal helper — create a notification for a user. */
function notify(userId, title, detail = '') {
  if (!userId) return;
  db.prepare('INSERT INTO notifications (user_id, title, detail) VALUES (?, ?, ?)').run(userId, title, detail);
}

/** GET /api/notifications */
function listNotifications(req, res) {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100')
    .all(req.user.id);
  const unread = rows.filter((r) => !r.is_read).length;
  res.json({ success: true, data: { notifications: rows.map(mapNotification), unread } });
}

/** PUT /api/notifications/:id/read */
function markRead(req, res) {
  const row = db
    .prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!row) throw ApiError.notFound('Notification not found.');
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(row.id);
  res.json({ success: true, data: { notification: mapNotification({ ...row, is_read: 1 }) } });
}

/** PUT /api/notifications/read-all */
function markAllRead(req, res) {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ success: true, data: { message: 'All notifications marked as read.' } });
}

module.exports = { notify, listNotifications, markRead, markAllRead };
