// Sáu màu sơn. Sửa tên, mô tả, mã màu ở đây là cả trang đổi theo.
//   nail   = màu sơn (móng tay + lọ)      bg  = màu nền khi chọn
//   ink    = màu chữ trên nền đó          accent = màu nhấn trên nền trắng
const SHADES = [
  { id: 'sua',     name: 'Sữa',      nail: '#ecc7b3', bg: '#e6b69d', ink: '#3a1d27', accent: '#b9785c', desc: 'Màu da ấm, gần như trong suốt — sạch sẽ cho mọi ngày.' },
  { id: 'hong',    name: 'Hồng',     nail: '#f08eb1', bg: '#f3a2bd', ink: '#4a1230', accent: '#d5568a', desc: 'Hồng phấn dịu, mềm như cánh hoa buổi sớm.' },
  { id: 'san-ho',  name: 'San hô',   nail: '#ff5a5c', bg: '#ff6a60', ink: '#fff6f2', accent: '#f0473f', desc: 'Cam đỏ rực rỡ, sinh ra cho mùa hè và những chuyến đi.' },
  { id: 'anh-dao', name: 'Anh đào',  nail: '#c80a34', bg: '#e3123f', ink: '#fff4f5', accent: '#d90f3b', desc: 'Đỏ kinh điển, đậm và bóng — không bao giờ lỗi thời.' },
  { id: 'man',     name: 'Mận',      nail: '#5e1240', bg: '#7c2459', ink: '#fff4f8', accent: '#8e1f5c', desc: 'Tím mận chín, sâu và ấm cho những buổi tối.' },
  { id: 'dem',     name: 'Đêm',      nail: '#22101a', bg: '#3b2030', ink: '#fbeef3', accent: '#3b2030', desc: 'Gần như đen, ánh lên sắc mận dưới đèn.' },
];
const PRICE = '289.000₫';

/* ---------- Dựng trang ---------- */

const $ = (s) => document.querySelector(s);
const root = document.documentElement;

// Mỗi lọ là cùng một ảnh chụp, tô lại theo màu của lọ; nền ảnh tô theo màu nền đang chọn
// và mờ dần ở mép để hoà vào phim phía sau.
$('#bottles').innerHTML = SHADES.map((s) =>
  `<button class="bottle" data-shade="${s.id}" aria-pressed="false" aria-label="Chọn màu ${s.name}"><canvas class="tile-film bottle-film" data-image="bottle" data-focus="0.5,0.47" data-zoom="1.2" data-feather="0.22,0.1" data-nail="${s.nail}"></canvas><span>${s.name}</span></button>`
).join('');

$('#swatches').innerHTML = SHADES.map((s) =>
  `<button class="swatch" data-shade="${s.id}" aria-pressed="false" aria-label="Thử màu ${s.name}" style="background:${s.nail}"></button>`
).join('');

// Lưới sản phẩm: xen kẽ thẻ lọ sơn và thẻ bàn tay (ảnh cắt từ phim, tô theo màu của thẻ).
$('#grid').innerHTML = SHADES.map((s, i) => {
  const onHand = i % 3 === 1;
  const art = onHand
    ? `<canvas class="tile-film" data-image="end" data-focus="0.5,0.56" data-zoom="1.25" data-nail="${s.nail}" data-bg="${s.bg}"></canvas><span class="tag">Trên tay</span>`
    : `<canvas class="tile-film" data-image="bottle" data-focus="0.52,0.47" data-zoom="1.12" data-nail="${s.nail}" data-bg="${s.bg}"></canvas>`;
  return `<article class="card reveal" style="--d:${(i % 3) * 0.08}s">
    <button class="card-tile" data-shade="${s.id}" data-try style="background-color:${s.bg}" aria-label="Thử màu ${s.name} trên tay">${art}</button>
    <div class="card-meta">
      <div><b>${s.name}</b><small>${PRICE} · 12 ml</small></div>
      <button class="add" data-add>Thêm +</button>
    </div>
  </article>`;
}).join('');

