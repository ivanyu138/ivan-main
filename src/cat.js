import * as THREE from 'three';
import { MeshBuilder } from './geo.js';
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
    eye: '#5fae5a', nose: '#c4786a', meow: 520,
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

function ear(b, x, y, z, s, outer, inner) {
  const w = 0.06 * s, d = 0.04 * s, h = 0.12 * s;
  const apex = [x, y + h, z];
  b.tri([x - w, y, z + d], [x + w, y, z + d], apex, outer);
  b.tri([x + w, y, z - d], [x - w, y, z - d], apex, outer);
  b.tri([x - w, y, z - d], [x - w, y, z + d], apex, outer);
  b.tri([x + w, y, z + d], [x + w, y, z - d], apex, outer);
  b.tri([x - 0.035 * s, y + 0.01, z + d + 0.002], [x + 0.035 * s, y + 0.01, z + d + 0.002], [x, y + 0.08 * s, z + 0.02 * s], inner);
}

// Blocky cat facing +z: merged body/head, four legs pivoting at the hips and shoulders, and a tail.
export function makeCat(id) {
  const c = CATS[id], S = { ...BASE, ...c.shape };
  const L = S.leg, y0 = L - 0.08, T = y0 + S.bh;
  const b = new MeshBuilder();

  // Body, underside and chest.
  b.box(0, y0, 0, S.bw, S.bh, S.bd, c.body);
  if (c.belly) b.box(0, y0 - 0.004, 0.02, S.bw + 0.008, S.bh * 0.42, S.bd * 0.78, c.light);
  else b.box(0, y0 - 0.005, 0.02, S.bw * 0.8, 0.02, S.bd * 0.8, c.light);
  b.box(0, y0 + 0.02, S.bd / 2 - 0.01, S.bw * 0.86, S.bh * 0.75, 0.04, c.light);
  if (c.top) b.box(0, T - 0.09, -0.02, S.bw + 0.008, 0.094, S.bd * 0.92, c.top);
  if (c.patches) {
    const [orange, brown] = c.patches;
    b.box(S.bw * 0.15, y0 + 0.05, -0.14, S.bw * 0.75, S.bh * 0.85, 0.22, orange);
    b.box(-S.bw * 0.18, y0 + 0.1, 0.1, S.bw * 0.7, S.bh * 0.7, 0.18, brown);
    b.box(-S.bw * 0.1, T, -0.02, S.bw * 0.4, 0.012, 0.14, orange);
  }
  if (c.stripe) {
    for (const z of [-0.24, -0.12, 0, 0.12]) b.box(0, T - 0.13, z, S.bw + 0.006, 0.134, 0.035, c.stripe);
    b.box(0, T, -0.06, 0.05, 0.006, S.bd * 0.8, c.stripe);
  }

  // Head. Phantom's face is two colors, split down the middle.
  const hz = S.bd / 2 + 0.07, hy = T - 0.06, front = hz + S.hd / 2;
  const halves = c.faceL ? [[-1, c.faceL], [1, c.faceR]] : [[0, c.body]];
  for (const [side, col] of halves) {
    const w = side ? S.hw / 2 : S.hw, cw = side ? S.cheek / 2 : S.cheek;
    b.box((side * S.hw) / 4, hy, hz, w, S.hh, S.hd, col);
    b.box((side * S.cheek) / 4, hy - 0.02, hz + 0.04, cw, S.cheekH, S.hd * 0.62, col);
  }
  if (c.top) b.box(0, hy + S.hh - 0.05, hz - 0.01, S.hw + 0.006, 0.054, S.hd * 0.9, c.top);
  b.box(0, hy, front, 0.17, 0.1, 0.05, c.muzzle);
  b.box(0, hy + 0.08, front + 0.028, 0.045, 0.03, 0.012, c.nose || '#e8909a');
  const ey = hy + S.hh * 0.48;
  for (const sx of [-1, 1]) {
    b.box(sx * S.hw * 0.23, ey, front + 0.001, S.eyeW, S.eyeH, 0.006, c.eye);
    b.box(sx * S.hw * 0.23, ey, front + 0.005, S.eyeW * 0.25, S.eyeH * 0.9, 0.004, '#111111');
    const earCol = c.faceL ? (sx < 0 ? c.faceL : c.faceR) : c.top || c.body;
    ear(b, sx * S.earX, hy + S.hh, hz - 0.02, S.ear, earCol, '#e8a0a0');
  }
  if (c.stripe) {
    // Forehead "M"; on Phantom it sits on the darker half and the orange half gets fainter marks.
    const xs = c.faceL ? [-0.1, -0.06, -0.02] : [-0.06, 0, 0.06];
    for (const x of xs) b.box(x, hy + S.hh * 0.77, front - 0.002, 0.018, 0.05, 0.006, c.stripe);
    if (c.faceL) for (const x of [0.05, 0.09]) b.box(x, hy + S.hh * 0.77, front - 0.002, 0.016, 0.04, 0.006, '#a8602a');
    b.box(0, hy + S.hh - 0.002, hz - 0.02, 0.03, 0.006, S.hd * 0.7, c.stripe);
  }
  const body = new THREE.Mesh(b.build(), charMat);

  const lb = new MeshBuilder();
  lb.box(0, -(L - 0.05), 0, S.legW, L - 0.05, S.legW, c.body);
  lb.box(0, -L, 0.01, S.legW + 0.01, 0.06, S.legW + 0.02, c.paws);
  const legGeo = lb.build();
  const legs = [];
  const lx = S.bw / 2 - 0.07, lz = S.bd * 0.32;
  for (const [x, z] of [[-lx, lz], [lx, lz], [-lx, -lz], [lx, -lz]]) {
    const m = new THREE.Mesh(legGeo, charMat);
    m.position.set(x, L, z);
    legs.push(m);
  }

  const tb = new MeshBuilder();
  for (let i = 0; i < S.tailN; i++) {
    const ring = c.stripe && (i % 2 === 1 || i === S.tailN - 1);
    const col = ring ? c.stripe : c.top || c.body;
    tb.box(0, -S.tailW / 2, -S.tailW / 2 - i * 0.07, S.tailW, S.tailW, 0.07, c.patches && i === 2 ? c.patches[0] : col);
  }
  const tail = new THREE.Mesh(tb.build(), charMat);
  tail.position.set(0, T - 0.05, -S.bd / 2);

  const rig = new THREE.Group();
  rig.add(body, tail, ...legs);
  const group = new THREE.Group();
  group.add(rig);
  for (const m of [body, tail, ...legs]) m.castShadow = true;
  return { group, rig, body, tail, legs, t: 0 };
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
