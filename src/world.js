import * as THREE from 'three';
import { MeshBuilder, makeWindowTextures, textTexture } from './geo.js';
import { RNG, mod, clamp } from './util.js';
import { Colliders } from './collision.js';

// Brooklyn-style layout: avenues run north-south every 228m, narrow streets run
// east-west every 95m, so blocks are long rectangles lined with rowhouses.
// Avenue 5 (x = 0) is Main Street. The river is off the west edge.
// 2280m x 2280m ~= 2.0 square miles.
export const HALF = 342;
export const PX = 228;
export const PZ = (2 * 342) / 7; // seven blocks fill the same width as three long blocks
export const ROAD = 14;
export const WALK = 3;
export const NAX = 4; // avenues (x = const)
export const NSZ = 8; // streets (z = const)
export const NBX = 3;
export const NBZ = 7;
export const CURB = 0.15;
export const LANE = 3.4;
export const MAIN_I = 1;
export const MAP_PX = 1.5; // minimap pixels per meter
export const MAP_EXT = HALF + 60; // minimap covers -MAP_EXT..MAP_EXT

export const roadX = (i) => -HALF + i * PX;
export const roadZ = (j) => -HALF + j * PZ;
export const nodePos = (i, j) => ({ x: roadX(i), z: roadZ(j) });

const PARK = { i0: 2, i1: 2, j0: 4, j1: 5 };
export const isParkBlock = (bi, bj) => bi >= PARK.i0 && bi <= PARK.i1 && bj >= PARK.j0 && bj <= PARK.j1;
export const PARK_RECT = {
  x0: roadX(PARK.i0) + ROAD / 2, x1: roadX(PARK.i1 + 1) - ROAD / 2,
  z0: roadZ(PARK.j0) + ROAD / 2, z1: roadZ(PARK.j1 + 1) - ROAD / 2,
};
const inPark = (x, z) => x > PARK_RECT.x0 && x < PARK_RECT.x1 && z > PARK_RECT.z0 && z < PARK_RECT.z1;
const PLAYGROUNDS = new Set(['2,2']);

export function blockRect(bi, bj) {
  return { x0: roadX(bi) + ROAD / 2, x1: roadX(bi + 1) - ROAD / 2, z0: roadZ(bj) + ROAD / 2, z1: roadZ(bj + 1) - ROAD / 2 };
}

export function lotRect(bi, bj) {
  const r = blockRect(bi, bj);
  return { x0: r.x0 + WALK, x1: r.x1 - WALK, z0: r.z0 + WALK, z1: r.z1 - WALK };
}

export function blockIndex(x, z) {
  const bi = Math.floor((x + HALF) / PX), bj = Math.floor((z + HALF) / PZ);
  if (bi < 0 || bj < 0 || bi >= NBX || bj >= NBZ) return null;
  return [bi, bj];
}

export function blockAt(x, z) {
  return [clamp(Math.floor((x + HALF) / PX), 0, NBX - 1), clamp(Math.floor((z + HALF) / PZ), 0, NBZ - 1)];
}

export function onRoad(x, z) {
  if (Math.abs(x) > HALF + ROAD / 2 || Math.abs(z) > HALF + ROAD / 2 || inPark(x, z)) return false;
  const lx = mod(x + HALF, PX), lz = mod(z + HALF, PZ);
  return lx <= ROAD / 2 || lx >= PX - ROAD / 2 || lz <= ROAD / 2 || lz >= PZ - ROAD / 2;
}

export function groundHeight(x, z) {
  return blockIndex(x, z) && !onRoad(x, z) ? CURB : 0;
}

// Does the road from node (i,j) to (i+dx, j+dz) exist? Roads inside the big park don't.
export function segExists(i, j, dx, dz) {
  const ni = i + dx, nj = j + dz;
  if (ni < 0 || nj < 0 || ni >= NAX || nj >= NSZ) return false;
  if (dz) {
    const jm = Math.min(j, nj);
    return !(isParkBlock(i - 1, jm) && isParkBlock(i, jm));
  }
  const im = Math.min(i, ni);
  return !(isParkBlock(im, j - 1) && isParkBlock(im, j));
}

export function district(bi, bj) {
  if (isParkBlock(bi, bj)) return 'park';
  if (bj === 0) return bi === MAIN_I ? 'plaza' : 'downtown';
  if (PLAYGROUNDS.has(bi + ',' + bj)) return 'playground';
  if (bi === 0 && bj === NBZ - 1) return 'industrial';
  return 'residential';
}

// Shops on Main Street: blocks with bi = 4 face east onto it, bi = 5 face west.
export const POI_DEFS = [
  { id: 'townhall', name: 'BOROUGH HALL', block: [1, 0], color: '#d8d0bc' },
  { id: 'clinic', name: 'ST. MERCY CLINIC', block: [1, 1], color: '#dfe6e8', shop: 'clinic' },
  { id: 'diner', name: "LOU'S DINER", block: [0, 1], color: '#c94a4a', shop: 'diner' },
  { id: 'mart', name: 'CORNER BODEGA', block: [1, 2], color: '#3f8a5a', shop: 'mart' },
  { id: 'pizza', name: "TONY'S PIZZA", block: [0, 2], color: '#e0a030', shop: 'pizza' },
  { id: 'gym', name: 'IRON GYM', block: [1, 3], color: '#7a3a8a', shop: 'gym' },
  { id: 'garage', name: "VIC'S GARAGE", block: [0, 4], color: '#6a6a70', shop: 'garage' },
  { id: 'police', name: 'PRECINCT 78', block: [1, 4], color: '#3a4a7a' },
  { id: 'saloon', name: 'SALOON', block: [1, 5], color: '#8a5a32' },
];

