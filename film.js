// Phim bàn tay: 123 khung hình JPEG trong thư mục frames/, cắt từ video gốc
// (móng sơn xanh lá, nền xám). Mỗi khung được vẽ qua WebGL và tô lại ngay lúc vẽ:
//   - điểm ảnh xanh lá  → màu sơn đang chọn (giữ nguyên độ sáng tối và vệt bóng)
//   - điểm ảnh xám      → màu nền đang chọn (giữ nguyên bóng đổ của bàn tay)
//   - da tay            → giữ nguyên
const FILM = {
  count: 123,
  path: (i) => `frames/f_${String(i).padStart(3, '0')}.jpg`,
};
// Màu xanh "khóa" đo được trong từng nguồn ảnh (0–1). Đổi video/ảnh thì đo lại hai số này.
const KEY_HAND = [0.047, 0.549, 0.298];
const KEY_BOTTLE = [0.02, 0.555, 0.2];

const FILM_VERT = `
attribute vec2 aPos;
uniform vec4 uView;            // xy = phần ảnh nhìn thấy, zw = góc trên-trái
varying vec2 vUv;
varying vec2 vPos;             // vị trí trên canvas, 0–1
void main() {
  vec2 uv = aPos * 0.5 + 0.5;
  uv.y = 1.0 - uv.y;
  vPos = uv;
  vUv = uv * uView.xy + uView.zw;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FILM_FRAG = `
precision mediump float;
varying vec2 vUv;
varying vec2 vPos;
uniform sampler2D uFrame;
uniform vec2 uTexel;
uniform vec3 uNail;
uniform vec3 uBg;
uniform vec3 uKey;             // màu xanh "khóa" của nguồn ảnh
uniform vec2 uFeather;         // > 0: làm mờ dần mép canvas (ngang, dọc) về trong suốt
uniform vec2 uEdge;            // > 0: hoà mép trên / mép dưới của ảnh vào màu nền phẳng
uniform float uBgLum;          // độ sáng trung bình của nền xám trong nguồn ảnh

// Lượng sơn xanh trong một điểm ảnh. Với xám, trắng và da, g ≈ (r + b) / 2 nên kết quả ≈ 0.
float paint(vec3 c) {
  return max(c.g - 0.5 * (c.r + c.b), 0.0) / (uKey.g - 0.5 * (uKey.r + uKey.b));
}
// Da luôn ấm (đỏ > lam) kể cả trong bóng tối; nền xám thì đỏ ≈ lam.
// Bóng đổ trên nền hơi ám ấm nên vùng tối phải ấm rõ rệt mới tính là da.
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float skinness(vec3 c) {
  float lo = mix(0.13, 0.07, smoothstep(0.6, 0.85, luma(c)));
  // Vùng rất tối sát mép tay là bóng tiếp xúc: coi như nền để mép bóng không bị lởm chởm.
  return smoothstep(lo, lo + 0.09, (c.r - c.b) / max(c.r, 0.06)) * smoothstep(0.14, 0.26, luma(c));
}
// 1 nếu điểm ảnh là nền xám thuần (không phải da, sơn hay ánh trắng chói).
float isBackdrop(vec2 uv) {
  vec3 c = texture2D(uFrame, uv).rgb;
  return (1.0 - skinness(c)) * (1.0 - smoothstep(0.05, 0.14, paint(c))) * (1.0 - smoothstep(0.86, 0.92, luma(c)));
}

