// api.js — PartyPix frontend data layer.
// Talks to the real backend when an album is present (?e=<id>) and the API
// responds. Otherwise runs a self-contained DEMO so the page is fully usable
// offline / in preview. window.PartyPix is the single entry point.
//
// Upload model: photos are sent ONE FILE PER REQUEST so each thumbnail gets its
// own live progress (XMLHttpRequest.upload.onprogress). The original File is sent
// untouched — no client-side downscaling — so the server keeps full quality.
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
  // Note: seed names include Croatian diacritics (Đ, š, ž, ć) to prove glyph rendering.
  const DEMO = {
    event: {
      id: 'demo', title: 'Happy Birthday, Maya!', eventDate: null,
      accent: '#EC4899', welcomeNote: null, allowDownloads: true, plan: 'free',
    },
    photos: [
      { id: 's1', uploader: 'Đurđa',  caption: 'Rezanje torte 🎂',          thumb: null, url: null, hue: 'linear-gradient(135deg,#FDE68A,#FB923C)', likes: 7,  createdAt: Date.now() - 4*60000 },
      { id: 's2', uploader: 'Marko',  caption: 'Ekipa prije svjećica',       thumb: null, url: null, hue: 'linear-gradient(135deg,#C4B5FD,#7C3AED)', likes: 12, createdAt: Date.now() - 11*60000 },
      { id: 's3', uploader: 'Šime',   caption: '',                           thumb: null, url: null, hue: 'linear-gradient(135deg,#A7F3D0,#10B981)', likes: 3,  createdAt: Date.now() - 23*60000 },
      { id: 's4', uploader: 'Žaklina',caption: 'Ludnica na podiju',          thumb: null, url: null, hue: 'linear-gradient(135deg,#FBCFE8,#EC4899)', likes: 9,  createdAt: Date.now() - 38*60000 },
    ],
  };
  const uid = () => Math.random().toString(36).slice(2, 10);

  // Simulate a realistic network ramp for demo mode, scaled to file size so big
  // photos visibly take longer. Driven by a timer (not rAF) so it still completes
  // when the tab/iframe is backgrounded. Calls onProgress(frac 0..1).
  function simulateUpload(file, onProgress) {
    return new Promise((resolve) => {
      const bytes = (file && file.size) || 1_500_000;
      // ~1.6 MB/s "connection" + a floor so tiny files still animate.
      const dur = Math.min(6000, Math.max(900, (bytes / 1_600_000) * 1000));
      const start = Date.now();
      const id = setInterval(() => {
        const lin = Math.min(1, (Date.now() - start) / dur);
        const eased = 1 - Math.pow(1 - lin, 2.2); // ease-out: sprint then settle
        if (lin < 1) {
          onProgress && onProgress(Math.min(0.98, eased)); // hold at 98% until "saved"
        } else {
          clearInterval(id);
          onProgress && onProgress(1);
          setTimeout(resolve, 90);
        }
      }, 60);
    });
  }

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

    // Upload a SINGLE original file. onProgress(frac 0..1) fires continuously.
    // Resolves with the saved photo object. Throws on failure (err.code may be set).
    uploadOne(file, uploader, caption, onProgress) {
      if (LIVE) {
        return new Promise((resolve, reject) => {
          const fd = new FormData();
          fd.append('uploader', uploader || 'Guest');
          if (caption) fd.append('caption', caption);
          fd.append('photos', file); // original bytes, untouched
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/events/' + EVENT_ID + '/photos');
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) onProgress(Math.min(0.98, e.loaded / e.total));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                onProgress && onProgress(1);
                resolve((data.photos && data.photos[0]) || data.photo);
              } catch (_) { reject(new Error('Bad server response')); }
            } else {
              let code, msg;
              try { const b = JSON.parse(xhr.responseText); code = b.code; msg = b.error; } catch (_) {}
              const err = new Error(msg || 'Upload failed'); err.code = code; reject(err);
            }
          };
          xhr.onerror = () => reject(new Error('Network error — check your connection'));
          xhr.ontimeout = () => reject(new Error('Upload timed out'));
          xhr.send(fd);
        });
      }
      // demo: keep the full-resolution data URL locally + simulate transfer
      return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(new Error("Couldn't read that file"));
        fr.onload = async (e) => {
          await simulateUpload(file, onProgress);
          const p = { id: uid(), uploader: uploader || 'Guest', caption: caption || '', url: e.target.result, thumb: e.target.result, likes: 0, createdAt: Date.now() };
          DEMO.photos.unshift(p);
          resolve(p);
        };
        fr.readAsDataURL(file);
      });
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
