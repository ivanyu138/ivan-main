import * as THREE from 'three';
import { SmoothBuilder, lerpColor, smooth01 } from './smooth.js';
import { charMat } from './characters.js';

// Proportions shared by the cats unless a cat overrides them.
const BASE = {
  bw: 0.34, bh: 0.3, bd: 0.62, leg: 0.3, legW: 0.09,
  hw: 0.3, hh: 0.26, hd: 0.26, cheek: 0.34, cheekH: 0.12,
  ear: 1, earX: 0.09, eyeW: 0.065, eyeH: 0.055, tailW: 0.065, tailN: 6,
};

// The three playable cats (ids are kept stable for save files).
export const CATS = {
  ginger: {
    name: 'Toro',
    desc: 'Golden shaded British Shorthair. Round, plush and green-eyed.',
    // Golden coat with darker tipping along the back, head and tail; cream underneath.
    body: '#e2b36c', top: '#b88a42', light: '#f6e5c2', muzzle: '#f7e9cc', paws: '#eed39e',
    eye: '#5fae5a', nose: '#c4786a', roundPupil: true, meow: 520,
    shape: {
      bw: 0.44, bh: 0.34, bd: 0.6, leg: 0.22, legW: 0.12,
      hw: 0.38, hh: 0.3, hd: 0.28, cheek: 0.46, cheekH: 0.16,
      ear: 0.7, earX: 0.125, eyeW: 0.085, eyeH: 0.08, tailW: 0.1, tailN: 4,
    },
  },
  tabby: {
    name: 'Uni',
    desc: 'Brown tabby with a white belly, bib and socks. Green eyes.',
    body: '#8a6844', stripe: '#2f251a', light: '#f4efe6', muzzle: '#f4efe6', paws: '#f4efe6',
    eye: '#a8b84a', belly: true, meow: 660,
  },
  calico: {
    name: 'Phantom',
    desc: 'Mixed-color tabby. Her face is split: brown and grey on one side, orange on the other. Amber eyes.',
    body: '#6e655a', stripe: '#2a2420', light: '#f3eee6', muzzle: '#efe2cf', paws: '#f3eee6',
    faceL: '#655b52', faceR: '#d4893c', patches: ['#d4893c', '#7a5232'], eye: '#d9b22e', meow: 800,
    shape: { bw: 0.35 },
  },
};
export const CAT_ORDER = ['ginger', 'tabby', 'calico'];

// Point on the surface of an axis-aligned ellipsoid, in front (+z) at offset (dx, dy) from its center.
function frontZ(cz, rx, ry, rz, dx, dy) {
  return cz + rz * Math.sqrt(Math.max(0, 1 - (dx / rx) ** 2 - (dy / ry) ** 2));
}

