// api.js — PartyPix frontend data layer.
// Talks to the real backend when an album is present (?e=<id>) and the API
// responds. Otherwise runs a self-contained DEMO so the page is fully usable
// offline / in preview. window.PartyPix is the single entry point.
(function () {
  const params = new URLSearchParams(location.search);
  const EVENT_ID = params.get('e');
  const ADMIN_TOKEN = params.get('t') || localStorage.getItem('pp_admin_' + EVENT_ID) || null;
  if (EVENT_ID && params.get('t')) localStorage.setItem('pp_admin_' + EVENT_ID, params.get('t'));

  let LIVE = false; // becomes true once we confirm the backend answered

  async function api(path, opts = {}) {
    const res = await fetch('/api' + path, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.error || res.statusText);
      err.status = res.status; err.code = body.code;
      throw err;
    }
    return res.json();
  }

  // ---------------- DEMO backend (in-memory) ----------------
  const DEMO = {
    event: {
      id: 'demo', title: 'Happy Birthday, Maya!', eventDate: null,
      accent: '#EC4899', welcomeNote: null, allowDownloads: true, plan: 'free',
    },
    photos: [
      { id: 's1', uploader: 'Priya',  caption: 'The cake reveal 🎂',     thumb: null, url: null, hue: 'linear-gradient(135deg,#FDE68A,#FB923C)', likes: 7,  createdAt: Date.now() - 4*60000 },
      { id: 's2', uploader: 'Marcus', caption: 'Squad before the candles', thumb: null, url: null, hue: 'linear-gradient(135deg,#C4B5FD,#7C3AED)', likes: 12, createdAt: Date.now() - 11*60000 },
      { id: 's3', uploader: 'Lena',   caption: '',                         thumb: null, url: null, hue: 'linear-gradient(135deg,#A7F3D0,#10B981)', likes: 3,  createdAt: Date.now() - 23*60000 },
      { id: 's4', uploader: 'Tom',    caption: 'Dance floor chaos',        thumb: null, url: null, hue: 'linear-gradient(135deg,#FBCFE8,#EC4899)', likes: 9,  createdAt: Date.now() - 38*60000 },
    ],
  };
  const uid = () => Math.random().toString(36).slice(2, 10);

  const PartyPix = {
    eventId: EVENT_ID,
    get isLive() { return LIVE; },
    get isDemo() { return !LIVE; },
    isAdmin: !!ADMIN_TOKEN,

    // Load event meta + photos. Resolves with { event, stats, photos, live }.
    async load() {
      if (EVENT_ID) {
        try {
          const [meta, ph] = await Promise.all([
            api('/events/' + EVENT_ID),
            api('/events/' + EVENT_ID + '/photos'),
          ]);
          LIVE = true;
          return { live: true, event: meta.event, stats: meta.stats, photos: ph.photos };
        } catch (e) {
          // fall through to demo if the album genuinely doesn't exist or API down
          console.warn('[PartyPix] live load failed, using demo:', e.message);
        }
      }
      LIVE = false;
      return {
        live: false, event: DEMO.event,
        stats: { photos: DEMO.photos.length, guests: new Set(DEMO.photos.map(p => p.uploader)).size, cap: 300 },
        photos: DEMO.photos.slice(),
      };
    },

    // Upload File objects. onItem(photo) fires per saved photo. Returns array.
    async upload(files, uploader, caption, onProgress) {
      if (LIVE) {
        const fd = new FormData();
        fd.append('uploader', uploader || 'Guest');
        if (caption) fd.append('caption', caption);
        for (const f of files) fd.append('photos', f);
        const res = await fetch('/api/events/' + EVENT_ID + '/photos', { method: 'POST', body: fd });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          const err = new Error(b.error || 'Upload failed'); err.code = b.code; throw err;
        }
        const data = await res.json();
        return data.photos;
      }
      // demo: read files locally as data URLs
      const out = [];
      for (const f of files) {
        const url = await new Promise(r => { const fr = new FileReader(); fr.onload = e => r(e.target.result); fr.readAsDataURL(f); });
        const p = { id: uid(), uploader: uploader || 'Guest', caption: caption || '', url, thumb: url, likes: 0, createdAt: Date.now() };
        DEMO.photos.unshift(p);
        out.push(p);
        if (onProgress) onProgress(out.length, files.length);
      }
      return out;
    },

    async like(photoId, unlike) {
      if (LIVE) { const r = await api('/photos/' + photoId + '/like', { method: 'POST', body: JSON.stringify({ unlike: !!unlike }) }); return r.likes; }
      const p = DEMO.photos.find(x => x.id === photoId); if (p) p.likes += unlike ? -1 : 1; return p ? p.likes : 0;
    },

    // Lightweight photo refresh (used by the live gallery for near-real-time updates).
    async listPhotos() {
      if (LIVE && EVENT_ID) { const ph = await api('/events/' + EVENT_ID + '/photos'); return ph.photos; }
      return DEMO.photos.slice();
    },

    qrUrl() { return EVENT_ID && LIVE ? '/api/events/' + EVENT_ID + '/qr' : null; },
    guestUrl() { return EVENT_ID ? location.origin + '/?e=' + EVENT_ID : location.origin; },
  };

  window.PartyPix = PartyPix;
})();
