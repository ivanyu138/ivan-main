import * as THREE from 'three';
import { MeshBuilder, makeWindowTextures, textTexture } from './geo.js';
import { RNG, mod } from './util.js';
import { Colliders } from './collision.js';

// Layout: a 19x19 grid of 106m blocks separated by 14m streets.
// 2280m x 2280m ~= 2.0 square miles.
export const HALF = 1140;
export const PITCH = 120;
export const ROAD = 14;
export const WALK = 3;
export const NROADS = 20;
export const NBLOCKS = 19;
export const CURB = 0.15;
export const LANE = 3.4;
export const MAP_PX = 0.5; // minimap pixels per meter
export const MAP_EXT = 1200; // minimap covers -MAP_EXT..MAP_EXT

export const roadPos = (i) => -HALF + i * PITCH;

export function blockRect(bi, bj) {
  return {
    x0: roadPos(bi) + ROAD / 2,
    x1: roadPos(bi + 1) - ROAD / 2,
    z0: roadPos(bj) + ROAD / 2,
    z1: roadPos(bj + 1) - ROAD / 2,
  };
}

export function lotRect(bi, bj) {
  const r = blockRect(bi, bj);
  return { x0: r.x0 + WALK, x1: r.x1 - WALK, z0: r.z0 + WALK, z1: r.z1 - WALK };
}

export function blockIndex(x, z) {
  const bi = Math.floor((x + HALF) / PITCH), bj = Math.floor((z + HALF) / PITCH);
  if (bi < 0 || bj < 0 || bi >= NBLOCKS || bj >= NBLOCKS) return null;
  return [bi, bj];
}

export function onRoad(x, z) {
  if (Math.abs(x) > HALF + ROAD / 2 || Math.abs(z) > HALF + ROAD / 2) return false;
  const lx = mod(x + HALF, PITCH), lz = mod(z + HALF, PITCH);
  return lx <= ROAD / 2 || lx >= PITCH - ROAD / 2 || lz <= ROAD / 2 || lz >= PITCH - ROAD / 2;
}

export function groundHeight(x, z) {
  return blockIndex(x, z) && !onRoad(x, z) ? CURB : 0;
}

const PARKS = new Set(['12,13', '13,13', '5,6', '14,4', '4,15', '16,9']);

export function district(bi, bj) {
  if (PARKS.has(bi + ',' + bj)) return 'park';
  const d = Math.max(Math.abs(bi - 9), Math.abs(bj - 9));
  if (d <= 1) return 'downtown';
  if (d <= 2) return 'commercial';
  if (bj >= 16 && bi >= 11) return 'industrial';
  return 'residential';
}

export const POI_DEFS = [
  { id: 'townhall', name: 'TOWN HALL', block: [9, 9], color: '#d8d0bc' },
  { id: 'diner', name: "LOU'S DINER", block: [8, 7], color: '#c94a4a', shop: 'diner' },
  { id: 'clinic', name: 'ST. MERCY CLINIC', block: [9, 7], color: '#e8eef0', shop: 'clinic' },
  { id: 'mart', name: 'CORNER MART', block: [11, 9], color: '#4a8ac9', shop: 'mart' },
  { id: 'pizza', name: "TONY'S PIZZA", block: [7, 10], color: '#e0a030', shop: 'pizza' },
  { id: 'garage', name: "VIC'S GARAGE", block: [10, 11], color: '#6a6a70', shop: 'garage' },
  { id: 'police', name: 'POLICE', block: [11, 11], color: '#3a4a7a' },
  { id: 'gym', name: 'IRON GYM', block: [7, 8], color: '#7a3a8a', shop: 'gym' },
];