const BROWNSTONE = ['#7a4a35', '#6b4030', '#8a5a40', '#5e3d2e', '#9a6a4a', '#b39a7a', '#c4b49a', '#8a3f2f', '#9a4a36', '#7a3a2e', '#a8584a'];
const CORNICE = ['#2e2824', '#3a302a', '#e8e0d0', '#5a4a3a', '#2a3a3a'];
const BRICK = ['#8a3f2f', '#9a4a36', '#7a3a2e', '#a8584a', '#6e4a3a', '#b0705a', '#5a4038', '#c8b8a0'];
const TOWERS = ['#9aa4ad', '#b8b2a5', '#7f8c99', '#a7b6c2', '#c4baa8', '#8c9296', '#6e7d8c'];
const AWNINGS = ['#b23b3b', '#2f7a4f', '#2f5a9a', '#c48a1e', '#7a3a8a', '#1f1f1f', '#d8d0c0', '#8a2a2a'];
const SIGNS = [
  ['PIZZA', '#c0392b'], ['BAGELS', '#2f5a9a'], ['DELI', '#2f7a4f'], ['COFFEE', '#5a3a28'], ['TACOS', '#d68910'],
  ['RAMEN', '#1f1f1f'], ['SUSHI', '#8a2a2a'], ['BAKERY', '#c48a5a'], ['BAR', '#3a2a4a'], ['WINE', '#6a1a2a'],
  ['BOOKS', '#2a4a3a'], ['FLOWERS', '#c94a9a'], ['LAUNDRY', '#2f8aa0'], ['HARDWARE', '#b23b3b'], ['PHARMACY', '#2f7a4f'],
  ['THAI', '#d68910'], ['BBQ', '#5a2a1a'], ['DUMPLINGS', '#c0392b'], ['FALAFEL', '#7a8a2a'], ['ICE CREAM', '#e07aa0'],
  ['BURGERS', '#a04000'], ['BARBER', '#2f5a9a'], ['RECORDS', '#1f1f1f'], ['VINTAGE', '#8e44ad'], ['PET SHOP', '#27ae60'],
  ['BANK', '#34495e'], ['GROCERY', '#2f7a4f'], ['TEA', '#6a8a3a'], ['NOODLES', '#c0392b'], ['CAFE', '#5a3a28'],
  ['GELATO', '#3aa0a0'], ['PUB', '#2a3a2a'],
];
const WIN_ROW = { w: 2.7, h: 3.2 };
const WIN_APT = { w: 3, h: 3.2 };
const WIN_TOWER = { w: 3, h: 3.5 };
const WIN_WARE = { w: 7, h: 4.5 };
const CH = 190;