/* ---------- Phim bàn tay ---------- */

const filmCanvas = $('#film');
const film = new FilmRenderer(filmCanvas);
const still = new FilmRenderer(document.createElement('canvas')); // dùng chung cho các ảnh tĩnh
const LAST = FILM.count - 1;

const look = { nail: hexToRgb('#5e1240'), bg: hexToRgb('#7c2459') };      // màu đang hiển thị
const lookTarget = { nail: look.nail.slice(), bg: look.bg.slice() };      // màu đang chuyển tới
let frameTarget = 0, frameNow = 0, filmTick = 0, lastTime = 0, bottlesStale = false;

const shown = { img: null, view: null }; // khung và vùng phim đang hiển thị, để dò điểm chạm

const frames = loadFilmFrames((i) => {
  if (i === 0 || i === LAST) renderStills();
  requestFilm();
});
let bottleImg = null;
loadImage('bottle.jpg', (img) => { bottleImg = img; renderStills(); });

function requestFilm() {
  if (!filmTick) filmTick = requestAnimationFrame(drawFilm);
}

function drawFilm(now) {
  filmTick = 0;
  const dt = Math.min(64, now - (lastTime || now));
  lastTime = now;
  let moving = false, recolouring = false;

  // Khung hình đuổi theo vị trí cuộn một cách mềm mại.
  const df = frameTarget - frameNow;
  if (Math.abs(df) > 0.02) { frameNow += df * (1 - Math.exp(-dt / 90)); moving = true; } else frameNow = frameTarget;

  // Màu móng và nền chuyển dần sang màu mới.
  const k = 1 - Math.exp(-dt / 140);
  for (const key of ['nail', 'bg']) {
    for (let c = 0; c < 3; c++) {
      const d = lookTarget[key][c] - look[key][c];
      if (Math.abs(d) > 0.002) { look[key][c] += d * k; moving = recolouring = true; } else look[key][c] = lookTarget[key][c];
    }
  }

  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.min(1920, Math.round(filmCanvas.clientWidth * dpr));
  const h = Math.round(w * filmCanvas.clientHeight / Math.max(1, filmCanvas.clientWidth));
  film.resize(w, h);
  const img = nearestFrame(frames, Math.round(frameNow));
  if (img) {
    const t = frameNow / LAST, e = t * t * (3 - 2 * t);
    const ca = w / h, ia = img.naturalWidth / img.naturalHeight;
    const lerp = (x, y, k2) => x + (y - x) * k2;
    let view, edge = [0, 0];
    if (ca < 0.7) {
      // Điện thoại dọc: phim chỉ cao 75% màn hình để bàn tay không quá to. Lúc đầu phim nằm
      // lùi xuống (chừa chỗ cho chữ), sau đó trượt lên sát mép trên vì cánh tay đi vào từ trên.
      const k3 = 0.75, sx = ca / (k3 * ia);
      const top = 0.14 * (1 - Math.min(1, t / 0.45)) ** 2;
      view = [sx, 1 / k3, lerp(0.75 - sx, 0.5 - sx / 2, e), -top / k3];
      edge = [0.06 * Math.min(1, top / 0.04), 0.08];
    } else {
      // Màn hình ngang: lúc đầu phóng nhẹ, bàn tay nằm cao và lệch trái để chừa chỗ cho hàng
      // lọ sơn và phần chữ; về cuối trả lại toàn khung, bàn tay ở giữa.
      const zoom = lerp(1.18, 1, e);
      let sx = 1, sy = 1;
      if (ca > ia) sy = ia / ca; else sx = ca / ia;
      sx /= zoom; sy /= zoom;
      const clamp = (v, max) => Math.min(max, Math.max(0, v));
      const ox0 = clamp(0.76 - sx * 0.72, 1 - sx), oy0 = clamp(0.5 - sy * 0.36, 1 - sy);
      view = [sx, sy, lerp(ox0, (1 - sx) / 2, e), lerp(oy0, (1 - sy) / 2, e)];
    }
    film.draw(img, { nail: look.nail, bg: look.bg, view, edge });
    shown.img = img; shown.view = view;
  }

  // Nền của các lọ sơn đổi màu cùng nhịp với nền phim.
  if (recolouring || bottlesStale) { renderStills('.bottle-film'); bottlesStale = recolouring; }

  if (moving) { lastTime = now; requestFilm(); } else lastTime = 0;
}

