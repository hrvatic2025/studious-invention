// Birthday Photo App — festive mobile photo-sharing prototype
// Flow: Welcome → Name → Upload → Gallery
const { useState, useRef, useEffect } = React;

// ── Festive confetti palette ──
const CONFETTI = ['#7C3AED', '#EC4899', '#FB7185', '#F59E0B', '#22C55E', '#38BDF8', '#FACC15'];

const FONT_STACK = {
  Fredoka: "'Fredoka', system-ui, sans-serif",
  'Baloo 2': "'Baloo 2', system-ui, sans-serif",
  Quicksand: "'Quicksand', system-ui, sans-serif",
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "eventTitle": "Happy Birthday, Maya!",
  "primaryColor": "#EC4899",
  "displayFont": "Fredoka",
  "confetti": true
}/*EDITMODE-END*/;

// ── Seed photos (placeholders representing other guests' uploads) ──
const SEED = [
  { id: 's1', by: 'Priya', caption: 'The cake reveal 🎂', hue: 'linear-gradient(135deg,#FDE68A,#FB923C)', likes: 7, mins: 4 },
  { id: 's2', by: 'Marcus', caption: 'Squad before the candles', hue: 'linear-gradient(135deg,#C4B5FD,#7C3AED)', likes: 12, mins: 11 },
  { id: 's3', by: 'Lena', caption: '', hue: 'linear-gradient(135deg,#A7F3D0,#10B981)', likes: 3, mins: 23 },
  { id: 's4', by: 'Tom', caption: 'Dance floor chaos', hue: 'linear-gradient(135deg,#FBCFE8,#EC4899)', likes: 9, mins: 38 },
];

// ── Small UID + initials helpers ──
const uid = () => Math.random().toString(36).slice(2, 9);
const initials = (n) => (n || '?').trim().slice(0, 1).toUpperCase();
const avatarColor = (n) => CONFETTI[(n || 'x').charCodeAt(0) % CONFETTI.length];

// Clone-safe entrance: animate via a mount flag (not a CSS keyframe), so the
// element's resting style is fully visible — screenshots/PDF capture correctly.
function Screen({ children, style }) {
  const [m, setM] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => requestAnimationFrame(() => setM(true))); return () => cancelAnimationFrame(r); }, []);
  return (
    <div style={{
      height: '100%',
      opacity: m ? 1 : 0,
      transform: m ? 'none' : 'translateY(12px) scale(0.99)',
      transition: 'opacity 0.42s cubic-bezier(0.22,1,0.36,1), transform 0.42s cubic-bezier(0.22,1,0.36,1)',
      ...style,
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────
function Avatar({ name, size = 30 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: avatarColor(name), color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: size * 0.44,
      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
    }}>{initials(name)}</div>
  );
}

// ─────────────────────────────────────────────
// Confetti — ambient (gentle) + burst (celebration)
// ─────────────────────────────────────────────
function AmbientConfetti({ on }) {
  if (!on) return null;
  const dots = React.useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    id: i, left: Math.random() * 100, top: Math.random() * 86,
    c: CONFETTI[i % CONFETTI.length], s: 6 + Math.random() * 9,
    rot: Math.random() * 360, round: Math.random() > 0.5,
    dur: 2.6 + Math.random() * 2.4, delay: Math.random() * 2,
  })), []);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {dots.map(d => (
        <div key={d.id} style={{
          position: 'absolute', left: d.left + '%', top: d.top + '%',
          width: d.s, height: d.round ? d.s : d.s * 0.5,
          background: d.c, borderRadius: d.round ? '50%' : 2,
          transform: `rotate(${d.rot}deg)`, opacity: 0.85,
          animation: `floatUp ${d.dur}s ease-in-out ${d.delay}s infinite alternate`,
        }} />
      ))}
    </div>
  );
}

