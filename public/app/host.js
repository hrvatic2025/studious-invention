// host.js — PartyPix host dashboard (vanilla). Live backend + demo fallback.
(function () {
  const ACCENTS = ['#EC4899', '#7C3AED', '#FB7185', '#F59E0B', '#22C55E', '#38BDF8'];
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let EVENT_ID = params.get('e');
  let TOKEN = params.get('t') || (EVENT_ID ? localStorage.getItem('pp_admin_' + EVENT_ID) : null);
  let LIVE = false;
  let state = { event: null, photos: [], stats: null };
  let createAccent = '#EC4899';
  let manageAccent = '#EC4899';

  // ---------- helpers ----------
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); }
  function setAccentVar(c) { document.documentElement.style.setProperty('--accent', c); document.querySelector('meta[name=theme-color]').setAttribute('content', c); }
  function show(view) { ['createView', 'manageView'].forEach(v => $(v).classList.toggle('hidden', v !== view)); }
  async function api(path, opts) {
    const res = await fetch('/api' + path, { headers: { 'Content-Type': 'application/json' }, ...(opts || {}) });
    if (!res.ok) { const b = await res.json().catch(() => ({})); const e = new Error(b.error || res.statusText); e.status = res.status; throw e; }
    return res.json();
  }
  // localStorage album registry
  function myEvents() { try { return JSON.parse(localStorage.getItem('pp_events') || '[]'); } catch { return []; } }
  function rememberEvent(ev, token) {
    const list = myEvents().filter(e => e.id !== ev.id);
    list.unshift({ id: ev.id, title: ev.title, accent: ev.accent, date: ev.eventDate, token });
    localStorage.setItem('pp_events', JSON.stringify(list.slice(0, 30)));
    localStorage.setItem('pp_admin_' + ev.id, token);
  }

  // ---------- swatches ----------
  function buildSwatches(container, current, onPick) {
    container.innerHTML = '';
    ACCENTS.forEach(c => {
      const s = document.createElement('div');
      s.className = 'sw' + (c === current ? ' active' : '');
      s.style.background = c;
      s.onclick = () => { [...container.children].forEach(x => x.classList.remove('active')); s.classList.add('active'); onPick(c); };
      container.appendChild(s);
    });
  }

  // ---------- styled QR (rounded modules + colored finder eyes) ----------
  function buildQR(text, accent) {
    const qr = qrcode(0, 'H'); qr.addData(text || ' '); qr.make();
    const count = qr.getModuleCount(); const cell = 8.6; const size = count * cell;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    const inFinder = (r, c) => { const f = (R, C) => R < 7 && C < 7; return f(r, c) || f(r, count - 1 - c) || f(count - 1 - r, c); };
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) {
      if (!qr.isDark(r, c) || inFinder(r, c)) continue;
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', c * cell + cell * 0.12); rect.setAttribute('y', r * cell + cell * 0.12);
      rect.setAttribute('width', cell * 0.76); rect.setAttribute('height', cell * 0.76);
      rect.setAttribute('rx', cell * 0.28); rect.setAttribute('fill', '#2A2140'); svg.appendChild(rect);
    }
    const eye = (R, C) => {
      const x = C * cell, y = R * cell, s = 7 * cell;
      const o = document.createElementNS(ns, 'rect');
      o.setAttribute('x', x + cell * 0.4); o.setAttribute('y', y + cell * 0.4);
      o.setAttribute('width', s - cell * 0.8); o.setAttribute('height', s - cell * 0.8);
      o.setAttribute('rx', cell * 2); o.setAttribute('fill', 'none'); o.setAttribute('stroke', accent); o.setAttribute('stroke-width', cell * 1.05); svg.appendChild(o);
      const i = document.createElementNS(ns, 'rect');
      i.setAttribute('x', x + cell * 2.3); i.setAttribute('y', y + cell * 2.3);
      i.setAttribute('width', cell * 2.4); i.setAttribute('height', cell * 2.4);
      i.setAttribute('rx', cell * 0.9); i.setAttribute('fill', accent); svg.appendChild(i);
    };
    eye(0, 0); eye(0, count - 7); eye(count - 7, 0);
    return svg;
  }
  function svgToPng(svg, scale, cb) {
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const w = svg.viewBox.baseVal.width || 300;
      const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = w * scale;
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, w * scale * 0.08, w * scale * 0.08, w * scale * 0.84, w * scale * 0.84);
      cv.toBlob(cb, 'image/png');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
  }

  // ===================== CREATE =====================
  function initCreate() {
    show('createView');
    buildSwatches($('createSwatches'), createAccent, c => { createAccent = c; setAccentVar(c); });
    setAccentVar(createAccent);
    renderMyEvents();
    $('createBtn').onclick = doCreate;
  }
  function renderMyEvents() {
    const list = myEvents();
    const wrap = $('myEvents');
    $('myEventsCard').classList.toggle('hidden', !list.length);
    wrap.innerHTML = '';
    list.forEach(e => {
      const row = document.createElement('div'); row.className = 'ev-item';
      row.innerHTML = `<div class="ev-dot" style="background:${e.accent || '#EC4899'}"></div>
        <div style="flex:1"><div class="t">${escapeHtml(e.title)}</div><div class="s">${e.date || 'Tap to manage'}</div></div>
        <div class="s">→</div>`;
      row.onclick = () => { location.search = '?e=' + e.id + '&t=' + (e.token || ''); };
      wrap.appendChild(row);
    });
  }
  async function doCreate() {
    const title = $('fTitle').value.trim();
    if (!title) { toast('Give your album a title'); $('fTitle').focus(); return; }
    const payload = { title, eventDate: $('fDate').value || null, accent: createAccent, welcomeNote: $('fNote').value.trim() || null, hostEmail: $('fEmail').value.trim() || null };
    $('createBtn').disabled = true; $('createBtn').textContent = 'Creating…';
    try {
      const data = await api('/events', { method: 'POST', body: JSON.stringify(payload) });
      rememberEvent(data.event, data.adminToken);
      location.search = '?e=' + data.event.id + '&t=' + data.adminToken;
    } catch (e) {
      // demo fallback — create locally
      const id = 'demo-' + Math.random().toString(36).slice(2, 8);
      const token = 'demo';
      const ev = { id, title, eventDate: payload.eventDate, accent: createAccent, welcomeNote: payload.welcomeNote, allowDownloads: true, plan: 'free' };
      rememberEvent(ev, token);
      localStorage.setItem('pp_demo_' + id, JSON.stringify(ev));
      location.search = '?e=' + id + '&t=' + token;
    }
  }

  // ===================== MANAGE =====================
  async function loadManage() {
    try {
      const [meta, ph] = await Promise.all([api('/events/' + EVENT_ID), api('/events/' + EVENT_ID + '/photos')]);
      LIVE = true; state.event = meta.event; state.stats = meta.stats; state.photos = ph.photos;
    } catch (e) {
      LIVE = false;
      const demo = localStorage.getItem('pp_demo_' + EVENT_ID);
      if (demo) { state.event = JSON.parse(demo); }
      else { const m = myEvents().find(x => x.id === EVENT_ID); state.event = m ? { id: m.id, title: m.title, accent: m.accent, eventDate: m.date, allowDownloads: true, plan: 'free' } : null; }
      state.photos = []; state.stats = { photos: 0, guests: 0, cap: 300 };
      if (!state.event) { initCreate(); return; }
    }
    renderManage();
  }

  function renderManage() {
    show('manageView');
    const ev = state.event;
    manageAccent = ev.accent || '#EC4899';
    setAccentVar(manageAccent);
    $('demoBanner').classList.toggle('hidden', LIVE);

    $('mTitle').textContent = ev.title;
    $('mDate').textContent = ev.eventDate ? new Date(ev.eventDate + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : '';
    $('planPill').textContent = (ev.plan === 'pro' ? 'Pro plan' : 'Free plan');

    // QR + link
    const guestUrl = location.origin + '/?e=' + EVENT_ID;
    $('guestLink').value = guestUrl;
    const holder = $('qr'); holder.innerHTML = ''; holder.appendChild(buildQR(guestUrl, manageAccent));

    // stats
    const cap = (state.stats && state.stats.cap) || 300;
    const n = state.photos.length || (state.stats ? state.stats.photos : 0);
    const guests = state.stats ? state.stats.guests : new Set(state.photos.map(p => p.uploader)).size;
    const pct = Math.min(100, Math.round((n / cap) * 100));
    $('stPhotos').textContent = n; $('stGuests').textContent = guests; $('stCapPct').textContent = pct + '%';
    $('capBar').style.width = pct + '%';
    $('capNote').textContent = `${n} of ${cap} photos used on the ${ev.plan === 'pro' ? 'Pro' : 'Free'} plan.` + (ev.plan !== 'pro' && pct > 70 ? ' Running low — upgrade for 5,000.' : '');

    // photo grid
    renderGrid();

    // settings
    $('sTitle').value = ev.title;
    $('sDownloads').checked = !!ev.allowDownloads;
    buildSwatches($('manageSwatches'), manageAccent, c => { manageAccent = c; setAccentVar(c); });

    $('modeHint').textContent = LIVE ? '' : '(demo — connect backend for real uploads)';
    wireManageButtons(guestUrl);
  }

  function renderGrid() {
    const grid = $('photoGrid'); grid.innerHTML = '';
    $('photoEmpty').classList.toggle('hidden', state.photos.length > 0);
    state.photos.forEach(p => {
      const tile = document.createElement('div'); tile.className = 'tile';
      const src = p.thumb || p.url || '';
      tile.innerHTML = `${src ? `<img src="${src}" alt="">` : ''}<div class="who">${escapeHtml(p.uploader || 'Guest')}</div>`;
      if (LIVE) {
        const del = document.createElement('div'); del.className = 'del'; del.textContent = '×'; del.title = 'Remove';
        del.onclick = () => deletePhoto(p.id);
        tile.appendChild(del);
      }
      grid.appendChild(tile);
    });
  }

  async function deletePhoto(pid) {
    if (!confirm('Remove this photo from the album?')) return;
    try {
      await api('/events/' + EVENT_ID + '/photos/' + pid, { method: 'DELETE', headers: { Authorization: 'Bearer ' + TOKEN } });
      state.photos = state.photos.filter(x => x.id !== pid);
      renderGrid(); toast('Photo removed');
    } catch (e) { toast(e.message || 'Could not remove'); }
  }

  function wireManageButtons(guestUrl) {
    $('copyLink').onclick = () => { navigator.clipboard.writeText(guestUrl).then(() => toast('Link copied!')); };
    $('openGuest').onclick = () => window.open(guestUrl, '_blank');
    $('openSlideshow').onclick = () => window.open('/slideshow.html?e=' + EVENT_ID, '_blank');
    $('dlQr').onclick = () => {
      const svg = buildQR(guestUrl, manageAccent);
      svgToPng(svg, 3, blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'partypix-qr.png'; a.click(); });
    };
    $('printQr').onclick = printCard;
    $('dlAll').onclick = () => {
      if (!LIVE) { toast('Connect the backend to download photos'); return; }
      window.location = '/api/events/' + EVENT_ID + '/download?t=' + encodeURIComponent(TOKEN);
    };
    $('saveSettings').onclick = saveSettings;
    $('backToCreate').onclick = () => { location.search = ''; };
  }

  async function saveSettings() {
    const body = { title: $('sTitle').value.trim() || state.event.title, accent: manageAccent, allowDownloads: $('sDownloads').checked };
    if (!LIVE) {
      Object.assign(state.event, { title: body.title, accent: body.accent, allowDownloads: body.allowDownloads });
      localStorage.setItem('pp_demo_' + EVENT_ID, JSON.stringify(state.event));
      renderManage(); toast('Saved (demo)'); return;
    }
    try {
      const data = await api('/events/' + EVENT_ID, { method: 'PATCH', headers: { Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify(body) });
      state.event = data.event; renderManage(); toast('Saved!');
    } catch (e) { toast(e.message || 'Could not save'); }
  }

  function printCard() {
    const ev = state.event;
    const guestUrl = location.origin + '/?e=' + EVENT_ID;
    const svg = buildQR(guestUrl, manageAccent);
    const card = $('printCard');
    card.innerHTML = `
      <div style="max-width:420px;margin:40px auto;text-align:center;font-family:'Plus Jakarta Sans',sans-serif;border:2px solid #eee;border-radius:24px;padding:36px 30px;">
        <div style="font-family:'Baloo 2',sans-serif;font-weight:700;font-size:13px;letter-spacing:2.5px;text-transform:uppercase;color:${manageAccent};">Scan to join</div>
        <h1 style="font-family:'Fredoka',sans-serif;font-weight:600;font-size:30px;color:#2A2140;margin:8px 0 4px;">${escapeHtml(ev.title)}</h1>
        <p style="color:#6B6480;font-size:15px;margin:0 0 18px;">Add your photos to our shared album</p>
        <div id="printQrMount" style="display:inline-block;padding:16px;border-radius:18px;background:#FBFAFE;"></div>
        <div style="margin-top:18px;font-family:ui-monospace,monospace;font-size:13px;color:#2A2140;background:#F4F0FB;display:inline-block;padding:7px 15px;border-radius:20px;">${guestUrl.replace(/^https?:\/\//, '')}</div>
      </div>`;
    card.querySelector('#printQrMount').appendChild(svg.cloneNode(true));
    card.classList.remove('hidden');
    const style = document.createElement('style');
    style.id = '__printOnly';
    style.textContent = '@media print { .wrap, .toast { display:none !important; } #printCard { display:block !important; } }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => { card.classList.add('hidden'); style.remove(); }, 500);
  }

  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ---------- boot ----------
  if (EVENT_ID) loadManage(); else initCreate();
})();
