// config.js — central configuration, all overridable via environment variables.
require('dotenv').config();

const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  // Public base URL of the deployment (used to build QR codes + share links).
  // e.g. https://partypix.example.com  — falls back to request host if unset.
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),

  // Where SQLite + (when using local disk) uploads live. On a Droplet keep this
  // on a persistent volume; on App Platform prefer Spaces (see storage below).
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),

  // Storage backend: "local" (disk) or "spaces" (DigitalOcean Spaces / S3).
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    spaces: {
      endpoint: process.env.SPACES_ENDPOINT || '',     // e.g. https://nyc3.digitaloceanspaces.com
      region: process.env.SPACES_REGION || 'us-east-1',
      bucket: process.env.SPACES_BUCKET || '',
      key: process.env.SPACES_KEY || '',
      secret: process.env.SPACES_SECRET || '',
      // Public CDN/origin base for objects, e.g. https://my-bucket.nyc3.cdn.digitaloceanspaces.com
      cdnBase: (process.env.SPACES_CDN_BASE || '').replace(/\/$/, ''),
    },
  },

  // Limits — these double as the free-tier business guardrails.
  limits: {
    maxFileBytes: parseInt(process.env.MAX_FILE_BYTES || String(25 * 1024 * 1024), 10), // 25 MB/photo
    maxFilesPerRequest: parseInt(process.env.MAX_FILES_PER_REQUEST || '12', 10),
    // Per-event photo cap on the free plan. Hosts upgrading get a higher cap.
    freePlanPhotoCap: parseInt(process.env.FREE_PLAN_PHOTO_CAP || '300', 10),
    proPlanPhotoCap: parseInt(process.env.PRO_PLAN_PHOTO_CAP || '5000', 10),
  },

  // Image processing output sizes.
  image: {
    fullMaxEdge: 2048,   // longest edge of the stored "full" image
    thumbMaxEdge: 640,   // gallery thumbnail
    jpegQuality: 82,
  },

  // Comma-separated allowed CORS origins. Empty = same-origin only.
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
};

module.exports = config;