// Rounded cat facing +z: merged body/head, four legs pivoting at the hips and shoulders, and a tail.
// Coat patterns (stripes, patches, shading, the split face) are painted per vertex.
// id is one of the playable cats, or a coat definition in the same shape as CATS entries.
// lite builds a lower-detail version for background animals.
export function makeCat(id, lite = false) {
  const c = typeof id === 'string' ? CATS[id] : id, S = { ...BASE, ...c.shape };
  const Q = (n) => (lite ? Math.max(6, Math.round(n * 0.5)) : n);
  const L = S.leg, y0 = L - 0.08, T = y0 + S.bh, cy = y0 + S.bh / 2;
  const hz = S.bd / 2 + 0.07, hcy = T - 0.06 + S.hh / 2, front = hz + S.hd / 2;

  // Phantom's tortoiseshell: blotches of orange and brown over the grey-brown coat.
  const base = (x, y, z) => {
    if (!c.patches) return c.body;
    const n = Math.sin(x * 11 + z * 6.5) + Math.sin(z * 9.3 - y * 7 + 1.7) + Math.sin(x * 5 - y * 12 + 0.4);
    return n > 1.0 ? c.patches[0] : n < -1.1 ? c.patches[1] : c.body;
  };
  const coat = (x, y, z, nx, ny, nz) => {
    let col = lerpColor(base(x, y, z), base(x, y, z), 0);
    if (c.top) col = lerpColor(col, c.top, smooth01(0.25, 0.95, ny));
    if (c.stripe && ny > -0.3 && Math.sin(z * 38 + 1) > 0.42) col = lerpColor(col, c.stripe, c.patches ? 0.75 : 1);
    if (c.stripe && Math.abs(x) < 0.03 && ny > 0.8) col.set(c.stripe);
    const under = c.belly ? smooth01(0.1, -0.35, ny) : smooth01(-0.45, -0.85, ny);
    col = lerpColor(col, c.light, under);
    if (z > S.bd * 0.3 && y < cy + S.bh * 0.2) col = lerpColor(col, c.light, smooth01(S.bd * 0.3, S.bd * 0.42, z));
    return col;
  };
  const face = (x, y, z, nx, ny, nz) => {
    let col = c.faceL ? (x < 0 ? c.faceL : c.faceR) : c.body;
    if (c.top) col = lerpColor(col, c.top, smooth01(0.35, 0.95, ny) * 0.8);
    // Forehead "M": on Phantom only on the darker half, faint on the orange half.
    if (c.stripe && y > hcy + S.hh * 0.12 && nz > 0.15 && Math.sin(x * 70) > 0.55) {
      col = c.faceL && x > 0 ? lerpColor(col, '#a8602a', 0.8) : c.stripe;
    }
    if (c.stripe && ny > 0.85 && Math.abs(x) < 0.02) col = c.faceL && x > 0 ? col : c.stripe;
    if (ny < -0.35 && nz > 0.1) col = lerpColor(col, c.light, 0.85);
    return col;
  };

  const b = new SmoothBuilder();
  // Torso: chest, belly and hips as overlapping ellipsoids.
  b.sphere([0, cy, 0], [S.bw / 2, S.bh / 2, S.bd / 2], coat, Q(28));
  b.sphere([0, cy + 0.015, S.bd * 0.27], [S.bw * 0.48, S.bh * 0.5, S.bd * 0.25], coat, Q(20));
  b.sphere([0, cy, -S.bd * 0.27], [S.bw * 0.5, S.bh * 0.49, S.bd * 0.25], coat, Q(20));
  b.sphere([0, cy + S.bh * 0.32, S.bd * 0.42], [S.hw * 0.36, S.hh * 0.42, S.hd * 0.42], coat, Q(14));

  // Head
  const hr = [S.hw / 2, S.hh / 2, S.hd / 2];
  b.sphere([0, hcy, hz], hr, face, Q(24));
  b.sphere([0, hcy - S.hh * 0.18, hz + S.hd * 0.08], [S.cheek / 2, S.cheekH * 0.62, S.hd * 0.42], face, Q(18));
  const padY = hcy - S.hh * 0.22, padZ = frontZ(hz, hr[0], hr[1], hr[2], 0.03, padY - hcy);
  for (const sx of [-1, 1]) b.sphere([sx * 0.033, padY, padZ - 0.012], [0.042, 0.034, 0.034], c.muzzle, Q(12));
  b.sphere([0, hcy - S.hh * 0.36, padZ - 0.03], [0.03, 0.022, 0.026], c.light, Q(10));
  b.sphere([0, hcy - S.hh * 0.08, frontZ(hz, hr[0], hr[1], hr[2], 0, -S.hh * 0.08) + 0.008], [0.022, 0.016, 0.014], c.nose || '#e8909a', Q(10));
  const ey = S.hh * 0.08;
  for (const sx of [-1, 1]) {
    const ex = sx * S.hw * 0.22, ez = frontZ(hz, hr[0], hr[1], hr[2], ex, ey);
    b.sphere([ex, hcy + ey, ez - 0.012], [S.eyeW / 2, S.eyeH / 2, 0.02], c.eye, Q(14));
    b.sphere([ex, hcy + ey, ez + 0.004], [S.eyeW * (c.roundPupil ? 0.2 : 0.09), S.eyeH * 0.4, 0.008], '#111111', Q(10));
    b.sphere([ex + 0.008, hcy + ey + S.eyeH * 0.18, ez + 0.009], [0.006, 0.006, 0.003], '#ffffff', Q(6));
    // Ears: a soft cone with a pink inner cone, tilted outward.
    const earCol = c.faceL ? (sx < 0 ? c.faceL : c.faceR) : c.top || c.body;
    const eyY = hcy + S.hh * 0.38, ezE = hz - 0.01;
    b.cone([sx * S.earX, eyY + 0.05 * S.ear, ezE], 0.058 * S.ear, 0.13 * S.ear, earCol, [0, 0, -sx * 0.3], Q(12), [1, 1, 0.55]);
    b.cone([sx * S.earX + sx * 0.004, eyY + 0.045 * S.ear, ezE + 0.018 * S.ear], 0.036 * S.ear, 0.095 * S.ear, '#e8a0a0', [0, 0, -sx * 0.3], Q(10), [1, 1, 0.3]);
    // Whiskers
    if (!lite) for (const dy of [-0.012, 0.004, 0.02]) {
      b.cylinder([sx * 0.1, padY + dy, padZ - 0.01], 0.0022, 0.0022, 0.13, '#f4f0e6', [0, sx * 0.25, Math.PI / 2 + sx * dy * 6], Q(3));
    }
  }
  const body = new THREE.Mesh(b.build(), charMat);

  // Legs: rounded capsules with paws, pivoting at the top.
  const legGeo = (back) => {
    const lb = new SmoothBuilder();
    const r = S.legW / 2;
    lb.capsule([0, -(L - 0.03) / 2, 0], r * 1.05, Math.max(0.01, L - 0.03 - 2 * r), (x, y, z) => (y < -L + 0.07 ? c.paws : back ? coat(x, y + L, z - S.bd * 0.32, 0, 0, 0) : c.body), [0, 0, 0], Q(10));
    if (back) lb.sphere([0, -0.03, -0.005], [S.legW * 0.8, L * 0.38, S.legW * 1.15], (x, y, z, nx, ny, nz) => coat(x, y + L, z - S.bd * 0.32, nx, ny, nz), Q(12));
    lb.sphere([0, -L + 0.03, 0.018], [S.legW * 0.62, 0.035, S.legW * 0.82], c.paws, Q(12));
    return lb.build();
  };
  const frontLeg = legGeo(false), backLeg = legGeo(true);
  const legs = [];
  const lx = S.bw / 2 - 0.07, lz = S.bd * 0.32;
  for (const [x, z, g] of [[-lx, lz, frontLeg], [lx, lz, frontLeg], [-lx, -lz, backLeg], [lx, -lz, backLeg]]) {
    const m = new THREE.Mesh(g, charMat);
    m.position.set(x, L, z);
    legs.push(m);
  }

  // Tail: a gently curving tube, ringed on the tabbies.
  const tl = S.tailN * 0.07 + 0.05, tr = S.tailW / 2;
  const tb = new SmoothBuilder();
  const tailPaint = (x, y, z) => {
    if (c.stripe && (Math.sin(-z * 42) > 0.3 || z < -tl + 0.05)) return c.stripe;
    if (c.patches && z < -tl * 0.35 && z > -tl * 0.6) return c.patches[0];
    return c.top || c.body;
  };
  tb.tube([[0, 0, 0.02], [0, 0.01, -tl * 0.35], [0, 0.035, -tl * 0.7], [0, 0.07, -tl]], tr, tailPaint, 18, Q(10));
  tb.sphere([0, 0.07, -tl], [tr, tr, tr], tailPaint, Q(10));
  const tail = new THREE.Mesh(tb.build(), charMat);
  tail.position.set(0, T - 0.05, -S.bd / 2 + 0.03);

  const rig = new THREE.Group();
  rig.add(body, tail, ...legs);
  const group = new THREE.Group();
  group.add(rig);
  for (const m of [body, tail, ...legs]) m.castShadow = true;
  // Where a carried item sits: just in front of the chin.
  const mouth = { y: hcy - S.hh * 0.34, z: padZ + 0.02 };
  return { group, rig, body, tail, legs, mouth, t: 0 };
}

