// db.js — SQLite schema + prepared statements (better-sqlite3, synchronous & fast).
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(config.dataDir, { recursive: true });

const db = new Database(path.join(config.dataDir, 'partypix.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id            TEXT PRIMARY KEY,          -- public, unguessable album id (in the URL/QR)
    admin_token   TEXT NOT NULL,             -- secret; grants host/moderation powers
    title         TEXT NOT NULL,
    event_date    TEXT,                      -- ISO date string, optional
    accent        TEXT NOT NULL DEFAULT '#EC4899',
    welcome_note  TEXT,
    host_email    TEXT,
    allow_downloads INTEGER NOT NULL DEFAULT 1,
    plan          TEXT NOT NULL DEFAULT 'free',
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS photos (
    id          TEXT PRIMARY KEY,
    event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    uploader    TEXT NOT NULL DEFAULT 'Guest',
    caption     TEXT,
    full_key    TEXT NOT NULL,               -- storage key/path of full image
    thumb_key   TEXT NOT NULL,               -- storage key/path of thumbnail
    width       INTEGER,
    height      INTEGER,
    bytes       INTEGER NOT NULL DEFAULT 0,
    likes       INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_photos_event ON photos(event_id, created_at DESC);
`);

const stmts = {
  insertEvent: db.prepare(`
    INSERT INTO events (id, admin_token, title, event_date, accent, welcome_note, host_email, allow_downloads, plan, created_at)
    VALUES (@id, @admin_token, @title, @event_date, @accent, @welcome_note, @host_email, @allow_downloads, @plan, @created_at)
  `),
  getEvent: db.prepare(`SELECT * FROM events WHERE id = ?`),
  updateEvent: db.prepare(`
    UPDATE events SET title=@title, event_date=@event_date, accent=@accent,
      welcome_note=@welcome_note, allow_downloads=@allow_downloads WHERE id=@id
  `),
  deleteEvent: db.prepare(`DELETE FROM events WHERE id = ?`),

  insertPhoto: db.prepare(`
    INSERT INTO photos (id, event_id, uploader, caption, full_key, thumb_key, width, height, bytes, likes, created_at)
    VALUES (@id, @event_id, @uploader, @caption, @full_key, @thumb_key, @width, @height, @bytes, 0, @created_at)
  `),
  listPhotos: db.prepare(`SELECT * FROM photos WHERE event_id = ? ORDER BY created_at DESC`),
  getPhoto: db.prepare(`SELECT * FROM photos WHERE id = ?`),
  deletePhoto: db.prepare(`DELETE FROM photos WHERE id = ?`),
  likePhoto: db.prepare(`UPDATE photos SET likes = likes + ? WHERE id = ?`),
  countPhotos: db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(bytes),0) AS bytes FROM photos WHERE event_id = ?`),
  distinctUploaders: db.prepare(`SELECT COUNT(DISTINCT uploader) AS n FROM photos WHERE event_id = ?`),
};

module.exports = { db, stmts };