function signAtlas() {
  const c = document.createElement('canvas'), W = 128, H = 32, cols = 4, rows = SIGNS.length / cols;
  c.width = W * cols;
  c.height = H * rows;
  const x = c.getContext('2d');
  SIGNS.forEach(([text, bg], i) => {
    const px = (i % cols) * W, py = Math.floor(i / cols) * H;
    x.fillStyle = bg;
    x.fillRect(px, py, W, H);
    x.strokeStyle = '#ffffff88';
    x.lineWidth = 2;
    x.strokeRect(px + 3, py + 3, W - 6, H - 6);
    x.fillStyle = '#fff6dc';
    x.font = 'bold 18px "Courier New", monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, px + W / 2, py + H / 2 + 1, W - 12);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return { tex: t, cols, rows };
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = new Colliders(32);
    this.chunks = new Map();
    this.trees = [];
    this.lamps = [];
    this.houseDoors = [];
    this.backyards = [];
    this.pois = {};
    this.parks = {};
    this.mapRects = [];
    this.mapCircles = [];
    this.signs = [];
    this.groundB = new MeshBuilder();
    this.markB = new MeshBuilder();
    this.signB = new MeshBuilder();
    this.rng = new RNG(20261029);
    this.atlas = signAtlas();

    const tex = makeWindowTextures();
    this.bldMat = new THREE.MeshLambertMaterial({
      vertexColors: true, map: tex.map, emissiveMap: tex.emissive, emissive: 0xffffff, emissiveIntensity: 0,
    });
    this.groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.markMat = new THREE.MeshLambertMaterial({
      vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });

    this.generate();
    this.finish();
  }

  chunkB(x, z) {
    const k = Math.floor((x + HALF + 20) / CH) * 100 + Math.floor((z + HALF + 20) / CH);
    let b = this.chunks.get(k);
    if (!b) this.chunks.set(k, (b = new MeshBuilder()));
    return b;
  }

  rect(x0, z0, x1, z1, color) {
    this.mapRects.push([x0, z0, x1, z1, color]);
  }

  // ---------------------------------------------------------------- generation

  generate() {
    const g = this.groundB;
    const E = HALF + ROAD / 2, F = 3200;
    g.quadH(-E, -E, E, E, 0, '#3a3b3f');
    const grass = '#4c7438';
    g.quadH(-E, -F, F, -E, 0, grass);
    g.quadH(-E, E, F, F, 0, grass);
    g.quadH(E, -E, F, E, 0, grass);
    // The river and a seawall along the west edge.
    g.box(-E - 1.5, -1.2, 0, 3, 1.35, E * 2 + 6, '#8a8780');
    g.quadH(-F, -F, -E - 3, F, -1.1, '#3d6f8f');
    g.quadH(-E - 3, -F, -E, -E - 3, -1.1, '#3d6f8f');
    g.quadH(-E - 3, E + 3, -E, F, -1.1, '#3d6f8f');
    for (let z = -E; z < E; z += 2.5) g.box(-E - 0.4, 0.15, z, 0.08, 1, 0.08, '#2a2a2a');
    g.box(-E - 0.4, 1.1, 0, 0.1, 0.08, E * 2, '#2a2a2a');

    for (let bi = 0; bi < NBX; bi++) {
      for (let bj = 0; bj < NBZ; bj++) if (!isParkBlock(bi, bj)) this.genBlock(bi, bj);
    }
    this.genBigPark();
    this.genRoadMarkings();
    this.genLamps();
    this.genBoundary();
  }

  sidewalkRing(r, color = '#a3a19a') {
    const g = this.groundB, W = r.x1 - r.x0, D = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    g.box(cx, 0, r.z0 + WALK / 2, W, CURB, WALK, color);
    g.box(cx, 0, r.z1 - WALK / 2, W, CURB, WALK, color);
    g.box(r.x0 + WALK / 2, 0, cz, WALK, CURB, D - WALK * 2, color);
    g.box(r.x1 - WALK / 2, 0, cz, WALK, CURB, D - WALK * 2, color);
    this.rect(r.x0, r.z0, r.x1, r.z1, color);
  }

  genBlock(bi, bj) {
    const r = blockRect(bi, bj), L = lotRect(bi, bj);
    const d = district(bi, bj), rng = this.rng;
    this.sidewalkRing(r);
    const lotColor = {
      residential: '#5f8545', playground: '#4f8c3a', downtown: '#8e8b85', plaza: '#8e8b85', industrial: '#7b786f',
    }[d];
    this.groundB.quadH(L.x0, L.z0, L.x1, L.z1, CURB, lotColor);
    this.rect(L.x0, L.z0, L.x1, L.z1, lotColor);
    if (d === 'residential') this.genResidential(bi, bj, L, rng);
    else if (d === 'downtown') this.genDowntown(L, rng, bi, bj);
    else if (d === 'plaza') this.genPlaza(L, rng);
    else if (d === 'playground') this.genPlayground(L, rng, bi, bj);
    else this.genIndustrial(L, rng);
  }

  addBuilding(cx, cz, w, h, d, color, win, y0 = CURB) {
    this.chunkB(cx, cz).box(cx, y0, cz, w, h, d, color, win);
    this.colliders.addBox(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, y0 + h);
    this.rect(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, shade(color, 0.72));
  }

  // Street trees in the sidewalk along a block's north and south edges.
  streetTrees(r, rng) {
    for (const z of [r.z0 + 0.7, r.z1 - 0.7]) {
      for (let x = r.x0 + 9; x < r.x1 - 9; x += rng.range(11, 15)) if (rng.chance(0.85)) this.addTree(x, z, rng, 0.9);
    }
  }

  genResidential(bi, bj, L, rng) {
    const mainEnd = bj >= 1 ? (bi === MAIN_I - 1 ? 'e' : bi === MAIN_I ? 'w' : null) : null;
    const poi = POI_DEFS.find((p) => p.block[0] === bi && p.block[1] === bj);
    for (const end of ['w', 'e']) {
      if (end === mainEnd) this.storefrontRow(L, end, poi, rng);
      else this.apartmentEnd(L, end, rng);
    }
    const ax0 = L.x0 + 17, ax1 = L.x1 - 17;
    this.rowhouseRow(ax0, ax1, L, 'n', rng);
    this.rowhouseRow(ax0, ax1, L, 's', rng);
    // Backyards run down the middle of the block.
    const bz0 = L.z0 + 19, bz1 = L.z1 - 19, mz = (bz0 + bz1) / 2;
    const m = this.markB;
    for (let x = ax0 + 14; x < ax1; x += rng.range(14, 22)) {
      m.box(x, CURB, mz, 0.08, 1.3, bz1 - bz0, '#7a5a3a');
      if (rng.chance(0.5)) this.addTree(x + rng.range(-8, 8), mz + rng.range(-12, 12), rng);
    }
    for (let k = 0; k < 3; k++) this.backyards.push({ x: ax0 + ((k + 0.5) * (ax1 - ax0)) / 3, z: mz, w: 26 });
    this.streetTrees(blockRect(bi, bj), rng);
  }

  rowhouseRow(ax0, ax1, L, front, rng) {
    let x = ax0;
    while (x < ax1 - 4) {
      // Rowhouses come in terraces of matching houses built together.
      const n = rng.int(3, 7);
      const style = {
        color: rng.pick(BROWNSTONE), cornice: rng.pick(CORNICE), w: rng.range(6.2, 8),
        h: rng.pick([10.2, 10.2, 13.4, 13.4, 13.4, 16.6]),
      };
      for (let k = 0; k < n && x < ax1 - 4; k++) {
        let w = Math.min(style.w, ax1 - x);
        if (ax1 - x - w < 5) w = ax1 - x;
        this.rowhouse(x, x + w, L, front, style, k);
        x += w;
      }
    }
  }

  rowhouse(x0, x1, L, front, style, k) {
    const set = 3.5, dep = 14, h = style.h, s = front === 'n' ? -1 : 1;
    const zf = front === 'n' ? L.z0 + set : L.z1 - set;
    const z0 = Math.min(zf, zf - s * dep), z1 = Math.max(zf, zf - s * dep);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0;
    const b = this.chunkB(cx, cz);
    b.box(cx, CURB, cz, w - 0.04, h, dep, style.color, WIN_ROW);
    b.box(cx, CURB + h - 0.15, zf + s * 0.3, w, 0.6, 0.6, style.cornice);
    const dx = k % 2 ? x0 + 1.7 : x1 - 1.7, stoop = shade(style.color, 0.82);
    b.box(dx, CURB, zf + s * 1, 2, 1.5, 2, stoop);
    b.box(dx, CURB, zf + s * 2.6, 2, 0.75, 1.2, stoop);
    const fz = zf + s * 0.02, y0 = CURB + 1.5, y1 = CURB + 3.9, da = dx - 0.6, db = dx + 0.6;
    if (s < 0) b.quad([db, y0, fz], [da, y0, fz], [da, y1, fz], [db, y1, fz], '#3a2418');
    else b.quad([da, y0, fz], [db, y0, fz], [db, y1, fz], [da, y1, fz], '#3a2418');
    this.colliders.addBox(x0, z0, x1, z1, CURB + h);
    this.rect(x0, z0, x1, z1, shade(style.color, 0.8));
    this.houseDoors.push({ x: dx, z: front === 'n' ? L.z0 - 1 : L.z1 + 1 });
  }

  // Five- and six-story brick apartment buildings with fire escapes, facing an avenue.
  apartmentEnd(L, end, rng) {
    const D = 16, s = end === 'e' ? 1 : -1, fx = end === 'e' ? L.x1 : L.x0, cx = fx - s * (D / 2);
    const mid = (L.z0 + L.z1) / 2;
    for (const [za, zb] of [[L.z0, mid], [mid, L.z1]]) {
      const zc = (za + zb) / 2, w = zb - za, h = rng.pick([16.6, 19.8, 19.8, 23]), c = rng.pick(BRICK);
      this.addBuilding(cx, zc, D, h, w - 0.2, c, WIN_APT);
      const b = this.chunkB(cx, zc);
      b.box(cx, CURB + h - 0.2, zc, D + 0.3, 0.7, w + 0.1, shade(c, 0.6));
      b.box(fx + s * 0.06, CURB, zc, 0.14, 2.6, 1.8, '#2a2018');
      for (let y = CURB + 3.4; y < CURB + h - 3; y += 3.2) {
        b.box(fx + s * 0.6, y, zc + w * 0.22, 1.1, 0.12, 4, '#1f1f1f');
        b.box(fx + s * 1.12, y, zc + w * 0.22, 0.06, 0.9, 4, '#1f1f1f');
      }
    }
  }

  // Main Street frontage: shops and restaurants at street level, apartments above.
  storefrontRow(L, end, poi, rng) {
    const s = end === 'e' ? 1 : -1, fx = end === 'e' ? L.x1 : L.x0, zc = (L.z0 + L.z1) / 2;
    const ranges = poi ? [[L.z0, zc - 15], [zc + 15, L.z1]] : [[L.z0, L.z1]];
    for (const [a0, a1] of ranges) {
      let z = a0;
      while (z < a1 - 1) {
        let w = rng.range(9, 14);
        if (a1 - z - w < 7) w = a1 - z;
        this.storefront(fx, s, z, z + w, rng);
        z += w;
      }
    }
    if (poi && poi.id === 'saloon') this.genSaloon(poi, fx, zc, s);
    else if (poi) this.genPOI(poi, fx, zc, s, 30, 16, rng.range(9, 12));
  }

  storefront(fx, s, za, zb, rng) {
    const w = zb - za, zc = (za + zb) / 2, h = rng.pick([7, 10.4, 13.6, 13.6]), c = rng.pick(BRICK);
    this.addBuilding(fx - s * 8, zc, 16, h, w - 0.1, c, WIN_ROW);
    const b = this.chunkB(fx, zc);
    b.box(fx + s * 0.07, CURB + 0.25, zc, 0.14, 2.8, w - 1.4, '#22313d');
    b.box(fx + s * 0.1, CURB, zc + w / 2 - 1.5, 0.12, 2.5, 1.1, '#4a3020');
    b.box(fx + s * 0.85, CURB + 3.1, zc, 1.7, 0.25, w - 0.8, rng.pick(AWNINGS));
    b.box(fx + s * 0.1, CURB + h - 0.2, zc, 0.5, 0.5, w - 0.1, shade(c, 0.6));
    const sw = Math.min(w - 1.6, 4.6);
    this.sign(fx + s * 0.16, s, zc - sw / 2, zc + sw / 2, CURB + 3.5, CURB + 4.6, rng.int(0, SIGNS.length - 1));
    if (rng.chance(0.25)) {
      // A couple of sidewalk cafe tables.
      for (const dz of [-1.8, 1.8]) {
        b.box(fx + s * 1.6, CURB, zc + dz, 0.7, 0.75, 0.7, '#3a3a3a');
        this.colliders.addBox(fx + s * 1.6 - 0.35, zc + dz - 0.35, fx + s * 1.6 + 0.35, zc + dz + 0.35, 0.9);
      }
    }
  }

  sign(fx, s, za, zb, y0, y1, idx) {
    const { cols, rows } = this.atlas;
    const u0 = (idx % cols) / cols, u1 = u0 + 1 / cols;
    const v1 = 1 - Math.floor(idx / cols) / rows, v0 = v1 - 1 / rows;
    const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    if (s > 0) this.signB.quad([fx, y0, zb], [fx, y0, za], [fx, y1, za], [fx, y1, zb], '#ffffff', uv);
    else this.signB.quad([fx, y0, za], [fx, y0, zb], [fx, y1, zb], [fx, y1, za], '#ffffff', uv);
  }

  // A two-story Western saloon with a false front, a balcony over the sidewalk and swinging
  // doors. This is only the outside; the inside is its own scene (saloon.js).
  genSaloon(poi, fx, zc, s) {
    const d = 18, wz = 28, h = 8.2, cx = fx - s * (d / 2), trim = '#4a2e18';
    this.addBuilding(cx, zc, d, h, wz, '#8a5a32', WIN_ROW);
    const b = this.chunkB(cx, zc);
    b.box(fx - s * 0.25, CURB, zc, 0.5, 11.5, wz + 1, '#9a6a3a', WIN_ROW);
    b.box(fx - s * 0.1, CURB + 11.5, zc, 0.9, 0.4, wz + 1.6, trim);
    for (let i = 0; i < 6; i++) b.box(fx + s * 0.02, CURB + 0.2, zc - wz / 2 + 1 + i * 0.12, 0.04, 11, 0.04, trim);
    // Balcony over the sidewalk, held up by posts.
    b.box(fx + s * 1.5, CURB + 3.8, zc, 3, 0.25, wz, trim);
    b.box(fx + s * 2.9, CURB + 4.05, zc, 0.08, 0.9, wz, '#6a4426');
    b.box(fx + s * 2.9, CURB + 4.9, zc, 0.16, 0.1, wz + 0.2, trim);
    for (const dz of [-13, -8.5, -4, 4, 8.5, 13]) {
      const px = fx + s * 2.8, pz = zc + dz;
      b.box(px, CURB, pz, 0.22, 3.8, 0.22, trim);
      this.colliders.addBox(px - 0.11, pz - 0.11, px + 0.11, pz + 0.11, 4);
    }
    // Doorway with swinging half doors.
    b.box(fx + s * 0.06, CURB, zc, 0.12, 2.7, 2.3, '#1a120c');
    for (const dz of [-0.55, 0.55]) b.box(fx + s * 0.16, CURB + 0.55, zc + dz, 0.08, 1.25, 1.0, '#c08a4a');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.8), new THREE.MeshBasicMaterial({ map: textTexture('SALOON', '#5a2e14', '#f4d58a') }));
    sign.position.set(fx + s * 0.12, CURB + 9.4, zc);
    sign.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.scene.add(sign);
    const door = { x: fx + s * 2.2, z: zc };
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.3, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(door.x, CURB + 0.03, door.z);
    this.scene.add(ring);
    const curb = { x: roadX(MAIN_I) - s * (ROAD / 2 - 1.8), z: zc + 18, h: s > 0 ? 0 : Math.PI };
    this.pois[poi.id] = { ...poi, door, curb, cx, cz: zc, facing: s };
  }

  // A landmark building facing Main Street (east or west, s = +1 faces east).
  genPOI(poi, fx, zc, s, wz, d, h, awning = true) {
    const cx = fx - s * (d / 2);
    this.addBuilding(cx, zc, d, h, wz, poi.color, WIN_ROW);
    const b = this.chunkB(cx, zc);
    b.box(fx + s * 0.08, CURB, zc, 0.16, 2.6, 2.4, '#2a2a30');
    if (awning) b.box(fx + s * 1, CURB + 3.2, zc, 2, 0.3, wz - 4, shade(poi.color, 0.7));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: textTexture(poi.name, shade(poi.color, 0.55)) }));
    sign.position.set(fx + s * 0.1, CURB + h - 2.2, zc);
    sign.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.scene.add(sign);
    const door = { x: fx + s * 2.5, z: zc };
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.3, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(door.x, CURB + 0.03, door.z);
    this.scene.add(ring);
    this.signs.push(ring);
    // Where to leave a car at the curb out front.
    const curb = { x: roadX(MAIN_I) - s * (ROAD / 2 - 1.8), z: zc + 10, h: s > 0 ? 0 : Math.PI };
    this.pois[poi.id] = { ...poi, door, curb, cx, cz: zc };
  }

  genPlaza(L, rng) {
    const zc = (L.z0 + L.z1) / 2, fx = L.x0 + 100, poi = POI_DEFS.find((p) => p.id === 'townhall');
    this.genPOI(poi, fx, zc, -1, 50, 30, 13, false);
    const b = this.chunkB(fx, zc);
    for (let i = 0; i < 6; i++) {
      const z = zc - 15 + i * 6;
      b.box(fx - 2, CURB, z, 1.1, 12, 1.1, '#efe9da');
      this.colliders.addBox(fx - 2.55, z - 0.55, fx - 1.45, z + 0.55, 13);
    }
    b.box(fx - 2, CURB + 12, zc, 3, 1, 44, '#d0c8b4');
    b.prism(fx + 15, CURB + 13, zc, 8, 3, 12, '#c9c1ac');
    b.prism(fx + 15, CURB + 16, zc, 5.5, 3.5, 12, '#6f9a8a', '#5f8a7a');
    b.box(fx + 15, CURB + 19.5, zc, 0.3, 4, 0.3, '#444');
    // Plaza with a fountain between Main Street and the hall.
    const px = L.x0 + 48, m = this.markB;
    m.quadH(px, zc - 3, fx, zc + 3, CURB + 0.01, '#bdb6a6');
    m.quadH(px - 3, L.z0, px + 3, L.z1, CURB + 0.01, '#bdb6a6');
    m.quadH(L.x0, zc - 3, px, zc + 3, CURB + 0.01, '#bdb6a6');
    b.prism(px, CURB, zc, 6, 0.8, 16, '#b8b2a4');
    b.prism(px, CURB + 0.6, zc, 5.4, 0.15, 16, '#4f9fd0');
    b.prism(px, CURB, zc, 0.7, 3, 8, '#c8c2b4');
    b.prism(px, CURB + 2.6, zc, 1.8, 0.3, 12, '#b8b2a4', '#4f9fd0');
    this.colliders.addCircle(px, zc, 6.1, 1);
    this.mapCircles.push([px, zc, 6, '#4f9fd0']);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      this.addTree(px + Math.cos(a) * 34, zc + Math.sin(a) * 28, rng, 1.1);
    }
    for (const x of [fx + 52, fx + 88]) this.addBuilding(x, zc, 30, rng.range(40, 70), 50, rng.pick(TOWERS), WIN_TOWER);
    this.plaza = { x: px, z: zc, hall: fx };
  }

  genDowntown(L, rng, bi, bj) {
    const n = 4, pw = (L.x1 - L.x0) / n;
    for (let k = 0; k < n; k++) {
      const px = L.x0 + (k + 0.5) * pw, pz = (L.z0 + L.z1) / 2;
      if (rng.chance(0.1)) {
        for (let i = 0; i < 4; i++) this.addTree(px + rng.range(-18, 18), pz + rng.range(-25, 25), rng);
        continue;
      }
      const w = rng.range(34, pw - 6), d = rng.range(44, 66), h = rng.range(30, 85) * (bj === 0 ? 1.3 : 1);
      const c = rng.pick(TOWERS);
      this.addBuilding(px, pz, w, h, d, c, WIN_TOWER);
      const b = this.chunkB(px, pz);
      if (rng.chance(0.5)) {
        const h2 = h * rng.range(0.25, 0.5);
        b.box(px, CURB + h, pz, w * 0.68, h2, d * 0.68, shade(c, 0.92), WIN_TOWER);
        b.box(px, CURB + h + h2, pz, 2.5, 5, 2.5, '#555');
      } else {
        b.box(px + w * 0.2, CURB + h, pz - d * 0.15, 4, 2, 3, '#8a8d90');
        b.box(px - w * 0.2, CURB + h, pz + d * 0.2, 3, 1.6, 5, '#8a8d90');
      }
    }
    this.streetTrees(blockRect(bi, bj), rng);
  }

  genPlayground(L, rng, bi, bj) {
    const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, m = this.markB, b = this.chunkB(cx, cz);
    // Basketball court
    m.quadH(cx - 45, cz - 14, cx - 17, cz + 14, CURB + 0.01, '#c0704a');
    m.quadH(cx - 31.1, cz - 14, cx - 30.9, cz + 14, CURB + 0.02, '#f0f0f0');
    for (const x of [cx - 44, cx - 18]) b.box(x, CURB, cz, 0.2, 3.2, 0.2, '#444');
    // Play structure
    b.box(cx + 20, CURB, cz, 6, 0.3, 6, '#2f7ac0');
    for (const [dx, dz] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) b.box(cx + 20 + dx, CURB, cz + dz, 0.25, 2.6, 0.25, '#e0c040');
    b.box(cx + 20, CURB + 2.4, cz, 6.2, 0.3, 6.2, '#c94a4a');
    b.box(cx + 26, CURB, cz, 4, 1.4, 1, '#e07a30');
    this.colliders.addBox(cx + 17, cz - 3, cx + 23, cz + 3, 2.7);
    m.quadH(cx + 10, cz - 10, cx + 32, cz + 10, CURB + 0.01, '#8a7a6a');
    this.rect(cx - 45, cz - 14, cx - 17, cz + 14, '#c0704a');
    for (let i = 0; i < 14; i++) {
      const x = rng.range(L.x0 + 3, L.x1 - 3), z = rng.pick([L.z0 + 3, L.z1 - 3]) + rng.range(-1, 1);
      this.addTree(x, z, rng);
    }
    this.parks[bi + ',' + bj] = { x: cx, z: cz };
    this.backyards.push({ x: cx + 60, z: cz, w: 30 });
    this.streetTrees(blockRect(bi, bj), rng);
  }

  // Prospect-style park spanning 2x6 blocks, with no streets through it.
  genBigPark() {
    const r = PARK_RECT, rng = this.rng, g = this.groundB, m = this.markB;
    this.sidewalkRing(r);
    const L = { x0: r.x0 + WALK, x1: r.x1 - WALK, z0: r.z0 + WALK, z1: r.z1 - WALK };
    g.quadH(L.x0, L.z0, L.x1, L.z1, CURB, '#4f8c3a');
    this.rect(L.x0, L.z0, L.x1, L.z1, '#4f8c3a');
    const W = L.x1 - L.x0, D = L.z1 - L.z0, R = Math.min(W, D);
    const lake = { x: L.x0 + W * 0.66, z: L.z0 + D * 0.6, r: R * 0.17 }, pond = { x: L.x0 + W * 0.2, z: L.z0 + D * 0.22, r: R * 0.06 };
    const meadow = { x: L.x0 + W * 0.27, z: L.z0 + D * 0.7, r: R * 0.17 };
    for (const w of [lake, pond]) {
      m.prism(w.x, CURB, w.z, w.r, 0.05, 28, '#3f86b8');
      this.colliders.addCircle(w.x, w.z, w.r - 1, 2);
      this.mapCircles.push([w.x, w.z, w.r, '#3f86b8']);
    }
    // Loop drive and a cross path.
    const path = '#c8b98f', i = 12, pw = 2.5;
    const strips = [
      [L.x0 + i, L.z0 + i, L.x1 - i, L.z0 + i + pw], [L.x0 + i, L.z1 - i - pw, L.x1 - i, L.z1 - i],
      [L.x0 + i, L.z0 + i, L.x0 + i + pw, L.z1 - i], [L.x1 - i - pw, L.z0 + i, L.x1 - i, L.z1 - i],
      [L.x0, (L.z0 + L.z1) / 2 - 1.5, L.x1, (L.z0 + L.z1) / 2 + 1.5],
    ];
    for (const [a, b2, c, d] of strips) {
      m.quadH(a, b2, c, d, CURB + 0.01, path);
      this.rect(a, b2, c, d, path);
    }
    const onPath = (x, z) => strips.some(([a, b2, c, d]) => x > a - 2 && x < c + 2 && z > b2 - 2 && z < d + 2);
    for (let k = 0; k < 160; k++) {
      const x = rng.range(L.x0 + 2, L.x1 - 2), z = rng.range(L.z0 + 2, L.z1 - 2);
      if (onPath(x, z) || [lake, pond].some((w) => Math.hypot(x - w.x, z - w.z) < w.r + 5)) continue;
      if (Math.hypot(x - meadow.x, z - meadow.z) < meadow.r) continue;
      this.addTree(x, z, rng, rng.range(1, 1.4));
    }
    const b = this.chunkB(lake.x, lake.z);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, bx = lake.x + Math.cos(a) * (lake.r + 4), bz = lake.z + Math.sin(a) * (lake.r + 4);
      b.box(bx, CURB, bz, 2, 0.5, 0.6, '#7a5233');
    }
    this.parks.prospect = { x: lake.x - lake.r - 5, z: lake.z, lake };
    this.parks.watch = { x: meadow.x, z: meadow.z };
    for (const [x, z] of [[L.x0 + 20, L.z1 - 18], [L.x1 - 20, L.z0 + 20], [L.x1 - 18, L.z1 - 16]]) {
      this.backyards.push({ x, z, w: 30 });
    }
  }

  genIndustrial(L, rng) {
    const n = 4, pw = (L.x1 - L.x0) / n;
    for (let k = 0; k < n; k++) {
      const px = L.x0 + (k + 0.5) * pw, pz = (L.z0 + L.z1) / 2;
      const w = rng.range(36, pw - 6), d = rng.range(44, 64), h = rng.range(8, 13);
      const c = rng.pick(['#8d9196', '#9a7f66', '#6f7f8f', '#8a8470', '#8a3f2f']);
      this.addBuilding(px, pz, w, h, d, c, WIN_WARE);
      const b = this.chunkB(px, pz);
      b.box(px, CURB + h, pz, w - 2, 1.2, 3, shade(c, 0.85));
      b.box(px, CURB, pz - d / 2 - 0.05, 6, 4.5, 0.1, '#55585c');
    }
    const cols = ['#b5462f', '#2f6db5', '#3f8a4a', '#c9a227'];
    for (let i = 0; i < 4; i++) {
      const x = rng.range(L.x0 + 4, L.x1 - 10), z = rng.pick([L.z0 + 1.6, L.z1 - 1.6]);
      this.addBuilding(x, z, 6, 2.6, 2.4, rng.pick(cols), null);
    }
  }

  addTree(x, z, rng, scale = 1) {
    const s = rng.range(0.8, 1.3) * scale;
    this.trees.push({ x, z, s, pine: rng.chance(0.15), c: rng.int(0, 3) });
    this.colliders.addCircle(x, z, 0.35 * s, 4);
  }

  genRoadMarkings() {
    const m = this.markB, Y = 0.01, yel = '#d8c060', wht = '#e4e4dc', e = ROAD / 2 + 2;
    for (let i = 0; i < NAX; i++) {
      for (let j = 0; j < NSZ; j++) {
        const x = roadX(i), z = roadZ(j);
        if (segExists(i, j, 0, 1)) {
          // Avenues get a double yellow line; Main Street gets it too, plus crosswalks.
          const a = z + e, b = roadZ(j + 1) - e;
          m.quadH(x - 0.3, a, x - 0.12, b, Y, yel);
          m.quadH(x + 0.12, a, x + 0.3, b, Y, yel);
        }
        if (segExists(i, j, 1, 0)) {
          const a = x + e, b = roadX(i + 1) - e;
          for (let t = a; t < b - 3; t += 6) m.quadH(t, z - 0.1, t + 3, z + 0.1, Y, yel);
        }
        if (i === MAIN_I || j <= 1) {
          const o = ROAD / 2 + 1.5;
          for (let s = -ROAD / 2 + 1; s < ROAD / 2 - 0.5; s += 1.4) {
            m.quadH(x + s, z - o - 1.2, x + s + 0.7, z - o + 1.2, Y, wht);
            m.quadH(x + s, z + o - 1.2, x + s + 0.7, z + o + 1.2, Y, wht);
            m.quadH(x - o - 1.2, z + s, x - o + 1.2, z + s + 0.7, Y, wht);
            m.quadH(x + o - 1.2, z + s, x + o + 1.2, z + s + 0.7, Y, wht);
          }
        }
      }
    }
  }

  genLamps() {
    const off = ROAD / 2 + 0.6, e = ROAD / 2;
    for (let i = 0; i < NAX; i++) {
      for (let j = 0; j < NSZ; j++) {
        const x = roadX(i), z = roadZ(j);
        if (segExists(i, j, 0, 1)) {
          let k = 0;
          for (let t = z + e + 12; t < roadZ(j + 1) - e - 5; t += 38, k++) {
            const side = (k + i + j) % 2 ? 1 : -1;
            if (Math.abs(x + side * off) < HALF) this.lamps.push({ x: x + side * off, z: t, rot: side > 0 ? Math.PI : 0 });
          }
        }
        if (segExists(i, j, 1, 0)) {
          let k = 0;
          for (let t = x + e + 17; t < roadX(i + 1) - e - 5; t += 38, k++) {
            const side = (k + i + j) % 2 ? 1 : -1;
            if (Math.abs(z + side * off) < HALF) this.lamps.push({ x: t, z: z + side * off, rot: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
          }
        }
      }
    }
  }

  genBoundary() {
    const rng = this.rng, E = HALF + 18;
    for (let t = -E; t <= E; t += 7) {
      for (const [x, z] of [[t, -E], [t, E], [E, t]]) {
        this.trees.push({ x: x + rng.range(-2, 2), z: z + rng.range(-2, 2), s: rng.range(1.2, 1.8), pine: rng.chance(0.6), c: rng.int(0, 3) });
      }
    }
    // Rolling hills outside the boundary so the edge doesn't look like a cliff (none over the river).
    this.hills = [];
    for (let t = -HALF - 200; t <= HALF + 200; t += 60) {
      for (let side = 0; side < 3; side++) {
        const r = rng.range(40, 90), off = HALF + 30 + r + rng.range(0, 90), h = rng.range(20, 60);
        const along = t + rng.range(-20, 20);
        const [x, z] = [[along, -off], [along, off], [off, along]][side];
        if (x < -HALF) continue;
        this.hills.push({ x, z, r, h });
      }
    }
  }

  // ---------------------------------------------------------------- meshes

  finish() {
    for (const b of this.chunks.values()) {
      const mesh = new THREE.Mesh(b.build(), this.bldMat);
      mesh.castShadow = mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    const ground = new THREE.Mesh(this.groundB.build(), this.groundMat);
    ground.receiveShadow = true;
    this.scene.add(ground);
    const marks = new THREE.Mesh(this.markB.build(), this.markMat);
    marks.receiveShadow = true;
    this.scene.add(marks);
    const signs = new THREE.Mesh(this.signB.build(), new THREE.MeshBasicMaterial({ map: this.atlas.tex }));
    this.scene.add(signs);
    this.groundB = this.markB = this.signB = null;
    this.chunks.clear();

    this.buildTrees();
    this.buildLamps();
    this.buildHills();
    this.mapCanvas = this.buildMap();
  }

  // Split instanced props into large spatial chunks so the camera can frustum-cull them.
  instanced(items, geo, mat, place, cast = true) {
    const groups = new Map(), C = 380;
    for (const it of items) {
      const k = Math.floor((it.x + HALF + 400) / C) * 100 + Math.floor((it.z + HALF + 400) / C);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    for (const list of groups.values()) {
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => {
        dummy.position.set(0, 0, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        const c = place(it, dummy, col);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        if (c) m.setColorAt(i, col);
      });
      m.computeBoundingSphere();
      m.castShadow = cast;
      m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  buildTrees() {
    const greens = ['#3f7a35', '#4e8a3a', '#2f6a3a', '#5a9440'];
    const trunkG = new THREE.CylinderGeometry(0.16, 0.24, 1, 5).translate(0, 0.5, 0);
    const leafG = new THREE.IcosahedronGeometry(1, 0);
    const pineG = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0);
    const white = () => new THREE.MeshLambertMaterial({ color: '#ffffff' });
    this.instanced(this.trees, trunkG, new THREE.MeshLambertMaterial({ color: '#6b4a32' }), (t, d) => {
      d.position.set(t.x, groundHeight(t.x, t.z), t.z);
      d.scale.set(t.s, (t.pine ? 1.6 : 2.4) * t.s, t.s);
    });
    this.instanced(this.trees.filter((t) => !t.pine), leafG, white(), (t, d, col) => {
      d.position.set(t.x, groundHeight(t.x, t.z) + 3.6 * t.s, t.z);
      d.rotation.set(0, t.x * 13.1, 0);
      d.scale.set(2 * t.s, 1.8 * t.s, 2 * t.s);
      return col.set(greens[t.c]);
    });
    this.instanced(this.trees.filter((t) => t.pine), pineG, white(), (t, d, col) => {
      d.position.set(t.x, groundHeight(t.x, t.z) + 1.2 * t.s, t.z);
      d.rotation.set(0, t.z * 7.7, 0);
      d.scale.set(1.7 * t.s, 6 * t.s, 1.7 * t.s);
      return col.set(greens[t.c]).multiplyScalar(0.8);
    });
  }

  buildLamps() {
    const b = new MeshBuilder();
    b.box(0, 0, 0, 0.16, 5.2, 0.16, '#3d4045');
    b.box(0.7, 5, 0, 1.5, 0.12, 0.12, '#3d4045');
    this.instanced(this.lamps, b.build(), new THREE.MeshLambertMaterial({ vertexColors: true }), (l, d) => {
      d.position.set(l.x, CURB, l.z);
      d.rotation.set(0, l.rot, 0);
    });
    this.bulbMat = new THREE.MeshBasicMaterial({ color: '#777' });
    this.instanced(this.lamps, new THREE.BoxGeometry(0.5, 0.18, 0.3), this.bulbMat, (l, d) => {
      d.position.set(l.x + Math.cos(l.rot) * 1.3, CURB + 4.88, l.z - Math.sin(l.rot) * 1.3);
      d.rotation.set(0, l.rot, 0);
    }, false);
  }

  buildHills() {
    const g = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0);
    const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: '#557f45', flatShading: true }), this.hills.length);
    const dummy = new THREE.Object3D();
    this.hills.forEach((h, i) => {
      dummy.position.set(h.x, -2, h.z);
      dummy.scale.set(h.r, h.h, h.r);
      dummy.rotation.y = i;
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.frustumCulled = false;
    this.scene.add(m);
  }

  buildMap() {
    const S = MAP_EXT * 2 * MAP_PX;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    const p = (v) => (v + MAP_EXT) * MAP_PX;
    x.fillStyle = '#3f6a30';
    x.fillRect(0, 0, S, S);
    const E = HALF + ROAD / 2;
    x.fillStyle = '#3d6f8f';
    x.fillRect(0, 0, p(-E - 3), S);
    x.fillStyle = '#2b2c30';
    x.fillRect(p(-E), p(-E), E * 2 * MAP_PX, E * 2 * MAP_PX);
    for (const [x0, z0, x1, z1, col] of this.mapRects) {
      x.fillStyle = col;
      x.fillRect(p(x0), p(z0), Math.max(1, (x1 - x0) * MAP_PX), Math.max(1, (z1 - z0) * MAP_PX));
    }
    for (const [cx, cz, r, col] of this.mapCircles) {
      x.fillStyle = col;
      x.beginPath();
      x.arc(p(cx), p(cz), r * MAP_PX, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = '#2f5a2a';
    for (const t of this.trees) x.fillRect(p(t.x) - 0.5, p(t.z) - 0.5, 1, 1);
    this.mapRects = null;
    return c;
  }

  setNight(n) {
    this.bldMat.emissiveIntensity = n * 0.95;
    this.bulbMat.color.setRGB(0.45 + 0.55 * n, 0.45 + 0.45 * n, 0.45 + 0.2 * n);
  }
}

export function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

