-- ============================================================
-- LifeLink — SQLite schema
-- Mirrors the data model used by the frontend (donors, hospitals,
-- health authorities, treatment cases, donations, verification).
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------- Users (all three roles) ----------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role          TEXT    NOT NULL CHECK (role IN ('donor','hospital','authority')),
  name          TEXT    NOT NULL DEFAULT '',
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  phone         TEXT    DEFAULT '',
  location      TEXT    DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Hospital profile ----------
CREATE TABLE IF NOT EXISTS hospitals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL DEFAULT '',
  reg_id     TEXT    UNIQUE,
  address    TEXT    DEFAULT '',
  contact    TEXT    DEFAULT '',
  email      TEXT    DEFAULT '',
  doctor     TEXT    DEFAULT ''
);

-- ---------- Health authority profile ----------
CREATE TABLE IF NOT EXISTS authorities (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL DEFAULT '',
  authority_id TEXT    UNIQUE,
  officer      TEXT    DEFAULT '',
  email        TEXT    DEFAULT ''
);

-- ---------- Treatment cases ----------
CREATE TABLE IF NOT EXISTS cases (
  id               TEXT    PRIMARY KEY,
  patient_name     TEXT    NOT NULL,
  age              INTEGER DEFAULT 0,
  gender           TEXT    DEFAULT '—',
  location         TEXT    DEFAULT '—',
  diagnosis        TEXT    NOT NULL,
  treatment        TEXT    NOT NULL,
  duration_days    INTEGER DEFAULT 0,
  emergency        TEXT    DEFAULT 'Medium' CHECK (emergency IN ('High','Medium','Low')),
  estimated_cost   REAL    NOT NULL DEFAULT 0,
  raised_amount    REAL    NOT NULL DEFAULT 0,
  hospital_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  hospital_name    TEXT    DEFAULT '',
  hospital_reg_id  TEXT    DEFAULT '',
  hospital_address TEXT    DEFAULT '',
  hospital_contact TEXT    DEFAULT '',
  hospital_email   TEXT    DEFAULT '',
  doctor_name      TEXT    DEFAULT '',
  doctor_reg_no    TEXT    DEFAULT '',
  status           TEXT    NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','declined','active','completed')),
  submitted_date   TEXT    NOT NULL DEFAULT (date('now')),
  verified_date    TEXT    DEFAULT '',
  decline_reason   TEXT    DEFAULT '',
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cases_status   ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_hospital ON cases(hospital_id);

-- ---------- Case documents ----------
CREATE TABLE IF NOT EXISTS case_documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id     TEXT    NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  doc_type    TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  stored_name TEXT    DEFAULT '',
  path        TEXT    DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'Uploaded',
  uploaded_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docs_case ON case_documents(case_id);

-- ---------- Donations ----------
CREATE TABLE IF NOT EXISTS donations (
  id          TEXT    PRIMARY KEY,
  case_id     TEXT    NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  donor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  patient     TEXT    DEFAULT '',
  amount      REAL    NOT NULL,
  date        TEXT    NOT NULL DEFAULT (date('now')),
  status      TEXT    NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Completed')),
  payment_ref TEXT    DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_donations_case  ON donations(case_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_id);

-- ---------- Donation tracking entries shown on a case ----------
CREATE TABLE IF NOT EXISTS case_donors (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id  TEXT    NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  donor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name     TEXT    DEFAULT 'Anonymous',
  amount   REAL    NOT NULL,
  date     TEXT    NOT NULL DEFAULT (date('now'))
);
CREATE INDEX IF NOT EXISTS idx_case_donors_case ON case_donors(case_id);

-- ---------- Saved cases (donor) ----------
CREATE TABLE IF NOT EXISTS saved_cases (
  donor_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id    TEXT    NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (donor_id, case_id)
);

-- ---------- Notifications ----------
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  detail     TEXT    DEFAULT '',
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

-- ---------- Verification history (audit trail) ----------
CREATE TABLE IF NOT EXISTS verification_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id    TEXT    NOT NULL,
  action     TEXT    NOT NULL,
  actor      TEXT    DEFAULT '',
  actor_id   INTEGER,
  date       TEXT    NOT NULL DEFAULT (date('now')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_history_case ON verification_history(case_id);

-- ---------- Per-user settings ----------
CREATE TABLE IF NOT EXISTS settings (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications TEXT DEFAULT 'Enabled',
  privacy       TEXT DEFAULT 'Show my name publicly',
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
