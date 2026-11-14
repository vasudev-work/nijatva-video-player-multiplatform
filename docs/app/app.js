/* Nijatva Video Player — web app (mirrors the Android app's UI) */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const VIDEO_EXT = /\.(mp4|webm|mkv|mov|m4v|avi|ogv|3gp|ts|m3u8|mpd|flv)$/i;

const DEFAULTS = {
  theme: 'dark', gridView: false, sortBy: 'name', sortAsc: true,
  autoplay: true, resume: true, speed: 1, subtitleSize: 16
};

const load = (k, d) => { try { return JSON.parse(localStorage.getItem('nij_' + k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem('nij_' + k, JSON.stringify(v));

let settings = { ...DEFAULTS, ...load('settings', {}) };
let playlists = load('playlists', []);
let history = load('history', []);

let library = [];          // [{id,name,path,folder,file,url,duration,size}]
let currentView = 'home';
let currentFolder = null;
let currentPlaylist = null;
let query = '';
let queue = [];            // videos currently playing
let queueIndex = -1;

/* ---------------- helpers ---------------- */
const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const t = Math.floor(s), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  const two = (v) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
};
const bytes = (b) => {
  if (!b) return '';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(b < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

/* ---------------- thumbnails ---------------- */
const thumbCache = new Map();
let thumbQueue = [];
let thumbRunning = 0;

function requestThumb(video, el) {
  if (thumbCache.has(video.id)) { paintThumb(el, thumbCache.get(video.id)); return; }
  thumbQueue.push({ video, el });
  pumpThumbs();
}

function paintThumb(el, dataUrl) {
  if (!el) return;
  el.innerHTML = `<img alt="" src="${dataUrl}" />`;
}

function pumpThumbs() {
  while (thumbRunning < 2 && thumbQueue.length) {
    const job = thumbQueue.shift();
    if (thumbCache.has(job.video.id)) { paintThumb(job.el, thumbCache.get(job.video.id)); continue; }
    thumbRunning++;
    makeThumb(job.video).then((url) => {
      if (url) { thumbCache.set(job.video.id, url); paintThumb(job.el, url); }
      thumbRunning--; pumpThumbs();
    }).catch(() => { thumbRunning--; pumpThumbs(); });
  }
}

function makeThumb(video) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true; v.preload = 'metadata'; v.crossOrigin = 'anonymous';
    let done = false;
    const finish = (val) => { if (done) return; done = true; v.removeAttribute('src'); v.load(); resolve(val); };
    const timer = setTimeout(() => finish(null), 8000);
    v.onloadeddata = () => {
      try { v.currentTime = Math.min(1, (v.duration || 2) / 3); } catch { finish(null); }
    };
    v.onseeked = () => {
      clearTimeout(timer);
      try {
        const c = document.createElement('canvas');
        c.width = 320; c.height = 180;
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        finish(c.toDataURL('image/jpeg', 0.7));
      } catch { finish(null); }
    };
    v.onerror = () => { clearTimeout(timer); finish(null); };
    v.src = video.url;
  });
}

/* ---------------- library ---------------- */
function addFiles(files, folderName) {
  let added = 0;
  for (const file of files) {
    if (!VIDEO_EXT.test(file.name)) continue;
    const rel = file.webkitRelativePath || file.name;
    const parts = rel.split('/');
    const folder = folderName || (parts.length > 1 ? parts[0] : 'Files');
    library.push({
      id: uid(), name: file.name.replace(/\.[^.]+$/, ''), path: rel, folder,
      file, url: URL.createObjectURL(file), duration: 0, size: file.size
    });
    added++;
  }
  return added;
}

async function walkDirectory(handle, prefix = '') {
  const out = [];
  for await (const entry of handle.values()) {
    if (entry.kind === 'file') {
      if (VIDEO_EXT.test(entry.name)) out.push({ handle: entry, path: prefix + entry.name, folder: prefix.split('/').filter(Boolean)[0] || handle.name });
    } else {
      out.push(...await walkDirectory(entry, prefix + entry.name + '/'));
    }
  }
  return out;
}

async function openFolder() {
  if (window.showDirectoryPicker) {
    try {
      const dir = await window.showDirectoryPicker({ mode: 'read' });
      const entries = await walkDirectory(dir);
      if (!entries.length) { toast('Is folder me koi video nahi mila'); return; }
      for (const e of entries) {
        const file = await e.handle.getFile();
        library.push({
          id: uid(), name: file.name.replace(/\.[^.]+$/, ''), path: e.path, folder: e.folder,
          file, url: URL.createObjectURL(file), duration: 0, size: file.size
        });
      }
      toast(`${entries.length} videos mile`);
      render();
      loadDurations();
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  $('#file-input').click();
}

function loadDurations() {
  let i = 0;
  const next = () => {
    if (i >= library.length) return;
    const v = library[i++];
    if (v.duration) { next(); return; }
    const el = document.createElement('video');
    el.preload = 'metadata'; el.src = v.url;
    const done = () => { el.removeAttribute('src'); el.load(); next(); };
    el.onloadedmetadata = () => { v.duration = el.duration || 0; done(); };
    el.onerror = done;
  };
  for (let k = 0; k < 3; k++) next();
}

/* ---------------- sorting / filtering ---------------- */
function sorted(list) {
  const s = settings.sortBy, asc = settings.sortAsc ? 1 : -1;
  return [...list].sort((a, b) => {
    let r = 0;
    if (s === 'date') r = (a.file?.lastModified || 0) - (b.file?.lastModified || 0);
    else if (s === 'size') r = (a.size || 0) - (b.size || 0);
    else if (s === 'duration') r = (a.duration || 0) - (b.duration || 0);
    else r = a.name.localeCompare(b.name);
    return r * asc;
  });
}

function filtered() {
  let list = library;
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(v => v.name.toLowerCase().includes(q) || v.path.toLowerCase().includes(q));
  }
  return sorted(list);
}

function folders() {
  const map = new Map();
  for (const v of library) {
    if (!map.has(v.folder)) map.set(v.folder, []);
    map.get(v.folder).push(v);
  }
  return [...map.entries()].map(([name, vids]) => ({
    name, count: vids.length,
    duration: vids.reduce((a, v) => a + (v.duration || 0), 0),
    first: vids[0]
  })).sort((a, b) => a.name.localeCompare(b.name));
}

function historyFor(id) { return history.find(h => h.id === id); }


/* ---------------- add to playlist ---------------- */
function addToPlaylistSheet(v) {
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = '<h3>Add to playlist</h3>';
  if (!playlists.length) {
    const b = document.createElement('button');
    b.textContent = '+ New playlist…';
    b.onclick = () => {
      const name = prompt('Playlist ka naam');
      if (!name) return;
      playlists.push({ id: uid(), name, ids: [v.id] });
      save('playlists', playlists); sheet.remove(); toast('Added to ' + name);
    };
    sheet.appendChild(b);
  } else {
    playlists.forEach(pl => {
      const b = document.createElement('button');
      b.textContent = pl.name + (pl.ids.includes(v.id) ? '  \u2713' : '');
      b.onclick = () => {
        if (!pl.ids.includes(v.id)) pl.ids.push(v.id);
        save('playlists', playlists); sheet.remove(); toast('Added to ' + pl.name);
      };
      sheet.appendChild(b);
    });
  }
  const scrim = document.createElement('div');
  scrim.className = 'scrim'; scrim.onclick = () => sheet.remove();
  sheet.appendChild(scrim);
  document.body.appendChild(sheet);
}

function wireLongPress(el, v) {
  let t = null;
  el.addEventListener('pointerdown', () => { t = setTimeout(() => addToPlaylistSheet(v), 550); });
  const clear = () => clearTimeout(t);
  el.addEventListener('pointerup', clear);
  el.addEventListener('pointerleave', clear);
  el.addEventListener('pointercancel', clear);
}

/* ---------------- rendering ---------------- */
function setTitle(t, back = false) {
  $('#screen-title').textContent = t;
  $('#btn-back').hidden = !back;
}

function render() {
  document.body.classList.toggle('oled', settings.theme === 'oled');
  $$('#bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
  const c = $('#content');
  c.scrollTop = 0;

  if (currentView === 'home') renderHome(c);
  else if (currentView === 'library') renderLibrary(c);
  else if (currentView === 'folders') renderFolders(c);
  else if (currentView === 'playlists') renderPlaylists(c);
  else if (currentView === 'settings') renderSettings(c);
}

function videoCard(v, opts = {}) {
  const h = historyFor(v.id);
  const pct = h && h.duration ? Math.min(100, (h.position / h.duration) * 100) : 0;
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `
    <div class="thumb" data-thumb><div class="ph">▶</div><span class="dur">${v.duration ? fmt(v.duration) : ''}</span></div>
    <div class="meta">
      <div class="name">${esc(v.name)}</div>
      <div class="sub">${esc(v.folder)}${v.size ? ' · ' + bytes(v.size) : ''}</div>
      ${pct > 0 ? `<div class="progress"><i style="width:${pct}%"></i></div>` : ''}
    </div>`;
  el.onclick = () => play(v, opts.queue || filtered());
  wireLongPress(el, v);
  requestThumb(v, $('[data-thumb]', el));
  return el;
}

function videoRow(v, opts = {}) {
  const el = document.createElement('div');
  el.className = 'item';
  el.innerHTML = `
    <div class="thumb" data-thumb><div class="ph">▶</div></div>
    <div class="info">
      <div class="name">${esc(v.name)}</div>
      <div class="sub">${esc(v.path)}${v.duration ? ' · ' + fmt(v.duration) : ''}</div>
    </div>`;
  el.onclick = () => play(v, opts.queue || filtered());
  wireLongPress(el, v);
  requestThumb(v, $('[data-thumb]', el));
  return el;
}

function section(title, moreLabel, onMore) {
  const s = document.createElement('section');
  s.className = 'section';
  s.innerHTML = `<div class="section-head"><h2>${esc(title)}</h2></div>`;
  if (moreLabel) {
    const b = document.createElement('button');
    b.textContent = moreLabel; b.onclick = onMore;
    $('.section-head', s).appendChild(b);
  }
  return s;
}

function renderHome(c) {
  setTitle('Video Player', false);
  c.innerHTML = '';

  if (!library.length) {
    c.appendChild(emptyState());
    return;
  }

  const recent = history
    .map(h => library.find(v => v.id === h.id))
    .filter(Boolean).slice(0, 12);

  if (recent.length) {
    const s = section('Continue watching');
    const row = document.createElement('div');
    row.className = 'row-scroll';
    recent.forEach(v => row.appendChild(videoCard(v, { queue: recent })));
    s.appendChild(row);
    c.appendChild(s);
  }

  const newest = sorted(library).slice().sort((a, b) => (b.file?.lastModified || 0) - (a.file?.lastModified || 0)).slice(0, 12);
  const s2 = section('Recently added', 'See all', () => go('library'));
  const row2 = document.createElement('div');
  row2.className = 'row-scroll';
  newest.forEach(v => row2.appendChild(videoCard(v, { queue: newest })));
  s2.appendChild(row2);
  c.appendChild(s2);

  const fl = folders().slice(0, 12);
  const s3 = section('Folders', 'See all', () => go('folders'));
  const row3 = document.createElement('div');
  row3.className = 'row-scroll';
  fl.forEach(f => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<div class="thumb" data-thumb><div class="ph">🗀</div><span class="dur">${f.count}</span></div>
      <div class="meta"><div class="name">${esc(f.name)}</div><div class="sub">${f.count} videos · ${fmt(f.duration)}</div></div>`;
    el.onclick = () => openFolderView(f.name);
    if (f.first) requestThumb(f.first, $('[data-thumb]', el));
    row3.appendChild(el);
  });
  s3.appendChild(row3);
  c.appendChild(s3);
}

function renderLibrary(c) {
  setTitle('Library', false);
  c.innerHTML = '';
  const list = filtered();
  if (!list.length) { c.appendChild(emptyState(query ? 'Kuch nahi mila' : null)); return; }

  const wrap = document.createElement('div');
  wrap.className = settings.gridView ? 'grid' : 'list';
  list.forEach(v => wrap.appendChild(settings.gridView ? videoCard(v, { queue: list }) : videoRow(v, { queue: list })));
  c.appendChild(wrap);
}

function renderFolders(c) {
  if (currentFolder) return renderFolderDetail(c, currentFolder);
  setTitle('Folders', false);
  c.innerHTML = '';
  const fl = folders();
  if (!fl.length) { c.appendChild(emptyState()); return; }
  const wrap = document.createElement('div');
  wrap.className = 'list';
  fl.forEach(f => {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `<div class="thumb" data-thumb><div class="ph">🗀</div></div>
      <div class="info"><div class="name">${esc(f.name)}</div>
      <div class="sub">${f.count} videos · ${fmt(f.duration)}</div></div>`;
    el.onclick = () => openFolderView(f.name);
    if (f.first) requestThumb(f.first, $('[data-thumb]', el));
    wrap.appendChild(el);
  });
  c.appendChild(wrap);
}

function renderFolderDetail(c, folder) {
  setTitle(folder, true);
  c.innerHTML = '';
  const list = sorted(library.filter(v => v.folder === folder));
  const wrap = document.createElement('div');
  wrap.className = settings.gridView ? 'grid' : 'list';
  list.forEach(v => wrap.appendChild(settings.gridView ? videoCard(v, { queue: list }) : videoRow(v, { queue: list })));
  c.appendChild(wrap);
}

function renderPlaylists(c) {
  if (currentPlaylist) return renderPlaylistDetail(c, currentPlaylist);
  setTitle('Playlists', false);
  c.innerHTML = '';

  const add = document.createElement('button');
  add.className = 'btn'; add.style.marginBottom = '14px'; add.textContent = '+ New playlist';
  add.onclick = () => {
    const name = prompt('Playlist ka naam');
    if (!name) return;
    playlists.push({ id: uid(), name, ids: [] });
    save('playlists', playlists); render();
  };
  c.appendChild(add);

  if (!playlists.length) {
    const p = document.createElement('div');
    p.className = 'empty'; p.innerHTML = '<h3>Koi playlist nahi</h3><p>Playlist banao, phir Library me video par "Add to playlist" dabao.</p>';
    c.appendChild(p); return;
  }

  const wrap = document.createElement('div'); wrap.className = 'list';
  playlists.forEach(pl => {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `<div class="thumb"><div class="ph">≡</div></div>
      <div class="info"><div class="name">${esc(pl.name)}</div><div class="sub">${pl.ids.length} videos</div></div>`;
    el.onclick = () => { currentPlaylist = pl.id; render(); };
    wrap.appendChild(el);
  });
  c.appendChild(wrap);
}

function renderPlaylistDetail(c, id) {
  const pl = playlists.find(p => p.id === id);
  if (!pl) { currentPlaylist = null; return renderPlaylists(c); }
  setTitle(pl.name, true);
  c.innerHTML = '';
  const list = pl.ids.map(i => library.find(v => v.id === i)).filter(Boolean);
  if (!list.length) {
    const p = document.createElement('div');
    p.className = 'empty'; p.innerHTML = '<h3>Playlist khali hai</h3><p>Library me video par "Add to playlist" dabao.</p>';
    c.appendChild(p); return;
  }
  const wrap = document.createElement('div'); wrap.className = 'list';
  list.forEach(v => wrap.appendChild(videoRow(v, { queue: list })));
  c.appendChild(wrap);
}

function emptyState(msg) {
  const d = document.createElement('div');
  d.className = 'empty';
  d.innerHTML = `<h3>${esc(msg || 'Abhi koi video nahi')}</h3>
    <p>Apne device se video folder kholo — browser permission maangega, files kahin upload nahi hoti.</p>`;
  const b = document.createElement('button');
  b.className = 'btn'; b.textContent = '📂 Open folder';
  b.onclick = openFolder;
  d.appendChild(b);
  return d;
}

function renderSettings(c) {
  setTitle('Settings', false);
  c.innerHTML = '';

  const group = (title, rows) => {
    const s = document.createElement('section'); s.className = 'section';
    s.innerHTML = `<div class="section-head"><h2>${esc(title)}</h2></div>`;
    const g = document.createElement('div'); g.className = 'group';
    rows.forEach(r => g.appendChild(r));
    s.appendChild(g);
    return s;
  };

  const toggleRow = (label, desc, key) => {
    const row = document.createElement('div'); row.className = 'setting';
    row.innerHTML = `<div class="txt"><div class="t">${esc(label)}</div><div class="d">${esc(desc)}</div></div>
      <div class="switch ${settings[key] ? 'on' : ''}"></div>`;
    row.onclick = () => { settings[key] = !settings[key]; save('settings', settings); render(); };
    return row;
  };

  const selectRow = (label, key, options) => {
    const row = document.createElement('div'); row.className = 'setting';
    row.innerHTML = `<div class="txt"><div class="t">${esc(label)}</div></div>`;
    const sel = document.createElement('select');
    options.forEach(([val, txt]) => {
      const o = document.createElement('option'); o.value = val; o.textContent = txt;
      if (String(settings[key]) === String(val)) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => { settings[key] = isNaN(+sel.value) ? sel.value : +sel.value; save('settings', settings); render(); };
    row.appendChild(sel);
    return row;
  };

  c.appendChild(group('Appearance', [
    selectRow('Theme', 'theme', [['dark', 'Dark'], ['oled', 'OLED black']]),
    toggleRow('Grid view', 'Library me grid ya list', 'gridView'),
    selectRow('Sort by', 'sortBy', [['name', 'Name'], ['date', 'Date'], ['size', 'Size'], ['duration', 'Duration']]),
    toggleRow('Ascending', 'Chhote se bada', 'sortAsc')
  ]));

  c.appendChild(group('Playback', [
    toggleRow('Autoplay next', 'Agla video khud chale', 'autoplay'),
    toggleRow('Resume', 'Jahan chhoda wahan se', 'resume'),
    selectRow('Default speed', 'speed', [[0.5, '0.5x'], [0.75, '0.75x'], [1, '1.0x'], [1.25, '1.25x'], [1.5, '1.5x'], [2, '2.0x']])
  ]));

  const clr = document.createElement('div'); clr.className = 'setting';
  clr.innerHTML = `<div class="txt"><div class="t">Clear watch history</div><div class="d">${history.length} entries</div></div>`;
  const cb = document.createElement('button'); cb.className = 'chip'; cb.textContent = 'Clear';
  cb.style.color = 'var(--text)'; cb.style.background = 'var(--surface2)';
  cb.onclick = () => { history = []; save('history', history); render(); toast('History cleared'); };
  clr.appendChild(cb);
  c.appendChild(group('Data', [clr]));

  const about = document.createElement('section'); about.className = 'section';
  about.innerHTML = `<div class="group"><div class="setting"><div class="txt">
    <div class="t">Nijatva Video Player</div>
    <div class="d">Web build · 1.0.0 · Apache-2.0</div></div></div></div>`;
  c.appendChild(about);
}

/* ---------------- navigation ---------------- */
function go(view) {
  currentView = view; currentFolder = null; currentPlaylist = null;
  $('#searchbar').hidden = true;
  render();
}

function openFolderView(name) {
  currentView = 'folders'; currentFolder = name; render();
}

/* ---------------- player ---------------- */
const video = $('#video');
const overlay = $('#p-overlay');
let hideTimer = null, locked = false, aspectIdx = 0, menuOpen = false;
const ASPECTS = ['fit', 'zoom', 'stretch'];
let lastTap = 0;

function play(v, list) {
  queue = list && list.length ? list : [v];
  queueIndex = queue.findIndex(x => x.id === v.id);
  if (queueIndex < 0) { queue = [v]; queueIndex = 0; }
  loadCurrent();
  $('#player').hidden = false;
  document.body.style.overflow = 'hidden';
}

function loadCurrent() {
  const v = queue[queueIndex];
  if (!v) return;
  video.src = v.url;
  $('#p-title').textContent = v.name;
  const h = historyFor(v.id);
  if (settings.resume && h && h.position > 5) video.currentTime = h.position;
  video.playbackRate = Number(settings.speed) || 1;
  video.play().catch(() => {});
  showOverlay();
  refreshAudio();
}

function closePlayer() {
  video.pause();
  $('#player').hidden = true;
  document.body.style.overflow = '';
  overlay.classList.remove('hidden');
  render();
}

function showOverlay() {
  overlay.classList.remove('hidden');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (!video.paused && !locked && !menuOpen) overlay.classList.add('hidden');
  }, 4000);
}

let hudTimer = null;
function hud(text) {
  const el = $('#p-hud');
  el.textContent = text; el.hidden = false;
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => { el.hidden = true; }, 900);
}

function refreshAudio() {
  const tracks = video.audioTracks;
  $('#p-audio').style.opacity = tracks && tracks.length > 1 ? '1' : '.5';
}

/* controls */
$('#p-play').onclick = () => { video.paused ? video.play() : video.pause(); };
$('#p-rew').onclick = () => { video.currentTime = Math.max(0, video.currentTime - 10); hud('-10s'); };
$('#p-fwd').onclick = () => { video.currentTime += 10; hud('+10s'); };
$('#p-back').onclick = () => { if (queueIndex > 0) { queueIndex--; loadCurrent(); } else closePlayer(); };
$('#p-close').onclick = closePlayer;
$('#p-lock').onclick = () => {
  locked = !locked;
  overlay.classList.toggle('hidden', locked);
  $('#p-lock').textContent = locked ? '🔓' : '🔒';
  hud(locked ? 'Locked' : 'Unlocked');
};
$('#p-rotate').onclick = async () => {
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock(screen.orientation.type.startsWith('portrait') ? 'landscape' : 'portrait');
      hud('Rotated');
    } else hud('Rotation not supported');
  } catch { hud('Rotation not supported'); }
};
$('#p-aspect').onclick = () => {
  aspectIdx = (aspectIdx + 1) % ASPECTS.length;
  video.className = ASPECTS[aspectIdx];
  hud(ASPECTS[aspectIdx] === 'fit' ? 'Fit' : ASPECTS[aspectIdx] === 'zoom' ? 'Zoom' : 'Stretch');
};
$('#p-pip').onclick = async () => {
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await video.requestPictureInPicture();
  } catch { hud('PiP not supported'); }
};
$('#p-full').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('#player').requestFullscreen();
  } catch { hud('Fullscreen not supported'); }
};
$('#p-cc').onclick = () => {
  const t = video.textTracks;
  if (!t || !t.length) { hud('No subtitles'); return; }
  const showing = [...t].find(x => x.mode === 'showing');
  [...t].forEach(x => x.mode = 'disabled');
  if (!showing) { t[0].mode = 'showing'; hud('Subtitles on'); }
  else hud('Subtitles off');
};
$('#p-audio').onclick = () => {
  const tr = video.audioTracks;
  if (!tr || tr.length <= 1) { hud('Only one audio track'); return; }
  const idx = [...tr].findIndex(x => x.enabled);
  [...tr].forEach(x => x.enabled = false);
  tr[(idx + 1) % tr.length].enabled = true;
  hud(`Audio track ${((idx + 1) % tr.length) + 1}/${tr.length}`);
};
$('#p-more').onclick = (e) => { e.stopPropagation(); menuOpen = !menuOpen; $('#p-menu').hidden = !menuOpen; };

$('#p-menu').onclick = (e) => {
  const act = e.target.dataset.act;
  if (!act) return;
  if (act === 'repeat') {
    const order = ['none', 'all', 'one'];
    const cur = video.dataset.repeat || 'none';
    const next = order[(order.indexOf(cur) + 1) % 3];
    video.dataset.repeat = next;
    e.target.textContent = 'Repeat: ' + next;
    hud('Repeat ' + next);
  }
  if (act === 'shuffle') {
    const on = video.dataset.shuffle === '1';
    video.dataset.shuffle = on ? '0' : '1';
    e.target.textContent = 'Shuffle: ' + (on ? 'off' : 'on');
  }
  if (act === 'speed') { openSpeedSheet(); }
  if (act === 'close') closePlayer();
  menuOpen = false; $('#p-menu').hidden = true;
};

function openSpeedSheet() {
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = '<h3>Playback speed</h3>';
  [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].forEach(s => {
    const b = document.createElement('button');
    b.textContent = s + 'x' + (Math.abs(video.playbackRate - s) < 0.01 ? '  ✓' : '');
    b.onclick = () => { video.playbackRate = s; settings.speed = s; save('settings', settings); $('#p-speed').textContent = s.toFixed(1) + 'x'; sheet.remove(); };
    sheet.appendChild(b);
  });
  const scrim = document.createElement('div');
  scrim.className = 'scrim'; scrim.onclick = () => sheet.remove();
  sheet.appendChild(scrim);
  document.body.appendChild(sheet);
}

$('#p-speed').onclick = openSpeedSheet;

/* video events */
video.addEventListener('timeupdate', () => {
  $('#p-cur').textContent = fmt(video.currentTime);
  if (!seeking && isFinite(video.duration) && video.duration > 0) {
    $('#p-seek').value = String(Math.round((video.currentTime / video.duration) * 1000));
  }
  const v = queue[queueIndex];
  if (v && isFinite(video.duration)) {
    const rec = { id: v.id, name: v.name, position: video.currentTime, duration: video.duration, time: Date.now() };
    const i = history.findIndex(h => h.id === v.id);
    if (i >= 0) history[i] = rec; else history.unshift(rec);
    history = history.slice(0, 60);
    save('history', history);
  }
});
video.addEventListener('loadedmetadata', () => {
  $('#p-dur').textContent = fmt(video.duration);
  const v = queue[queueIndex];
  if (v && !v.duration) v.duration = video.duration || 0;
});
video.addEventListener('play', () => { $('#p-play').textContent = '⏸'; showOverlay(); });
video.addEventListener('pause', () => { $('#p-play').textContent = '▶'; overlay.classList.remove('hidden'); });
video.addEventListener('ended', () => {
  if (settings.autoplay && queueIndex + 1 < queue.length) { queueIndex++; loadCurrent(); }
  else showOverlay();
});

let seeking = false;
$('#p-seek').addEventListener('input', () => { seeking = true; });
$('#p-seek').addEventListener('change', () => {
  if (isFinite(video.duration)) video.currentTime = (Number($('#p-seek').value) / 1000) * video.duration;
  seeking = false;
});

/* tap to toggle overlay */
overlay.addEventListener('click', (e) => {
  if (e.target.closest('button') || e.target.closest('input')) return;
  if (locked) return;
  overlay.classList.toggle('hidden');
  if (!overlay.classList.contains('hidden')) showOverlay();
});

/* gestures: horizontal seek, left brightness, right volume */
let drag = null;
overlay.addEventListener('pointerdown', (e) => {
  if (locked || e.target.closest('button') || e.target.closest('input')) return;
  const now = Date.now();
  if (now - lastTap < 300) { video.paused ? video.play() : video.pause(); lastTap = 0; return; }
  lastTap = now;
  drag = { x: e.clientX, y: e.clientY, mode: 0, start: video.currentTime, vol: video.volume, bright: 1 };
});
overlay.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.mode) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    drag.mode = Math.abs(dx) > Math.abs(dy) ? 'seek' : (e.clientX < window.innerWidth / 2 ? 'bright' : 'volume');
  }
  if (drag.mode === 'seek') {
    const delta = (dx / window.innerWidth) * 180;
    hud(fmt(Math.max(0, drag.start + delta)) + ' / ' + fmt(video.duration));
    drag.target = Math.max(0, Math.min(video.duration || 0, drag.start + delta));
  } else if (drag.mode === 'volume') {
    const v = Math.max(0, Math.min(1, drag.vol - dy / 300));
    video.volume = v; hud('Volume ' + Math.round(v * 100) + '%');
  } else {
    const b = Math.max(0.3, Math.min(1.6, drag.bright - dy / 300));
    video.style.filter = `brightness(${b})`; hud('Brightness ' + Math.round((b - 0.3) / 1.3 * 100) + '%');
  }
});
overlay.addEventListener('pointerup', () => {
  if (drag && drag.mode === 'seek' && drag.target != null) video.currentTime = drag.target;
  drag = null;
});

/* ---------------- top bar ---------------- */
$('#btn-back').onclick = () => { currentFolder = null; currentPlaylist = null; render(); };
$('#btn-view').onclick = () => { settings.gridView = !settings.gridView; save('settings', settings); render(); };
$('#btn-sort').onclick = () => {
  const opts = ['name', 'date', 'size', 'duration'];
  settings.sortBy = opts[(opts.indexOf(settings.sortBy) + 1) % opts.length];
  save('settings', settings);
  toast('Sort: ' + settings.sortBy + (settings.sortAsc ? ' ↑' : ' ↓'));
  render();
};
$('#btn-search').onclick = () => {
  const bar = $('#searchbar');
  bar.hidden = !bar.hidden;
  if (!bar.hidden) $('#search-input').focus();
  else { query = ''; render(); }
};
$('#search-input').addEventListener('input', (e) => { query = e.target.value; render(); });

$$('#bottom-nav button').forEach(b => { b.onclick = () => go(b.dataset.view); });

/* hidden file input fallback */
const fileInput = document.createElement('input');
fileInput.type = 'file'; fileInput.id = 'file-input';
fileInput.accept = 'video/*'; fileInput.multiple = true; fileInput.hidden = true;
fileInput.onchange = () => {
  const n = addFiles([...fileInput.files], null);
  if (n) { toast(`${n} videos add hue`); render(); loadDurations(); }
  fileInput.value = '';
};
document.body.appendChild(fileInput);

/* keyboard */
document.addEventListener('keydown', (e) => {
  if ($('#player').hidden) return;
  if (e.target.matches('input')) return;
  if (e.code === 'Space') { e.preventDefault(); video.paused ? video.play() : video.pause(); }
  if (e.code === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 10);
  if (e.code === 'ArrowRight') video.currentTime += 10;
  if (e.code === 'Escape') closePlayer();
});

/* boot */
$('#p-speed').textContent = (Number(settings.speed) || 1).toFixed(1) + 'x';
render();