// Ảnh tĩnh trong các ô: khung đầu / khung cuối của phim hoặc ảnh lọ sơn, tô theo màu riêng
// của ô (data-nail, data-bg) hoặc theo màu đang chọn nếu ô không ghi màu.
function renderStills(selector = '.tile-film') {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const sources = { start: frames[0], end: frames[LAST], bottle: bottleImg };
  document.querySelectorAll(selector).forEach((cv) => {
    const kind = cv.dataset.image, img = sources[kind];
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (!img || !w || !h) return;
    const hero = cv.classList.contains('bottle-film');
    still.resize(w, h);
    still.gl.clearColor(0, 0, 0, 0);
    still.gl.clear(still.gl.COLOR_BUFFER_BIT);
    still.draw(img, {
      nail: cv.dataset.nail ? hexToRgb(cv.dataset.nail) : lookTarget.nail,
      bg: cv.dataset.bg ? hexToRgb(cv.dataset.bg) : (hero ? look.bg : lookTarget.bg),
      focus: cv.dataset.focus.split(',').map(Number),
      zoom: Number(cv.dataset.zoom),
      key: kind === 'bottle' ? KEY_BOTTLE : KEY_HAND,
      bgLum: kind === 'bottle' ? 0.755 : 0.8,
      feather: (cv.dataset.feather || '0,0').split(',').map(Number),
    });
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(still.canvas, 0, 0);
  });
}

/* ---------- Chọn màu ---------- */

function selectShade(id) {
  const i = SHADES.findIndex((s) => s.id === id);
  if (i < 0) return;
  const s = SHADES[i];
  root.style.setProperty('--bg', s.bg);
  root.style.setProperty('--nail', s.nail);
  root.style.setProperty('--ink', s.ink);
  root.style.setProperty('--accent', s.accent);
  lookTarget.nail = hexToRgb(s.nail);
  lookTarget.bg = hexToRgb(s.bg);
  bottlesStale = true;
  requestFilm();
  renderStills('.tile-film:not(.bottle-film)');

  $('#shadeIndex').textContent = String(i + 1).padStart(2, '0');
  $('#shadeDesc').textContent = s.desc;
  $('#pickerName').textContent = s.name;
  const title = $('#shadeName');
  if (title.textContent !== s.name) {
    title.textContent = s.name;
    title.classList.remove('swap');
    void title.offsetWidth; // chạy lại hiệu ứng đổi tên
    title.classList.add('swap');
  }

  document.querySelectorAll('.bottle, .swatch').forEach((el) =>
    el.setAttribute('aria-pressed', String(el.dataset.shade === id))
  );
}

document.addEventListener('click', (e) => {
  const shadeBtn = e.target.closest('[data-shade]');
  if (shadeBtn) {
    selectShade(shadeBtn.dataset.shade);
    // Bấm thẻ trong lưới: quay lên xem màu trên bàn tay lớn.
    if (shadeBtn.hasAttribute('data-try')) playFilm();
    return;
  }
  if (e.target.closest('[data-play]')) { playFilm(); return; }
  const addBtn = e.target.closest('[data-add]');
  if (addBtn) {
    const count = $('#cartCount');
    count.textContent = Number(count.textContent) + 1;
    if (addBtn.classList.contains('add')) {
      addBtn.classList.add('done');
      addBtn.textContent = 'Đã thêm ✓';
      setTimeout(() => { addBtn.classList.remove('done'); addBtn.textContent = 'Thêm +'; }, 1400);
    }
  }
});