void main() {
  vec3 c = texture2D(uFrame, vUv).rgb;

  // Tách điểm ảnh = (lượng sơn a) × KEY + phần còn lại (da, nền xám hoặc ánh trắng phản chiếu).
  float a = paint(c);
  float nailish = smoothstep(0.05, 0.14, a);
  vec3 rest = max(c - a * uKey, 0.0);

  // Phần còn lại trung tính trên móng là ánh trắng — trừ khi nằm sát nền (viền móng),
  // khi đó nó là nền xám lẫn vào và phải được tô theo màu nền.
  vec2 d = uTexel * 2.5;
  float nearBg = max(
    max(max(isBackdrop(vUv + vec2(d.x, 0.0)), isBackdrop(vUv - vec2(d.x, 0.0))),
        max(isBackdrop(vUv + vec2(0.0, d.y)), isBackdrop(vUv - vec2(0.0, d.y)))),
    max(max(isBackdrop(vUv + d * 0.7), isBackdrop(vUv - d * 0.7)),
        max(isBackdrop(vUv + vec2(d.x, -d.y) * 0.7), isBackdrop(vUv + vec2(-d.x, d.y) * 0.7))));
  float highlight = nailish * (1.0 - nearBg);

  // Nền: lấy màu đang chọn, giữ lại sáng tối của ảnh gốc (bóng đổ, vùng sáng của đèn).
  // Điểm trung tính sáng chói (phản chiếu trên thuỷ tinh) thì giữ nguyên màu trắng.
  vec3 backdrop = uBg * min(pow(luma(rest) / uBgLum, 1.4), 1.3);
  float glint = smoothstep(0.90, 0.98, luma(rest));
  vec3 neutral = mix(backdrop, rest, max(highlight, glint));
  vec3 col = mix(neutral, rest, skinness(rest));

  // Sơn màu nhạt ngoài đời tối ở mép ít hơn sơn đậm, nên nén bớt độ tối theo độ sáng của màu.
  float shade = pow(min(a * 1.06, 1.35), mix(1.0, 0.55, luma(uNail)));
  col += uNail * shade * nailish;

  // Khi ảnh không phủ hết chiều cao canvas (màn hình dọc), phần ngoài ảnh là màu nền phẳng.
  float inside = 1.0;
  if (uEdge.x > 0.0) inside *= smoothstep(0.0, uEdge.x, vUv.y);
  if (uEdge.y > 0.0) inside *= smoothstep(0.0, uEdge.y, 1.0 - vUv.y);
  col = mix(uBg, col, inside);

  float alpha = 1.0;
  if (uFeather.x > 0.0) {
    vec2 e = smoothstep(vec2(0.0), uFeather, vPos) * smoothstep(vec2(0.0), uFeather, 1.0 - vPos);
    alpha = e.x * e.y;
  }
  gl_FragColor = vec4(col * alpha, alpha);
}`;

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

class FilmRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    this.gl = gl;
    if (!gl) return;

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, FILM_VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FILM_FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.u = {
      view: gl.getUniformLocation(prog, 'uView'),
      texel: gl.getUniformLocation(prog, 'uTexel'),
      nail: gl.getUniformLocation(prog, 'uNail'),
      bg: gl.getUniformLocation(prog, 'uBg'),
      key: gl.getUniformLocation(prog, 'uKey'),
      feather: gl.getUniformLocation(prog, 'uFeather'),
      edge: gl.getUniformLocation(prog, 'uEdge'),
      bgLum: gl.getUniformLocation(prog, 'uBgLum'),
    };
    this.image = null;
  }

  resize(w, h) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  // Vẽ một ảnh phủ kín canvas (kiểu "cover"), neo vào điểm focus của ảnh.
  // Truyền view = [sx, sy, ox, oy] để tự chọn vùng ảnh (có thể vượt ra ngoài ảnh theo chiều dọc,
  // khi đó dùng edge = [trên, dưới] để hoà mép ảnh vào màu nền).
  draw(image, { nail, bg, focus = [0.5, 0.5], zoom = 1, key = KEY_HAND, feather = [0, 0], view = null, edge = [0, 0], bgLum = 0.8 }) {
    const gl = this.gl;
    if (!gl || !image) return;
    if (image !== this.image) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      gl.uniform2f(this.u.texel, 1 / image.naturalWidth, 1 / image.naturalHeight);
      this.image = image;
    }
    const ca = this.canvas.width / this.canvas.height;
    const ia = image.naturalWidth / image.naturalHeight;
    let sx = 1, sy = 1;
    if (ca > ia) sy = ia / ca; else sx = ca / ia;
    sx /= zoom; sy /= zoom;
    let ox = Math.min(1 - sx, Math.max(0, focus[0] - sx / 2));
    let oy = Math.min(1 - sy, Math.max(0, focus[1] - sy / 2));
    if (view) [sx, sy, ox, oy] = view;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform4f(this.u.view, sx, sy, ox, oy);
    gl.uniform3fv(this.u.nail, nail);
    gl.uniform3fv(this.u.bg, bg);
    gl.uniform3fv(this.u.key, key);
    gl.uniform2fv(this.u.feather, feather);
    gl.uniform2fv(this.u.edge, edge);
    gl.uniform1f(this.u.bgLum, bgLum);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

// Tải một ảnh, thử lại vài lần nếu mạng lỗi; gọi done(img) hoặc done(null).
function loadImage(src, done, tries = 3) {
  const img = new Image();
  img.onload = () => {
    const ready = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    ready.then(() => done(img));
  };
  img.onerror = () => {
    if (tries > 1) setTimeout(() => loadImage(src, done, tries - 1), 500);
    else done(null);
  };
  img.src = src;
}

// Tải khung hình theo thứ tự thưa → dày: khung đầu, khung cuối, rồi cứ 16, 8, 4, 2, 1 khung,
// để cuộn được ngay khi mới tải một phần.
function loadFilmFrames(onFrame) {
  const frames = new Array(FILM.count);
  const order = [0, FILM.count - 1];
  for (const step of [16, 8, 4, 2, 1]) {
    for (let i = 0; i < FILM.count; i += step) if (!order.includes(i)) order.push(i);
  }
  let next = 0;
  const pump = () => {
    if (next >= order.length) return;
    const i = order[next++];
    loadImage(FILM.path(i), (img) => {
      if (img) { frames[i] = img; onFrame(i); }
      pump();
    });
  };
  for (let n = 0; n < 4; n++) pump();
  return frames;
}

// Khung đã tải gần khung i nhất.
function nearestFrame(frames, i) {
  for (let d = 0; d < frames.length; d++) {
    if (frames[i - d]) return frames[i - d];
    if (frames[i + d]) return frames[i + d];
  }
  return null;
}