function ConfettiBurst({ fire }) {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (!fire) return;
    const p = Array.from({ length: 80 }, (_, i) => ({
      id: i, left: 50 + (Math.random() - 0.5) * 16,
      c: CONFETTI[i % CONFETTI.length], s: 7 + Math.random() * 10,
      dx: (Math.random() - 0.5) * 460, dr: (Math.random() - 0.5) * 1080,
      delay: Math.random() * 0.18, dur: 1.5 + Math.random() * 1.1,
      round: Math.random() > 0.55,
    }));
    setPieces(p);
    const t = setTimeout(() => setPieces([]), 2900);
    return () => clearTimeout(t);
  }, [fire]);
  if (!pieces.length) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 120 }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: p.left + '%', top: -12,
          width: p.s, height: p.round ? p.s : p.s * 0.45,
          background: p.c, borderRadius: p.round ? '50%' : 2,
          '--dx': p.dx + 'px', '--dr': p.dr + 'deg',
          animation: `fall ${p.dur}s cubic-bezier(0.3,0.7,0.5,1) ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Primary button
// ─────────────────────────────────────────────
function BigButton({ children, onClick, disabled, color, variant = 'solid' }) {
  const [press, setPress] = useState(false);
  const solid = variant === 'solid';
  return (
    <button
      onClick={onClick} disabled={disabled}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerLeave={() => setPress(false)}
      style={{
        width: '100%', padding: '17px 20px', borderRadius: 18,
        fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 18,
        letterSpacing: 0.2,
        color: solid ? '#fff' : color,
        background: solid ? color : '#fff',
        boxShadow: disabled ? 'none'
          : solid ? `0 8px 20px ${color}55, inset 0 1px 0 rgba(255,255,255,0.3)`
          : `inset 0 0 0 2px ${color}`,
        opacity: disabled ? 0.45 : 1,
        transform: press && !disabled ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.12s ease, opacity 0.2s, box-shadow 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
      }}
    >{children}</button>
  );
}

// ─────────────────────────────────────────────
// Icons (simple, inline)
// ─────────────────────────────────────────────
const Icon = {
  camera: (c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 8.5A2.5 2.5 0 016.5 6l.7-1.2A2 2 0 019 3.8h6a2 2 0 011.7 1L17.5 6A2.5 2.5 0 0120 8.5v8A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5v-8z" stroke={c} strokeWidth="1.9"/><circle cx="12" cy="12.5" r="3.4" stroke={c} strokeWidth="1.9"/></svg>,
  image: (c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="14" rx="3" stroke={c} strokeWidth="1.9"/><circle cx="8.5" cy="10" r="1.6" fill={c}/><path d="M5 17l4.5-4 3 2.5L16 12l3 3.2" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  plus: (c) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={c} strokeWidth="2.6" strokeLinecap="round"/></svg>,
  heart: (c, fill) => <svg width="20" height="20" viewBox="0 0 24 24" fill={fill ? c : 'none'}><path d="M12 20s-7-4.6-9.2-9C1.3 8 2.7 4.5 6 4.5c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4 3.3 0 4.7 3.5 3.2 6.5C19 15.4 12 20 12 20z" stroke={c} strokeWidth="1.9" strokeLinejoin="round"/></svg>,
  check: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth="2.4" strokeLinecap="round"/></svg>,
  back: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

// ─────────────────────────────────────────────
// Placeholder "photo" (seeded guest uploads)
// ─────────────────────────────────────────────
function PhotoFill({ photo, radius = 0 }) {
  if (photo.src) {
    return <img src={photo.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: radius, display: 'block' }} />;
  }
  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: radius, background: photo.hue,
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="ph-shimmer" style={{ position: 'absolute', inset: 0 }} />
      <span style={{
        fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11,
        color: 'rgba(255,255,255,0.85)', letterSpacing: 1,
        background: 'rgba(0,0,0,0.18)', padding: '4px 9px', borderRadius: 20,
        position: 'relative', zIndex: 1,
      }}>guest photo</span>
    </div>
  );
}

// ═════════════════════════════════════════════
// SCREEN: Welcome
// ═════════════════════════════════════════════
function WelcomeScreen({ t, onStart, guestCount, photoCount, guests }) {
  const font = FONT_STACK[t.displayFont];
  return (
    <div style={{ minHeight: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <AmbientConfetti on={t.confetti} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 30px', textAlign: 'center', position: 'relative', zIndex: 2 }}>
        {/* balloon cluster (simple shapes) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 26, animation: 'bob 3.4s ease-in-out infinite' }}>
          {['#FB7185', '#FACC15', '#7C3AED'].map((c, i) => (
            <div key={i} style={{ position: 'relative', marginTop: i === 1 ? -12 : 0 }}>
              <div style={{ width: 46, height: 56, borderRadius: '50%', background: c, boxShadow: `inset -6px -8px 0 rgba(0,0,0,0.08), 0 10px 18px ${c}55` }} />
              <div style={{ width: 1.5, height: 26, background: 'rgba(0,0,0,0.25)', margin: '0 auto' }} />
            </div>
          ))}
        </div>

        <div style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: t.primaryColor, marginBottom: 10 }}>
          You're invited
        </div>
        <h1 style={{ fontFamily: font, fontWeight: 600, fontSize: 40, lineHeight: 1.05, color: '#2A2140', margin: '0 0 16px', textWrap: 'balance' }}>
          {t.eventTitle}
        </h1>
        <p style={{ fontSize: 16.5, lineHeight: 1.5, color: '#6B6480', margin: '0 0 32px', maxWidth: 300 }}>
          Help capture the party — add your photos to the shared album so we never lose a single memory.
        </p>

        <div style={{ width: '100%', maxWidth: 320 }}>
          <BigButton color={t.primaryColor} onClick={onStart}>
            {Icon.camera('#fff')} Add Your Photos
          </BigButton>
        </div>

        {/* social proof */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 26 }}>
          <div style={{ display: 'flex' }}>
            {guests.slice(0, 4).map((g, i) => (
              <div key={i} style={{ marginLeft: i ? -10 : 0, borderRadius: '50%', boxShadow: '0 0 0 2.5px #fff' }}>
                <Avatar name={g} size={30} />
              </div>
            ))}
          </div>
          <span style={{ fontSize: 14, color: '#6B6480', fontWeight: 500 }}>
            <b style={{ color: '#2A2140' }}>{photoCount} photos</b> from {guestCount} guests
          </span>
        </div>
      </div>

      <div style={{ padding: '0 30px 26px', textAlign: 'center', position: 'relative', zIndex: 2 }}>
        <a href="QR Code.html" style={{ fontSize: 13.5, color: '#9A93AC', fontWeight: 600, textDecoration: 'none' }}>
          Host? View the QR code →
        </a>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════
// SCREEN: Name
// ═════════════════════════════════════════════
function NameScreen({ t, value, setValue, onBack, onNext }) {
  const inputRef = useRef(null);
  useEffect(() => { const id = setTimeout(() => inputRef.current && inputRef.current.focus(), 350); return () => clearTimeout(id); }, []);
  const font = FONT_STACK[t.displayFont];
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', padding: '0 26px' }}>
      <TopBar onBack={onBack} step="Step 1 of 2" color={t.primaryColor} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>👋</div>
        <h2 style={{ fontFamily: font, fontWeight: 600, fontSize: 30, color: '#2A2140', margin: '0 0 8px' }}>
          First, who are you?
        </h2>
        <p style={{ fontSize: 15.5, color: '#6B6480', margin: '0 0 26px', lineHeight: 1.45 }}>
          So everyone knows who snapped what. Your name shows on each photo.
        </p>
        <input
          ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
          placeholder="Your name"
          onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onNext(); }}
          style={{
            width: '100%', padding: '16px 18px', borderRadius: 16, fontSize: 18,
            fontWeight: 600, color: '#2A2140', background: '#F6F3FB',
            border: `2px solid ${value.trim() ? t.primaryColor : '#E7E2F0'}`,
            outline: 'none', transition: 'border-color 0.2s',
          }}
        />
      </div>
      <div style={{ paddingBottom: 26, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <BigButton color={t.primaryColor} disabled={!value.trim()} onClick={onNext}>Continue</BigButton>
        <button onClick={() => { setValue('Anonymous guest'); onNext(); }} style={{ fontSize: 14.5, color: '#9A93AC', fontWeight: 600, padding: 6 }}>
          Skip — add anonymously
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════
// SCREEN: Upload
// ═════════════════════════════════════════════
function UploadScreen({ t, name, pending, setPending, caption, setCaption, onBack, onSubmit }) {
  const camRef = useRef(null);
  const libRef = useRef(null);
  const font = FONT_STACK[t.displayFont];

  const handleFiles = (files) => {
    const arr = Array.from(files).slice(0, 12);
    arr.forEach(f => {
      if (!f.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = ev => setPending(prev => [...prev, { id: uid(), src: ev.target.result }]);
      reader.readAsDataURL(f);
    });
  };

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', padding: '0 26px' }}>
      <TopBar onBack={onBack} step="Step 2 of 2" color={t.primaryColor} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      <input ref={libRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 10 }} className="app-scroll">
        <h2 style={{ fontFamily: font, fontWeight: 600, fontSize: 28, color: '#2A2140', margin: '4px 0 4px' }}>
          Add your shots
        </h2>
        <p style={{ fontSize: 15, color: '#6B6480', margin: '0 0 20px' }}>
          Uploading as <b style={{ color: t.primaryColor }}>{name}</b>
        </p>

        {/* two big sources */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: pending.length ? 18 : 14 }}>
          <SourceTile color={t.primaryColor} icon={Icon.camera} label="Take a photo" onClick={() => camRef.current.click()} />
          <SourceTile color="#7C3AED" icon={Icon.image} label="From library" onClick={() => libRef.current.click()} />
        </div>

        {/* previews */}
        {pending.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#9A93AC', textTransform: 'uppercase', letterSpacing: 1, margin: '4px 0 10px' }}>
              {pending.length} selected
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
              {pending.map(p => (
                <div key={p.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.08)', animation: 'popIn 0.3s ease both' }}>
                  <img src={p.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => setPending(prev => prev.filter(x => x.id !== p.id))}
                    style={{ position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {Icon.x('#fff')}
                  </button>
                </div>
              ))}
            </div>
            <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption (optional)…" rows={2}
              style={{ width: '100%', padding: '13px 15px', borderRadius: 14, fontSize: 15, color: '#2A2140', background: '#F6F3FB', border: '2px solid #E7E2F0', outline: 'none', resize: 'none', lineHeight: 1.4 }} />
          </div>
        )}

        {pending.length === 0 && (
          <div style={{ textAlign: 'center', padding: '26px 10px', color: '#B4ADC2', fontSize: 14.5, lineHeight: 1.5 }}>
            Pick from your camera roll or snap a fresh one.<br />Add up to 12 at once.
          </div>
        )}
      </div>

      <div style={{ padding: '8px 0 26px' }}>
        <BigButton color={t.primaryColor} disabled={!pending.length} onClick={onSubmit}>
          {pending.length ? `Add ${pending.length} to album` : 'Choose photos first'}
        </BigButton>
      </div>
    </div>
  );
}

function SourceTile({ color, icon, label, onClick }) {
  const [press, setPress] = useState(false);
  return (
    <button onClick={onClick}
      onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)}
      style={{
        aspectRatio: '1', borderRadius: 20, background: '#fff',
        boxShadow: `0 6px 16px rgba(0,0,0,0.06), inset 0 0 0 2px ${color}22`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
        transform: press ? 'scale(0.96)' : 'scale(1)', transition: 'transform 0.12s',
      }}>
      <div style={{ width: 54, height: 54, borderRadius: '50%', background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon(color)}
      </div>
      <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 15, color: '#2A2140' }}>{label}</span>
    </button>
  );
}

// ═════════════════════════════════════════════
// SCREEN: Gallery
// ═════════════════════════════════════════════
function GalleryScreen({ t, photos, name, onLike, liked, onAddMore, justAdded }) {
  const font = FONT_STACK[t.displayFont];
  const guestSet = new Set(photos.map(p => p.by));
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: '#FBFAFE' }}>
      {/* sticky festive header */}
      <div style={{ padding: '6px 22px 14px', position: 'sticky', top: 0, zIndex: 10, background: 'linear-gradient(#FBFAFE 70%, rgba(251,250,254,0))' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: t.primaryColor }}>
              The Album
            </div>
            <h2 style={{ fontFamily: font, fontWeight: 600, fontSize: 27, color: '#2A2140', margin: '2px 0 0' }}>
              {t.eventTitle.replace(/[!,].*$/, '')}
            </h2>
          </div>
          <div style={{ textAlign: 'right', fontSize: 13, color: '#9A93AC', fontWeight: 600, lineHeight: 1.3 }}>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 22, color: '#2A2140' }}>{photos.length}</div>
            photos
          </div>
        </div>
      </div>

      {/* single-column stacked cards */}
      <div className="app-scroll" style={{ flex: 1, overflow: 'auto', padding: '0 18px 120px' }}>
        {photos.map((p, i) => {
          const isMine = p.by === name;
          const isNew = justAdded.includes(p.id);
          return (
            <div key={p.id} style={{
              background: '#fff', borderRadius: 22, overflow: 'hidden', marginBottom: 16,
              boxShadow: '0 8px 22px rgba(42,33,64,0.08)',
              animation: isNew ? 'popIn 0.45s cubic-bezier(0.22,1,0.36,1) both' : undefined,
              outline: isNew ? `2.5px solid ${t.primaryColor}` : 'none',
            }}>
              <div style={{ width: '100%', aspectRatio: '4 / 3', background: '#EEE' }}>
                <PhotoFill photo={p} />
              </div>
              <div style={{ padding: '12px 15px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={p.by} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: '#2A2140', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.by}
                      {isMine && <span style={{ fontSize: 10.5, fontWeight: 700, color: t.primaryColor, background: t.primaryColor + '18', padding: '2px 7px', borderRadius: 20 }}>YOU</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#A7A0B6' }}>{p.mins != null ? `${p.mins}m ago` : 'just now'}</div>
                  </div>
                  <button onClick={() => onLike(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 4px' }}>
                    {Icon.heart(liked[p.id] ? '#EC4899' : '#B4ADC2', liked[p.id])}
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: liked[p.id] ? '#EC4899' : '#B4ADC2' }}>
                      {p.likes + (liked[p.id] ? 1 : 0)}
                    </span>
                  </button>
                </div>
                {p.caption && <div style={{ fontSize: 14.5, color: '#4A4360', marginTop: 9, lineHeight: 1.4 }}>{p.caption}</div>}
              </div>
            </div>
          );
        })}
        <div style={{ textAlign: 'center', padding: '8px 0 4px', fontSize: 13, color: '#C2BBD0', fontFamily: 'ui-monospace, monospace' }}>
          🎉 {guestSet.size} guests · keep them coming
        </div>
      </div>

      {/* FAB */}
      <button onClick={onAddMore} style={{
        position: 'absolute', bottom: 30, right: 22, width: 60, height: 60, borderRadius: '50%',
        background: t.primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 10px 24px ${t.primaryColor}66`, zIndex: 30,
      }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${t.primaryColor}`, animation: 'pulseRing 2.2s ease-out infinite' }} />
        {Icon.plus('#fff')}
      </button>
    </div>
  );
}

// ── Shared top bar (back + step pill) ──
function TopBar({ onBack, step, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
      <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: '50%', background: '#F2EEF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {Icon.back('#5A5470')}
      </button>
      {step && <span style={{ fontSize: 13, fontWeight: 700, color, background: color + '15', padding: '6px 12px', borderRadius: 20 }}>{step}</span>}
    </div>
  );
}

// ═════════════════════════════════════════════
// ROOT APP
// ═════════════════════════════════════════════
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState('welcome');
  const [name, setName] = useState('');
  const [photos, setPhotos] = useState(SEED);
  const [pending, setPending] = useState([]);
  const [caption, setCaption] = useState('');
  const [liked, setLiked] = useState({});
  const [burst, setBurst] = useState(0);
  const [justAdded, setJustAdded] = useState([]);

  const baseGuests = ['Priya', 'Marcus', 'Lena', 'Tom', 'Ava'];
  const guestCount = new Set([...photos.map(p => p.by)]).size;

  const submitUpload = () => {
    const ids = [];
    const fresh = pending.map(p => {
      const id = uid(); ids.push(id);
      return { id, src: p.src, by: name || 'Guest', caption, likes: 0, mins: null };
    });
    setPhotos(prev => [...fresh, ...prev]);
    setJustAdded(ids);
    setPending([]); setCaption('');
    setBurst(b => b + 1);
    setScreen('gallery');
  };

  return (
    <div style={{ position: 'relative' }}>
      <IOSDevice>
        <div style={{ position: 'relative', height: '100%', background: screen === 'gallery' ? '#FBFAFE' : '#FFFDFB' }}>
          {/* top padding for status bar / island */}
          <div style={{ height: 58 }} />
          <div style={{ height: 'calc(100% - 58px)', position: 'relative' }}>
            <Screen key={screen} style={{ height: '100%' }}>
            {screen === 'welcome' && (
              <WelcomeScreen t={t} guests={baseGuests} guestCount={guestCount} photoCount={photos.length}
                onStart={() => setScreen('name')} />
            )}
            {screen === 'name' && (
              <NameScreen t={t} value={name} setValue={setName}
                onBack={() => setScreen('welcome')} onNext={() => setScreen('upload')} />
            )}
            {screen === 'upload' && (
              <UploadScreen t={t} name={name || 'Guest'} pending={pending} setPending={setPending}
                caption={caption} setCaption={setCaption}
                onBack={() => setScreen(photos.some(p => p.by === name) ? 'gallery' : 'name')}
                onSubmit={submitUpload} />
            )}
            {screen === 'gallery' && (
              <GalleryScreen t={t} photos={photos} name={name} liked={liked} justAdded={justAdded}
                onLike={id => setLiked(l => ({ ...l, [id]: !l[id] }))}
                onAddMore={() => setScreen('upload')} />
            )}
            </Screen>
          </div>
          <ConfettiBurst fire={burst} />
        </div>
      </IOSDevice>

      <TweaksPanel>
        <TweakSection label="Celebration" />
        <TweakText label="Event title" value={t.eventTitle} onChange={v => setTweak('eventTitle', v)} />
        <TweakColor label="Accent" value={t.primaryColor}
          options={['#EC4899', '#7C3AED', '#FB7185', '#F59E0B', '#22C55E', '#38BDF8']}
          onChange={v => setTweak('primaryColor', v)} />
        <TweakSection label="Type & motion" />
        <TweakRadio label="Display font" value={t.displayFont}
          options={['Fredoka', 'Baloo 2', 'Quicksand']} onChange={v => setTweak('displayFont', v)} />
        <TweakToggle label="Floating confetti" value={t.confetti} onChange={v => setTweak('confetti', v)} />
      </TweaksPanel>
    </div>
  );
}

window.App = App;