/* ---------- Cuộn: phim chạy theo vị trí cuộn, lọ sơn trượt đi ---------- */

const hero = $('#hero');
const nav = $('#nav');
const picker = $('#picker');
let ticking = false;

function onScroll() {
  ticking = false;
  const range = hero.offsetHeight - innerHeight;
  const raw = Math.min(1, Math.max(0, (scrollY - hero.offsetTop) / range));
  const p = raw * raw * (3 - 2 * raw); // smoothstep cho chuyển động mềm
  hero.style.setProperty('--p', p.toFixed(4));
  frameTarget = Math.min(1, raw / 0.88) * LAST; // phim chạy xong sớm một chút, giữ khung cuối
  requestFilm();
  picker.classList.toggle('live', p > 0.7);
  nav.classList.toggle('on-paper', scrollY > hero.offsetTop + hero.offsetHeight - 60);
}
addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
}, { passive: true });
addEventListener('resize', () => { onScroll(); renderStills(); });

/* ---------- Chạm vào bàn tay: phim tự chạy tới góc nhìn từ trên xuống ---------- */

// Phim gắn với vị trí cuộn, nên "phát phim" chính là tự cuộn mượt tới cuối cảnh mở đầu.
let autoPlay = 0;
function stopFilm() { cancelAnimationFrame(autoPlay); autoPlay = 0; }
function playFilm() {
  stopFilm();
  const range = hero.offsetHeight - innerHeight;
  const from = scrollY, to = hero.offsetTop + range * 0.94;
  const dur = 1800 * Math.max(0.4, Math.min(1, Math.abs(to - from) / (range * 0.94)));
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    window.scrollTo({ top: from + (to - from) * ease, behavior: 'instant' });
    autoPlay = k < 1 ? requestAnimationFrame(step) : 0;
  };
  autoPlay = requestAnimationFrame(step);
}
// Người dùng tự cuộn hay chạm thì nhường lại quyền điều khiển.
['wheel', 'touchstart', 'keydown'].forEach((type) => addEventListener(type, stopFilm, { passive: true }));

// Điểm (clientX, clientY) có nằm trên bàn tay không: đọc màu điểm ảnh tương ứng của khung hình
// đang hiển thị — da thì ấm (đỏ > lam), móng thì xanh lá, nền thì xám.
const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
probe.canvas.width = probe.canvas.height = 1;
function isOnHand(clientX, clientY) {
  const { img, view } = shown;
  if (!img) return false;
  const box = filmCanvas.getBoundingClientRect();
  const u = (clientX - box.left) / box.width * view[0] + view[2];
  const v = (clientY - box.top) / box.height * view[1] + view[3];
  if (u < 0 || u > 1 || v < 0 || v > 1) return false;
  probe.drawImage(img, u * img.naturalWidth - 2, v * img.naturalHeight - 2, 5, 5, 0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return r - b > 28 || g - Math.max(r, b) > 20;
}
filmCanvas.addEventListener('click', (e) => {
  if (frameTarget < LAST - 1 && isOnHand(e.clientX, e.clientY)) playFilm();
});
filmCanvas.addEventListener('mousemove', (e) => {
  filmCanvas.style.cursor = frameTarget < LAST - 1 && isOnHand(e.clientX, e.clientY) ? 'pointer' : '';
});

/* ---------- Hiện dần khi cuộn tới ---------- */

const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

/* ---------- Form đăng ký (chưa nối máy chủ — chỉ hiện lời cảm ơn) ---------- */

$('#signupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#email');
  const note = $('#formNote');
  if (!input.checkValidity()) { note.textContent = 'Email chưa đúng, bạn kiểm tra lại giúp nhé.'; return; }
  note.textContent = 'Cảm ơn bạn! Chúng tôi sẽ báo khi có màu mới.';
  input.value = '';
});

selectShade('man');
onScroll();
