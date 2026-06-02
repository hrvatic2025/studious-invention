// storage.js — pluggable blob storage. Default: local disk. Optional: DO Spaces (S3).
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const config = require('./config');

const UPLOAD_DIR = path.join(config.dataDir, 'uploads');

// ---------- Local disk driver ----------
const localDriver = {
  async put(key, buffer /*, contentType */) {
    const dest = path.join(UPLOAD_DIR, key);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, buffer);
    return key;
  },
  async delete(key) {
    try { await fsp.unlink(path.join(UPLOAD_DIR, key)); } catch (_) { /* ignore */ }
  },
  async readStream(key) {
    return fs.createReadStream(path.join(UPLOAD_DIR, key));
  },
  // URL the browser uses — served by express static at /uploads
  publicUrl(key) {
    return `/uploads/${key}`;
  },
  isLocal: true,
};

// ---------- DigitalOcean Spaces (S3-compatible) driver ----------
function makeSpacesDriver() {
  const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
  const s = config.storage.spaces;
  const client = new S3Client({
    endpoint: s.endpoint,
    region: s.region,
    credentials: { accessKeyId: s.key, secretAccessKey: s.secret },
    forcePathStyle: false,
  });
  return {
    async put(key, buffer, contentType) {
      await client.send(new PutObjectCommand({
        Bucket: s.bucket, Key: key, Body: buffer,
        ContentType: contentType || 'application/octet-stream',
        ACL: 'public-read', CacheControl: 'public, max-age=31536000, immutable',
      }));
      return key;
    },
    async delete(key) {
      try { await client.send(new DeleteObjectCommand({ Bucket: s.bucket, Key: key })); } catch (_) { /* ignore */ }
    },
    async readStream(key) {
      const out = await client.send(new GetObjectCommand({ Bucket: s.bucket, Key: key }));
      return out.Body; // a Node Readable
    },
    publicUrl(key) {
      const base = s.cdnBase || `${s.endpoint.replace('https://', `https://${s.bucket}.`)}`;
      return `${base}/${key}`;
    },
    isLocal: false,
  };
}

let driver;
if (config.storage.driver === 'spaces') {
  driver = makeSpacesDriver();
} else {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  driver = localDriver;
}

module.exports = { storage: driver, UPLOAD_DIR };