// phase: gait cycle, amt: 0..1 stride, swipe: 0..1 paw swipe, sit: 0..1 sitting blend,
// hiss: 0..1 puffed-up hiss pose, meow: 0..1 meow progress.
export function animateCat(cat, dt, phase, amt, swipe = 0, sit = 0, hiss = 0, meow = 0) {
  cat.t += dt;
  sit *= 1 - hiss;
  const [fl, fr, bl, br] = cat.legs;
  const s = Math.sin(phase) * 0.7 * amt;
  fl.rotation.x = s * (1 - sit) + 0.5 * sit;
  br.rotation.x = s * (1 - sit) - 1.2 * sit;
  fr.rotation.x = -s * (1 - sit) + 0.5 * sit;
  bl.rotation.x = -s * (1 - sit) - 1.2 * sit;
  cat.rig.rotation.x = -0.5 * sit;
  cat.rig.position.y = Math.abs(Math.sin(phase)) * 0.025 * amt + 0.06 * sit;
  cat.rig.position.z = -0.12 * sit;
  if (swipe > 0) fr.rotation.x = -1.5 * Math.sin(swipe * Math.PI);
  cat.tail.rotation.x = 0.9 - 0.45 * Math.min(1, amt) - 0.7 * sit;
  cat.tail.rotation.y = Math.sin(cat.t * (amt > 0.1 ? 6 : 1.6)) * (amt > 0.1 ? 0.2 : 0.35);
  if (meow > 0) cat.rig.rotation.x -= 0.18 * Math.sin(meow * Math.PI);
  if (hiss > 0) {
    // Puff up, stand tall on stiff legs, tail straight up and bristling.
    const puff = 1 + 0.14 * hiss;
    cat.rig.scale.set(puff, 1 + 0.18 * hiss, puff);
    cat.rig.position.y += 0.05 * hiss;
    for (const l of cat.legs) l.rotation.x *= 1 - hiss;
    cat.tail.rotation.x = cat.tail.rotation.x * (1 - hiss) + 1.5 * hiss;
    cat.tail.rotation.y = Math.sin(cat.t * 45) * 0.07 * hiss;
  } else cat.rig.scale.set(1, 1, 1);
}