const HOUSE_WALLS = ['#e8dcc4', '#d9c7a3', '#c7d6dc', '#e6c9c1', '#cfd9b8', '#f0eee6', '#bfc4cc', '#e3d39b', '#b8cfe0'];
const ROOFS = ['#7a3b2e', '#5a4636', '#4d5560', '#3e4a5a', '#6b2f2a', '#55503f'];
const TOWERS = ['#9aa4ad', '#b8b2a5', '#7f8c99', '#a7b6c2', '#c4baa8', '#8c9296', '#6e7d8c'];
const SHOPS = ['#c9876a', '#d6b980', '#9ab88d', '#b0a0c8', '#c2c2b4', '#d49a9a', '#8fb0c4', '#c8a070'];
const AWNINGS = ['#b23b3b', '#2f7a4f', '#2f5a9a', '#c48a1e', '#7a3a8a', '#e0e0e0'];
const WIN_HOUSE = { w: 3.2, h: 3 };
const WIN_SHOP = { w: 3.4, h: 3.4 };
const WIN_TOWER = { w: 3, h: 3.5 };
const WIN_WARE = { w: 7, h: 4.5 };
const CH = 190;

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
    this.rng = new RNG(20261029);

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
    g.quadH(-F, -F, F, -E, 0, grass);
    g.quadH(-F, E, F, F, 0, grass);
    g.quadH(-F, -E, -E, E, 0, grass);
    g.quadH(E, -E, F, E, 0, grass);

    for (let bi = 0; bi < NBLOCKS; bi++) {
      for (let bj = 0; bj < NBLOCKS; bj++) this.genBlock(bi, bj);
    }
    this.genRoadMarkings();
    this.genLamps();
    this.genBoundary();
  }

  genBlock(bi, bj) {
    const r = blockRect(bi, bj), L = lotRect(bi, bj);
    const g = this.groundB, d = district(bi, bj), rng = this.rng;
    const W = r.x1 - r.x0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const sw = '#a3a19a';
    g.box(cx, 0, r.z0 + WALK / 2, W, CURB, WALK, sw);
    g.box(cx, 0, r.z1 - WALK / 2, W, CURB, WALK, sw);
    g.box(r.x0 + WALK / 2, 0, cz, WALK, CURB, W - WALK * 2, sw);
    g.box(r.x1 - WALK / 2, 0, cz, WALK, CURB, W - WALK * 2, sw);
    const lotColor = {
      residential: '#5d8a44', park: '#4f8c3a', downtown: '#8e8b85', commercial: '#86837c', industrial: '#7b786f',
    }[d];
    g.quadH(L.x0, L.z0, L.x1, L.z1, CURB, lotColor);
    this.rect(r.x0, r.z0, r.x1, r.z1, '#a3a19a');
    this.rect(L.x0, L.z0, L.x1, L.z1, lotColor);

    const poi = POI_DEFS.find((p) => p.block[0] === bi && p.block[1] === bj);
    if (poi && poi.id === 'townhall') return this.genTownHall(L, poi);
    if (d === 'residential') this.genResidential(L, rng);
    else if (d === 'downtown') this.genDowntown(L, rng, bi, bj);
    else if (d === 'commercial') this.genCommercial(L, rng, poi);
    else if (d === 'park') this.genPark(L, rng, bi, bj);
    else this.genIndustrial(L, rng);
  }

  addBuilding(cx, cz, w, h, d, color, win, y0 = CURB) {
    this.chunkB(cx, cz).box(cx, y0, cz, w, h, d, color, win);
    this.colliders.addBox(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, y0 + h);
    this.rect(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, shade(color, 0.72));
  }

  house(x0, z0, x1, z1, front, set, rng) {
    const b = this.chunkB((x0 + x1) / 2, (z0 + z1) / 2);
    const floors = rng.chance(0.35) ? 2 : 1;
    const h = floors * 3 + 0.2;
    const wall = rng.pick(HOUSE_WALLS), roof = rng.pick(ROOFS);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    b.box(cx, CURB, cz, w, h, d, wall, WIN_HOUSE);
    const rh = rng.range(2, 3);
    b.gable(x0, z0, x1, z1, CURB + h, rh, roof, wall, front === 'n' || front === 's');
    if (rng.chance(0.3)) b.box(x0 + w * 0.25, CURB + h, cz, 0.8, rh + 0.6, 0.8, '#7a5a4a');
    this.colliders.addBox(x0, z0, x1, z1, CURB + h + rh);
    this.rect(x0, z0, x1, z1, shade(roof, 1.1));

    const door = '#5b3a29', path = '#b9b3a6';
    const m = this.markB;
    let dp;
    if (front === 'n') {
      b.box(cx, CURB, z0 - 0.06, 1.1, 2.1, 0.12, door);
      m.quadH(cx - 0.7, z0 - set, cx + 0.7, z0, CURB + 0.01, path);
      dp = { x: cx, z: z0 - 1.6 };
    } else if (front === 's') {
      b.box(cx, CURB, z1 + 0.06, 1.1, 2.1, 0.12, door);
      m.quadH(cx - 0.7, z1, cx + 0.7, z1 + set, CURB + 0.01, path);
      dp = { x: cx, z: z1 + 1.6 };
    } else if (front === 'w') {
      b.box(x0 - 0.06, CURB, cz, 0.12, 2.1, 1.1, door);
      m.quadH(x0 - set, cz - 0.7, x0, cz + 0.7, CURB + 0.01, path);
      dp = { x: x0 - 1.6, z: cz };
    } else {
      b.box(x1 + 0.06, CURB, cz, 0.12, 2.1, 1.1, door);
      m.quadH(x1, cz - 0.7, x1 + set, cz + 0.7, CURB + 0.01, path);
      dp = { x: x1 + 1.6, z: cz };
    }
    this.houseDoors.push(dp);
  }

  genResidential(L, rng) {
    for (let k = 0; k < 5; k++) {
      const fx0 = L.x0 + k * 20;
      for (const side of ['n', 's']) {
        const w = rng.range(10, 14), dp = rng.range(9, 12), set = rng.range(5, 8);
        const cx = fx0 + 10 + rng.range(-1.5, 1.5);
        if (side === 'n') this.house(cx - w / 2, L.z0 + set, cx + w / 2, L.z0 + set + dp, 'n', set, rng);
        else this.house(cx - w / 2, L.z1 - set - dp, cx + w / 2, L.z1 - set, 's', set, rng);
        if (rng.chance(0.55)) this.addTree(fx0 + 1.6, side === 'n' ? L.z0 + 1.8 : L.z1 - 1.8, rng);
      }
    }
    for (let k = 0; k < 2; k++) {
      const cz = L.z0 + 34 + k * 16 + 8;
      for (const side of ['w', 'e']) {
        const w = rng.range(10, 13), dp = rng.range(9, 11), set = rng.range(5, 8);
        if (side === 'w') this.house(L.x0 + set, cz - w / 2, L.x0 + set + dp, cz + w / 2, 'w', set, rng);
        else this.house(L.x1 - set - dp, cz - w / 2, L.x1 - set, cz + w / 2, 'e', set, rng);
      }
    }
    // Shared backyard space in the middle of the block.
    const bx0 = L.x0 + 23, bx1 = L.x1 - 23, bz0 = L.z0 + 23, bz1 = L.z1 - 23;
    const n = rng.int(4, 8);
    for (let i = 0; i < n; i++) this.addTree(rng.range(bx0, bx1), rng.range(bz0, bz1), rng);
    if (rng.chance(0.3)) {
      const px = rng.range(bx0 + 6, bx1 - 6), pz = rng.range(bz0 + 6, bz1 - 6);
      this.markB.box(px, CURB, pz, 7, 0.08, 11, '#d8d4c8');
      this.markB.quadH(px - 3, pz - 5, px + 3, pz + 5, CURB + 0.1, '#4fb8e0');
      this.rect(px - 3, pz - 5, px + 3, pz + 5, '#4fb8e0');
    }
    this.backyards.push({ x: (bx0 + bx1) / 2, z: (bz0 + bz1) / 2, w: bx1 - bx0 });
  }

  genDowntown(L, rng, bi, bj) {
    const central = Math.abs(bi - 9) + Math.abs(bj - 9) <= 1;
    for (let pi = 0; pi < 2; pi++) {
      for (let pj = 0; pj < 2; pj++) {
        const px = L.x0 + pi * 50 + 25, pz = L.z0 + pj * 50 + 25;
        if (rng.chance(0.12)) {
          for (let i = 0; i < 4; i++) this.addTree(px + rng.range(-18, 18), pz + rng.range(-18, 18), rng);
          continue;
        }
        const w = rng.range(30, 44), d = rng.range(30, 44);
        const h = rng.range(18, 42) * (central ? 1.6 : 1);
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
    }
  }

  shopRow(a0, a1, f0, f1, front, rng) {
    // a = along-street axis range, f = depth range; front = which face is the storefront.
    const alongX = front === 'n' || front === 's';
    let cur = a0;
    while (cur < a1 - 1) {
      let w = rng.range(12, 22);
      if (a1 - cur - w < 9) w = a1 - cur;
      const h = rng.range(5, 11), c = rng.pick(SHOPS), aw = rng.pick(AWNINGS);
      const mid = cur + w / 2, depth = f1 - f0, fm = (f0 + f1) / 2;
      const b = alongX ? this.chunkB(mid, fm) : this.chunkB(fm, mid);
      if (alongX) {
        this.addBuilding(mid, fm, w - 0.4, h, depth, c, WIN_SHOP);
        const fz = front === 'n' ? f0 - 0.8 : f1 + 0.8;
        b.box(mid, CURB + 2.8, fz, w - 2, 0.25, 1.6, aw);
      } else {
        this.addBuilding(fm, mid, depth, h, w - 0.4, c, WIN_SHOP);
        const fx = front === 'w' ? f0 - 0.8 : f1 + 0.8;
        b.box(fx, CURB + 2.8, mid, 1.6, 0.25, w - 2, aw);
      }
      cur += w;
    }
  }

  genCommercial(L, rng, poi) {
    const D = 14;
    if (!poi) this.shopRow(L.x0, L.x1, L.z0, L.z0 + D, 'n', rng);
    else {
      this.shopRow(L.x0, L.x0 + 30, L.z0, L.z0 + D, 'n', rng);
      this.shopRow(L.x1 - 30, L.x1, L.z0, L.z0 + D, 'n', rng);
      this.genPOI(poi, (L.x0 + L.x1) / 2, L.z0 + 6, 34, 18, rng.range(8, 11));
    }
    this.shopRow(L.x0, L.x1, L.z1 - D, L.z1, 's', rng);
    this.shopRow(L.z0 + D, L.z1 - D, L.x0, L.x0 + D, 'w', rng);
    this.shopRow(L.z0 + D, L.z1 - D, L.x1 - D, L.x1, 'e', rng);
    const pz0 = poi ? L.z0 + 27 : L.z0 + 18;
    const m = this.markB;
    m.quadH(L.x0 + 18, pz0, L.x1 - 18, L.z1 - 18, CURB + 0.01, '#55575c');
    for (let x = L.x0 + 21; x < L.x1 - 20; x += 3) {
      m.quadH(x, pz0 + 1, x + 0.12, pz0 + 6, CURB + 0.02, '#e8e8e0');
      m.quadH(x, L.z1 - 24, x + 0.12, L.z1 - 19, CURB + 0.02, '#e8e8e0');
    }
    this.rect(L.x0 + 18, pz0, L.x1 - 18, L.z1 - 18, '#66686c');
  }

  genPOI(poi, cx, zf, w, d, h, awning = true) {
    // Building spans z zf..zf+d with its entrance facing north (toward -z).
    const b = this.chunkB(cx, zf + d / 2);
    this.addBuilding(cx, zf + d / 2, w, h, d, poi.color, WIN_SHOP);
    b.box(cx, CURB, zf - 0.08, 2.4, 2.6, 0.16, '#2a2a30');
    if (awning) b.box(cx, CURB + 3.2, zf - 1, w - 4, 0.3, 2, shade(poi.color, 0.7));
    const tex = textTexture(poi.name, shade(poi.color, 0.55));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(cx, CURB + h - 2.2, zf - 0.1);
    sign.rotation.y = Math.PI;
    this.scene.add(sign);
    const door = { x: cx, z: zf - 2.5 };
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.3, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(door.x, CURB + 0.03, door.z);
    this.scene.add(ring);
    this.signs.push(ring);
    this.pois[poi.id] = { ...poi, door, cx, cz: zf + d / 2 };
  }

  genTownHall(L, poi) {
    const cx = (L.x0 + L.x1) / 2, zf = L.z1 - 30, d = 22, w = 44, h = 12;
    this.genPOI(poi, cx, zf, w, d, h, false);
    const b = this.chunkB(cx, zf);
    for (let i = 0; i < 6; i++) {
      const x = cx - 15 + i * 6;
      b.box(x, CURB, zf - 2, 1.1, h - 1, 1.1, '#efe9da');
      this.colliders.addBox(x - 0.55, zf - 2.55, x + 0.55, zf - 1.45, h);
    }
    b.box(cx, CURB + h - 1, zf - 2, w - 6, 1, 3, '#d0c8b4');
    b.prism(cx, CURB + h, zf + d / 2, 7, 3, 12, '#c9c1ac');
    b.prism(cx, CURB + h + 3, zf + d / 2, 5, 3, 12, '#6f9a8a', '#5f8a7a');
    b.box(cx, CURB + h + 6, zf + d / 2, 0.3, 4, 0.3, '#444');
    // Plaza with a fountain.
    const fz = L.z0 + 38, m = this.markB;
    m.quadH(cx - 3, fz, cx + 3, zf, CURB + 0.01, '#bdb6a6');
    m.quadH(L.x0, fz - 3, L.x1, fz + 3, CURB + 0.01, '#bdb6a6');
    b.prism(cx, CURB, fz, 6, 0.8, 16, '#b8b2a4');
    b.prism(cx, CURB + 0.6, fz, 5.4, 0.15, 16, '#4f9fd0');
    b.prism(cx, CURB, fz, 0.7, 3, 8, '#c8c2b4');
    b.prism(cx, CURB + 2.6, fz, 1.8, 0.3, 12, '#b8b2a4', '#4f9fd0');
    this.colliders.addCircle(cx, fz, 6.1, 1);
    this.mapCircles.push([cx, fz, 6, '#4f9fd0']);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.addTree(cx + Math.cos(a) * 30, fz + Math.sin(a) * 26, this.rng, 1.1);
    }
    this.plaza = { x: cx, z: fz };
  }

  genPark(L, rng, bi, bj) {
    const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, m = this.markB;
    m.quadH(L.x0, cz - 1.5, L.x1, cz + 1.5, CURB + 0.01, '#c8b98f');
    m.quadH(cx - 1.5, L.z0, cx + 1.5, L.z1, CURB + 0.01, '#c8b98f');
    this.rect(L.x0, cz - 1.5, L.x1, cz + 1.5, '#c8b98f');
    this.rect(cx - 1.5, L.z0, cx + 1.5, L.z1, '#c8b98f');
    const qx = cx + (rng.chance(0.5) ? -25 : 25), qz = cz + (rng.chance(0.5) ? -25 : 25);
    const pr = rng.range(10, 15);
    m.prism(qx, CURB, qz, pr, 0.05, 20, '#3f86b8');
    this.colliders.addCircle(qx, qz, pr - 1, 2);
    this.mapCircles.push([qx, qz, pr, '#3f86b8']);
    for (let i = 0; i < 40; i++) {
      const x = rng.range(L.x0 + 2, L.x1 - 2), z = rng.range(L.z0 + 2, L.z1 - 2);
      if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4 || Math.hypot(x - qx, z - qz) < pr + 3) continue;
      this.addTree(x, z, rng);
    }
    const b = this.chunkB(cx, cz);
    for (const [bx, bz] of [[cx - 12, cz + 2.6], [cx + 12, cz - 2.6], [cx + 2.6, cz + 14]]) {
      b.box(bx, CURB, bz, 2, 0.5, 0.6, '#7a5233');
      this.colliders.addBox(bx - 1, bz - 0.3, bx + 1, bz + 0.3, 0.6);
    }
    this.parks[bi + ',' + bj] = { x: cx, z: cz, pond: { x: qx, z: qz, r: pr } };
    this.backyards.push({ x: cx + (qx < cx ? 25 : -25), z: cz + (qz < cz ? 25 : -25), w: 30 });
  }

  genIndustrial(L, rng) {
    for (let pi = 0; pi < 2; pi++) {
      for (let pj = 0; pj < 2; pj++) {
        const px = L.x0 + pi * 50 + 25, pz = L.z0 + pj * 50 + 25;
        const w = rng.range(34, 42), d = rng.range(28, 38), h = rng.range(8, 12);
        const c = rng.pick(['#8d9196', '#9a7f66', '#6f7f8f', '#8a8470']);
        this.addBuilding(px, pz, w, h, d, c, WIN_WARE);
        const b = this.chunkB(px, pz);
        b.box(px, CURB + h, pz, w - 2, 1.2, 3, shade(c, 0.85));
        b.box(px - w / 2 - 0.05, CURB, pz, 0.1, 4.5, 6, '#55585c');
      }
    }
    const cols = ['#b5462f', '#2f6db5', '#3f8a4a', '#c9a227'];
    for (let i = 0; i < 3; i++) {
      const x = rng.range(L.x0 + 4, L.x1 - 10), z = rng.pick([L.z0 + 1.6, L.z1 - 1.6]);
      if (Math.abs(x - (L.x0 + L.x1) / 2) < 8) continue;
      this.addBuilding(x, z, 6, 2.6, 2.4, rng.pick(cols), null);
    }
  }

  addTree(x, z, rng, scale = 1) {
    const s = rng.range(0.8, 1.3) * scale;
    this.trees.push({ x, z, s, pine: rng.chance(0.25), c: rng.int(0, 3) });
    this.colliders.addCircle(x, z, 0.35 * s, 4);
  }

  genRoadMarkings() {
    const m = this.markB, Y = 0.01, yel = '#d8c060', wht = '#e4e4dc';
    for (let i = 0; i < NROADS; i++) {
      const c = roadPos(i);
      for (let j = 0; j < NBLOCKS; j++) {
        const a = roadPos(j) + ROAD / 2 + 2, b = roadPos(j + 1) - ROAD / 2 - 2;
        for (let t = a; t < b - 3; t += 6) {
          m.quadH(c - 0.1, t, c + 0.1, t + 3, Y, yel);
          m.quadH(t, c - 0.1, t + 3, c + 0.1, Y, yel);
        }
      }
    }
    // Crosswalks downtown.
    for (let i = 7; i <= 12; i++) {
      for (let j = 7; j <= 12; j++) {
        const x = roadPos(i), z = roadPos(j), o = ROAD / 2 + 1.5;
        for (let s = -ROAD / 2 + 1; s < ROAD / 2 - 0.5; s += 1.4) {
          m.quadH(x + s, z - o - 1.2, x + s + 0.7, z - o + 1.2, Y, wht);
          m.quadH(x + s, z + o - 1.2, x + s + 0.7, z + o + 1.2, Y, wht);
          m.quadH(x - o - 1.2, z + s, x - o + 1.2, z + s + 0.7, Y, wht);
          m.quadH(x + o - 1.2, z + s, x + o + 1.2, z + s + 0.7, Y, wht);
        }
      }
    }
  }

  genLamps() {
    const off = ROAD / 2 + 0.6;
    for (let i = 0; i < NROADS; i++) {
      const c = roadPos(i);
      for (let j = 0; j < NBLOCKS; j++) {
        [18, 53, 88].forEach((t, k) => {
          const along = roadPos(j) + ROAD / 2 + t;
          const side = (k + i + j) % 2 ? 1 : -1;
          if (Math.abs(c + side * off) < HALF) this.lamps.push({ x: c + side * off, z: along, rot: side > 0 ? Math.PI : 0 });
          const side2 = (k + i + j + 1) % 2 ? 1 : -1;
          if (Math.abs(c + side2 * off) < HALF)
            this.lamps.push({ x: along, z: c + side2 * off, rot: side2 > 0 ? Math.PI / 2 : -Math.PI / 2 });
        });
      }
    }
  }

  genBoundary() {
    const rng = this.rng, E = HALF + 18;
    for (let t = -E; t <= E; t += 7) {
      for (const [x, z] of [[t, -E], [t, E], [-E, t], [E, t]]) {
        this.trees.push({ x: x + rng.range(-2, 2), z: z + rng.range(-2, 2), s: rng.range(1.2, 1.8), pine: rng.chance(0.6), c: rng.int(0, 3) });
      }
    }
    // Rolling hills outside the boundary so the world edge doesn't look like a cliff.
    this.hills = [];
    for (let t = -HALF - 200; t <= HALF + 200; t += 60) {
      for (let side = 0; side < 4; side++) {
        const r = rng.range(40, 90), off = HALF + 30 + r + rng.range(0, 90), h = rng.range(20, 60);
        const along = t + rng.range(-20, 20);
        const [x, z] = [[along, -off], [along, off], [-off, along], [off, along]][side];
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
    this.groundB = this.markB = null;
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

export const nodePos = (i, j) => ({ x: roadPos(i), z: roadPos(j) });
