import * as THREE from 'three';
import { MeshBuilder } from './geo.js';
import { charMat } from './characters.js';

// The three playable cats. Colors follow the reference photo.
export const CATS = {
  ginger: {
    name: 'Toro',
    desc: 'Big, fluffy and orange. Green eyes.',
    body: '#e3a052', stripe: '#c9813a', light: '#f2c890', muzzle: '#f4d6a6', paws: '#f0c48a',
    eye: '#86b04a', chubby: 1.12, stripes: 'faint', meow: 520,
  },
  tabby: {
    name: 'Uni',
    desc: 'Brown tabby with a white bib and socks. Green eyes.',
    body: '#8c6a46', stripe: '#2f251a', light: '#f3eee6', muzzle: '#f3eee6', paws: '#f3eee6',
    eye: '#a8b84a', chubby: 1, stripes: 'bold', meow: 660,
  },
  calico: {
    name: 'Phantom',
    desc: 'Tortoiseshell tabby with orange patches and a white bib. Amber eyes.',
    body: '#7a5a3a', stripe: '#2a2016', light: '#f3eee6', muzzle: '#e9c9a0', paws: '#f3eee6',
    eye: '#d9b22e', chubby: 1.04, stripes: 'bold', patches: '#cf7f36', meow: 800,
  },
};
export const CAT_ORDER = ['ginger', 'tabby', 'calico'];

function ear(b, x, y, z, outer, inner) {
  const w = 0.06, d = 0.04, h = 0.12;
  const apex = [x, y + h, z];
  b.tri([x - w, y, z + d], [x + w, y, z + d], apex, outer);
  b.tri([x + w, y, z - d], [x - w, y, z - d], apex, outer);
  b.tri([x - w, y, z - d], [x - w, y, z + d], apex, outer);
  b.tri([x + w, y, z + d], [x + w, y, z - d], apex, outer);
  b.tri([x - 0.035, y + 0.01, z + d + 0.002], [x + 0.035, y + 0.01, z + d + 0.002], [x, y + 0.08, z + 0.02], inner);
}

// Blocky cat facing +z: merged body/head, four legs pivoting at the hips and shoulders, and a tail.
export function makeCat(id) {
  const c = CATS[id];
  const W = 0.34 * c.chubby;
  const b = new MeshBuilder();
  // Body and belly.
  b.box(0, 0.22, 0, W, 0.3, 0.62, c.body);
  b.box(0, 0.215, 0.02, W * 0.8, 0.02, 0.5, c.light);
  b.box(0, 0.24, 0.3, W * 0.86, 0.22, 0.04, c.light);
  if (c.patches) {
    b.box(W * 0.12, 0.3, -0.12, W * 0.82, 0.23, 0.2, c.patches);
    b.box(-W * 0.2, 0.36, 0.12, W * 0.7, 0.17, 0.16, c.patches);
    b.box(0, 0.62, 0.36, 0.2, 0.11, 0.18, c.patches);
  }
  const sh = c.stripes === 'faint' ? 0.08 : 0.13;
  for (const z of [-0.24, -0.12, 0, 0.12]) b.box(0, 0.52 - sh, z, W + 0.006, sh + 0.004, 0.035, c.stripe);
  b.box(0, 0.52, -0.06, 0.05, 0.006, 0.5, c.stripe);
  // Head.
  const hz = 0.38;
  b.box(0, 0.46, hz, 0.3, 0.26, 0.26, c.body);
  b.box(0, 0.44, hz + 0.04, 0.34, 0.12, 0.16, c.body); // cheeks
  b.box(0, 0.46, hz + 0.13, 0.16, 0.1, 0.05, c.muzzle);
  b.box(0, 0.54, hz + 0.158, 0.045, 0.03, 0.012, '#e8909a');
  for (const sx of [-1, 1]) {
    b.box(sx * 0.07, 0.585, hz + 0.131, 0.065, 0.055, 0.006, c.eye);
    b.box(sx * 0.07, 0.585, hz + 0.135, 0.016, 0.05, 0.004, '#111111');
    ear(b, sx * 0.09, 0.72, hz - 0.02, c.body, '#e8a0a0');
  }
  // Forehead "M" and cheek stripes.
  for (const x of [-0.06, 0, 0.06]) b.box(x, 0.66, hz + 0.128, 0.018, 0.05, 0.006, c.stripe);
  b.box(0, 0.718, hz - 0.02, 0.03, 0.006, 0.18, c.stripe);
  const body = new THREE.Mesh(b.build(), charMat);

  const legGeo = (paw) => {
    const lb = new MeshBuilder();
    lb.box(0, -0.25, 0, 0.09, 0.25, 0.09, c.body);
    lb.box(0, -0.3, 0.01, 0.1, 0.06, 0.11, paw);
    return lb.build();
  };
  const front = legGeo(c.paws), back = legGeo(c.paws);
  const legs = [];
  for (const [x, z, g] of [[-0.1, 0.2, front], [0.1, 0.2, front], [-0.1, -0.2, back], [0.1, -0.2, back]]) {
    const m = new THREE.Mesh(g, charMat);
    m.position.set(x * c.chubby, 0.3, z);
    legs.push(m);
  }
  const tb = new MeshBuilder();
  for (let i = 0; i < 6; i++) {
    const ring = c.stripes === 'bold' && i % 2 === 1;
    tb.box(0, -0.035, -0.035 - i * 0.07, 0.065, 0.065, 0.07, ring ? c.stripe : i === 5 && c.stripes === 'bold' ? c.stripe : c.body);
  }
  const tail = new THREE.Mesh(tb.build(), charMat);
  tail.position.set(0, 0.47, -0.3);

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
