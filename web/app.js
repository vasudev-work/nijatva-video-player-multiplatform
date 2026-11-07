const video = document.getElementById('video');
const empty = document.getElementById('empty');
const list = document.getElementById('list');
const seek = document.getElementById('seek');
const cur = document.getElementById('cur');
const dur = document.getElementById('dur');
const playBtn = document.getElementById('play');

let items = [];
let index = -1;
let scrubbing = false;

function fmt(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const t = Math.floor(s);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  const two = v => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
}

function render() {
  list.innerHTML = '';
  items.forEach((it, i) => {
    const d = document.createElement('div');
    d.className = 'item' + (i === index ? ' active' : '');
    d.textContent = it.name;
    d.title = it.name;
    d.onclick = () => playAt(i);
    list.appendChild(d);
  });
}

function playAt(i) {
  if (i < 0 || i >= items.length) return;
  index = i;
  video.src = items[i].url;
  video.style.display = 'block';
  empty.style.display = 'none';
  video.play().catch(() => {});
  render();
}

document.getElementById('pick').onclick = () => document.getElementById('file').click();
document.getElementById('file').onchange = e => {
  const files = Array.from(e.target.files || []);
  files.forEach(f => items.push({ name: f.name, url: URL.createObjectURL(f) }));
  render();
  if (index < 0 && items.length) playAt(0);
};

document.getElementById('open').onclick = () => {
  const u = document.getElementById('url').value.trim();
  if (!u) return;
  items.push({ name: u.split('/').pop() || u, url: u });
  render();
  playAt(items.length - 1);
};

playBtn.onclick = () => { if (video.paused) video.play(); else video.pause(); };
document.getElementById('back10').onclick = () => { video.currentTime = Math.max(0, video.currentTime - 10); };
document.getElementById('fwd10').onclick = () => { video.currentTime = video.currentTime + 10; };
document.getElementById('speed').onchange = e => { video.playbackRate = parseFloat(e.target.value); };
document.getElementById('full').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.getElementById('stage').requestFullscreen();
};

video.addEventListener('play', () => playBtn.textContent = 'Pause');
video.addEventListener('pause', () => playBtn.textContent = 'Play');
video.addEventListener('ended', () => { if (index + 1 < items.length) playAt(index + 1); });

video.addEventListener('loadedmetadata', () => { dur.textContent = fmt(video.duration); });
video.addEventListener('timeupdate', () => {
  cur.textContent = fmt(video.currentTime);
  if (!scrubbing && isFinite(video.duration) && video.duration > 0) {
    seek.value = String(Math.round((video.currentTime / video.duration) * 1000));
  }
});
seek.addEventListener('input', () => { scrubbing = true; });
seek.addEventListener('change', () => {
  if (isFinite(video.duration)) video.currentTime = (Number(seek.value) / 1000) * video.duration;
  scrubbing = false;
});

document.addEventListener('keydown', e => {
  if (e.target.matches('input, select')) return;
  if (e.code === 'Space') { e.preventDefault(); playBtn.onclick(); }
  if (e.code === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 10);
  if (e.code === 'ArrowRight') video.currentTime += 10;
});

render();
