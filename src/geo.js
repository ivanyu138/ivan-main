import * as THREE from 'three';

const _c = new THREE.Color();
// UV that lands on the plain border of the window texture (renders as flat wall color).
const PLAIN = [0.004, 0.004];

// Accumulates flat-shaded, vertex-colored geometry so large parts of the city
// can be merged into a handful of draw calls.
export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
  }

  get vertexCount() {
    return this.pos.length / 3;
  }

  _push(p, n, uv, c) {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.uv.push(uv[0], uv[1]);
    this.col.push(c.r, c.g, c.b);
  }

  // a,b,c,d counter-clockwise when viewed from the front.
  quad(a, b, c, d, color, uvs = null) {
    _c.set(color);
    const n = faceNormal(a, b, d);
    const i = this.vertexCount;
    const u = uvs || [PLAIN, PLAIN, PLAIN, PLAIN];
    this._push(a, n, u[0], _c);
    this._push(b, n, u[1], _c);
    this._push(c, n, u[2], _c);
    this._push(d, n, u[3], _c);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  tri(a, b, c, color) {
    _c.set(color);
    const n = faceNormal(a, b, c);
    const i = this.vertexCount;
    this._push(a, n, PLAIN, _c);
    this._push(b, n, PLAIN, _c);
    this._push(c, n, PLAIN, _c);
    this.idx.push(i, i + 1, i + 2);
  }

  // Upward-facing rectangle.
  quadH(x0, z0, x1, z1, y, color) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color);
  }

  // Axis-aligned box centered on (cx, cz), from y0 up by h. `win` = {w, h} window tile size in meters.
  box(cx, y0, cz, w, h, d, color, win = null) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h;
    const side = (len) => {
      if (!win) return null;
      const u = (len / win.w) * 0.25, v = (h / win.h) * 0.25;
      return [[0, 0], [u, 0], [u, v], [0, v]];
    };
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color, side(d));
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color, side(d));
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, side(w));
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color, side(w));
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], color);
  }

  // Pitched roof over the wall rectangle (x0,z0)-(x1,z1) starting at height y.
  gable(x0, z0, x1, z1, y, h, roof, wall, alongX, o = 0.45) {
    const yt = y + h;
    if (alongX) {
      const zc = (z0 + z1) / 2;
      const ax0 = x0 - o, ax1 = x1 + o, az0 = z0 - o, az1 = z1 + o;
      this.quad([ax0, y, az1], [ax1, y, az1], [ax1, yt, zc], [ax0, yt, zc], roof);
      this.quad([ax1, y, az0], [ax0, y, az0], [ax0, yt, zc], [ax1, yt, zc], roof);
      this.tri([x0, y, az0], [x0, y, az1], [x0, yt, zc], wall);
      this.tri([x1, y, az1], [x1, y, az0], [x1, yt, zc], wall);
    } else {
      const xc = (x0 + x1) / 2;
      const ax0 = x0 - o, ax1 = x1 + o, az0 = z0 - o, az1 = z1 + o;
      this.quad([ax1, y, az1], [ax1, y, az0], [xc, yt, az0], [xc, yt, az1], roof);
      this.quad([ax0, y, az0], [ax0, y, az1], [xc, yt, az1], [xc, yt, az0], roof);
      this.tri([ax0, y, z1], [ax1, y, z1], [xc, yt, z1], wall);
      this.tri([ax1, y, z0], [ax0, y, z0], [xc, yt, z0], wall);
    }
  }

  // Vertical n-sided prism (fountains, ponds, domes).
  prism(cx, y0, cz, r, h, sides, color, topColor = color) {
    const y1 = y0 + h;
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cz - Math.sin(a) * r]);
    }
    for (let i = 0; i < sides; i++) {
      const p = pts[i], q = pts[(i + 1) % sides];
      this.quad([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], color);
      this.tri([cx, y1, cz], [p[0], y1, p[1]], [q[0], y1, q[1]], topColor);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

function faceNormal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

// 4x4 atlas of windows. The map darkens window panes; the emissive map lights a
// random subset of them at night.
export function makeWindowTextures() {
  const S = 32, N = 4;
  const base = document.createElement('canvas');
  base.width = base.height = S * N;
  const em = document.createElement('canvas');
  em.width = em.height = S * N;
  const b = base.getContext('2d'), e = em.getContext('2d');
  b.fillStyle = '#ffffff';
  b.fillRect(0, 0, S * N, S * N);
  e.fillStyle = '#000000';
  e.fillRect(0, 0, S * N, S * N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = i * S + 7, y = j * S + 5, w = 18, h = 20;
      b.fillStyle = '#3c4a5c';
      b.fillRect(x, y, w, h);
      b.fillStyle = '#6f8297';
      b.fillRect(x + 2, y + 2, 5, 7);
      b.fillStyle = '#d8d8d8';
      b.fillRect(x - 1, y + h, w + 2, 2);
      if (rnd() < 0.45) {
        e.fillStyle = rnd() < 0.5 ? '#ffd27a' : '#ffe9b0';
        e.fillRect(x, y, w, h);
      }
    }
  }
  const mk = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: mk(base), emissive: mk(em) };
}

export function textTexture(text, bg, fg = '#ffffff', w = 256, h = 64) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  x.strokeStyle = '#00000088';
  x.lineWidth = 6;
  x.strokeRect(3, 3, w - 6, h - 6);
  x.fillStyle = fg;
  x.font = `bold ${Math.floor(h * 0.48)}px "Courier New", monospace`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2 + 2, w - 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}
