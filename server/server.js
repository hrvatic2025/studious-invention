// server.js — PartyPix API + static host.
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const QRCode = require('qrcode');
const archiver = require('archiver');
const rateLimit = require('express-rate-limit');
const { customAlphabet } = require('nanoid');
const path = require('path');
const crypto = require('crypto');

const config = require('./config');
const { stmts } = require('./db');
const { storage } = require('./storage');

const app = express();
app.set('trust proxy', 1); // behind nginx / App Platform load balancer

// Readable, unguessable ids (no ambiguous chars).
const eventId = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 9);
const photoId = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 12);
const newToken = () => crypto.randomBytes(24).toString('base64url');

app.use(express.json({ limit: '1mb' }));
if (config.corsOrigins.length) app.use(cors({ origin: config.corsOrigins }));

// ---------- helpers ----------
function baseUrl(req) {
  if (config.publicUrl) return config.publicUrl;
  return `${req.protocol}://${req.get('host')}`;
}
function planCap(plan) {
  return plan === 'pro' ? config.limits.proPlanPhotoCap : config.limits.freePlanPhotoCap;
}
function publicEvent(e) {
  return {
    id: e.id, title: e.title, eventDate: e.event_date, accent: e.accent,
    welcomeNote: e.welcome_note, allowDownloads: !!e.allow_downloads, plan: e.plan,
  };
}
function publicPhoto(p) {
  return {
    id: p.id, uploader: p.uploader, caption: p.caption || '',
    url: storage.publicUrl(p.full_key), thumb: storage.publicUrl(p.thumb_key),
    width: p.width, height: p.height, likes: p.likes, createdAt: p.created_at,
  };
}
// admin auth via Authorization: Bearer <token>
function requireAdmin(req, res, next) {
  const ev = stmts.getEvent.get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Album not found' });
  const tok = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!tok || tok !== ev.admin_token) return res.status(403).json({ error: 'Not authorized for this album' });
  req.event = ev;
  next();
}

// ---------- rate limiters ----------
const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const uploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.limits.maxFileBytes, files: config.limits.maxFilesPerRequest },
});

// ---------- create an album ----------
app.post('/api/events', createLimiter, (req, res) => {
  const { title, eventDate, accent, welcomeNote, hostEmail } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'A title is required' });
  const id = eventId();
  const admin_token = newToken();
  const row = {
    id, admin_token,
    title: String(title).trim().slice(0, 80),
    event_date: eventDate ? String(eventDate).slice(0, 30) : null,
    accent: /^#[0-9a-f]{6}$/i.test(accent || '') ? accent : '#EC4899',
    welcome_note: welcomeNote ? String(welcomeNote).slice(0, 240) : null,
    host_email: hostEmail ? String(hostEmail).slice(0, 160) : null,
    allow_downloads: 1, plan: 'free', created_at: Date.now(),
  };
  stmts.insertEvent.run(row);
  res.json({
    event: publicEvent(row),
    adminToken: admin_token,
    guestUrl: `${baseUrl(req)}/?e=${id}`,
    manageUrl: `${baseUrl(req)}/host.html?e=${id}&t=${admin_token}`,
  });
});

// ---------- read album meta ----------
app.get('/api/events/:id', (req, res) => {
  const ev = stmts.getEvent.get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Album not found' });
  const counts = stmts.countPhotos.get(ev.id);
  const guests = stmts.distinctUploaders.get(ev.id);
  res.json({
    event: publicEvent(ev),
    stats: { photos: counts.n, guests: guests.n, bytes: counts.bytes, cap: planCap(ev.plan) },
  });
});

// ---------- update album (admin) ----------
app.patch('/api/events/:id', requireAdmin, (req, res) => {
  const e = req.event;
  const b = req.body || {};
  stmts.updateEvent.run({
    id: e.id,
    title: (b.title != null ? String(b.title).trim().slice(0, 80) : e.title) || e.title,
    event_date: b.eventDate != null ? String(b.eventDate).slice(0, 30) : e.event_date,
    accent: /^#[0-9a-f]{6}$/i.test(b.accent || '') ? b.accent : e.accent,
    welcome_note: b.welcomeNote != null ? String(b.welcomeNote).slice(0, 240) : e.welcome_note,
    allow_downloads: b.allowDownloads != null ? (b.allowDownloads ? 1 : 0) : e.allow_downloads,
  });
  res.json({ event: publicEvent(stmts.getEvent.get(e.id)) });
});

// ---------- list photos ----------
app.get('/api/events/:id/photos', (req, res) => {
  const ev = stmts.getEvent.get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Album not found' });
  res.json({ photos: stmts.listPhotos.all(ev.id).map(publicPhoto) });
});

