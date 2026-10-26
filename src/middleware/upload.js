'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const env = require('../config/env');
const { uid } = require('../utils/helpers');

// Ensure the upload directory exists.
fs.mkdirSync(env.uploadDir, { recursive: true });

const ALLOWED = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, env.uploadDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uid('DOC')}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (ALLOWED.has(file.mimetype)) return cb(null, true);
  cb(new Error('Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, DOC, DOCX.'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxUploadBytes, files: 1 },
});

module.exports = { upload };