// ---------- upload photos ----------
app.post('/api/events/:id/photos', uploadLimiter, upload.array('photos', config.limits.maxFilesPerRequest), async (req, res) => {
  const ev = stmts.getEvent.get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Album not found' });
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'No photos received' });

  const existing = stmts.countPhotos.get(ev.id).n;
  const cap = planCap(ev.plan);
  if (existing >= cap) return res.status(402).json({ error: 'Album is full', code: 'CAP_REACHED', cap });

  const uploader = (String(req.body.uploader || 'Guest').trim().slice(0, 40)) || 'Guest';
  const caption = req.body.caption ? String(req.body.caption).slice(0, 200) : null;
  const allowed = Math.max(0, cap - existing);
  const files = req.files.slice(0, allowed);
  const saved = [];

  for (const f of files) {
    try {
      const img = sharp(f.buffer, { failOn: 'none' }).rotate(); // honor EXIF orientation
      const meta = await img.metadata();
      const full = await img.clone()
        .resize({ width: config.image.fullMaxEdge, height: config.image.fullMaxEdge, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: config.image.jpegQuality, mozjpeg: true }).toBuffer();
      const thumb = await sharp(f.buffer, { failOn: 'none' }).rotate()
        .resize({ width: config.image.thumbMaxEdge, height: config.image.thumbMaxEdge, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 72, mozjpeg: true }).toBuffer();

      const id = photoId();
      const fullKey = `${ev.id}/${id}.jpg`;
      const thumbKey = `${ev.id}/${id}_t.jpg`;
      await storage.put(fullKey, full, 'image/jpeg');
      await storage.put(thumbKey, thumb, 'image/jpeg');

      const row = {
        id, event_id: ev.id, uploader, caption,
        full_key: fullKey, thumb_key: thumbKey,
        width: meta.width || null, height: meta.height || null,
        bytes: full.length + thumb.length, created_at: Date.now(),
      };
      stmts.insertPhoto.run(row);
      saved.push(publicPhoto(stmts.getPhoto.get(id)));
    } catch (err) {
      console.error('Image processing failed:', err.message);
    }
  }

  if (!saved.length) return res.status(422).json({ error: 'Could not process those images' });
  res.json({ photos: saved, capReached: existing + saved.length >= cap });
});

// ---------- like / unlike ----------
app.post('/api/photos/:pid/like', (req, res) => {
  const p = stmts.getPhoto.get(req.params.pid);
  if (!p) return res.status(404).json({ error: 'Photo not found' });
  const delta = req.body && req.body.unlike ? -1 : 1;
  stmts.likePhoto.run(delta, p.id);
  res.json({ likes: stmts.getPhoto.get(p.id).likes });
});

// ---------- delete a photo (admin) ----------
app.delete('/api/events/:id/photos/:pid', requireAdmin, async (req, res) => {
  const p = stmts.getPhoto.get(req.params.pid);
  if (!p || p.event_id !== req.event.id) return res.status(404).json({ error: 'Photo not found' });
  await storage.delete(p.full_key);
  await storage.delete(p.thumb_key);
  stmts.deletePhoto.run(p.id);
  res.json({ ok: true });
});

// ---------- QR code (PNG or SVG) pointing at the guest URL ----------
app.get('/api/events/:id/qr', async (req, res) => {
  const ev = stmts.getEvent.get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Album not found' });
  const target = `${baseUrl(req)}/?e=${ev.id}`;
  const opts = { errorCorrectionLevel: 'H', margin: 1, color: { dark: '#2A2140', light: '#00000000' }, width: 720 };
  try {
    if ((req.query.format || 'png') === 'svg') {
      const svg = await QRCode.toString(target, { ...opts, type: 'svg' });
      res.type('image/svg+xml').send(svg);
    } else {
      const buf = await QRCode.toBuffer(target, opts);
      res.type('image/png').send(buf);
    }
  } catch (e) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

// ---------- download whole album as a ZIP (admin, if allowed) ----------
app.get('/api/events/:id/download', async (req, res) => {
  const ev = stmts.getEvent.get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Album not found' });
  const tok = (req.query.t || '').toString();
  if (!ev.allow_downloads && tok !== ev.admin_token) {
    return res.status(403).json({ error: 'Downloads are disabled for this album' });
  }
  const photos = stmts.listPhotos.all(ev.id);
  res.attachment(`${ev.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'album'}.zip`);
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', err => { console.error(err); try { res.status(500).end(); } catch (_) {} });
  archive.pipe(res);
  for (const p of photos) {
    try {
      const stream = await storage.readStream(p.full_key);
      const safe = (p.uploader || 'guest').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      archive.append(stream, { name: `${safe}-${p.id}.jpg` });
    } catch (e) { /* skip missing */ }
  }
  archive.finalize();
});

// ---------- static: uploads (local driver) + frontend ----------
if (storage.isLocal) {
  app.use('/uploads', express.static(require('./storage').UPLOAD_DIR, {
    maxAge: '365d', immutable: true,
  }));
}
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

app.get('/healthz', (req, res) => res.json({ ok: true }));

// SPA-ish fallback to the guest app
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.listen(config.port, () => {
  console.log(`PartyPix listening on :${config.port}  (storage: ${config.storage.driver})`);
});
