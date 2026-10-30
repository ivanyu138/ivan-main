import * as THREE from 'three';
import { MeshBuilder, textTexture } from './geo.js';
import { SmoothBuilder } from './smooth.js';
import { Colliders } from './collision.js';
import { makeHumanoid, animateHumanoid } from './characters.js';
import { litterMesh, KINDS } from './litter.js';
import { RNG, angDiff } from './util.js';

// The Golden Spur: a two-story saloon you can walk into. It lives in its own scene;
// coordinates here are local to the building (door at +z, bar at the back, -z).
const W = 8; // half width (x)
const D = 11; // half depth (z)
const F2 = 3.8; // upstairs floor height
const TOP = 7.6; // ceiling of the upper floor
const STAIR = { x0: 5.4, x1: 7.9, zTop: -2, zBot: 8 };
const ITEM_SIZE = 1.3;
const REFILL_AFTER = 120; // seconds before a taken item reappears
const SAFE_REFILL = 600; // seconds before the safe has money again

const flatMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const roundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });
const glowMat = new THREE.MeshBasicMaterial({ color: '#ffd27a' });

const PEOPLE = [
  {
    id: 'hank', name: 'Hank the Bartender', at: [-2, -9.5, 0], facing: 0, pose: 'stand', shop: 'saloon',
    look: { skin: '#e0ac85', hair: '#4a3020', shirt: '#f0ece0', pants: '#2a2a2a', hat: '#2a2a2a' },
    lines: ["What'll it be, partner? We've got milk for the little ones.", 'Never seen a cat walk in on its own before. First time for everything.'],
  },
  {
    id: 'ruby', name: 'Ragtime Ruby', at: [-6.5, 6, 0], facing: -Math.PI / 2, pose: 'sit', piano: true,
    look: { skin: '#c68b5e', hair: '#1a1a1a', shirt: '#a02a4a', pants: '#2a1a2a' },
    lines: ['You like music, kitty? Here, this one goes out to you.', "I've been playing this piano since before the bridge was built."],
  },
  {
    id: 'dusty', name: 'Dusty', at: [3.1, 2.5, 0], facing: -Math.PI / 2, pose: 'sit',
    look: { skin: '#f1c9a5', hair: '#d8b060', shirt: '#6a5a3a', pants: '#3a4a6a', hat: '#8a6a3a' },
    lines: ["Full house! ...Don't tell Jeb, he thinks I'm bluffing.", 'Cats are good luck at the card table. Stick around.'],
  },
  {
    id: 'jeb', name: 'Jeb', at: [1.3, 2.5, 0], facing: Math.PI / 2, pose: 'sit',
    look: { skin: '#8d5a3b', hair: '#2a1d14', shirt: '#3a6a5a', pants: '#2a2a2a', hat: '#3a2a1a' },
    lines: ['Dusty is bluffing. Dusty is always bluffing.', 'Lost my lucky horseshoe somewhere in here. If you find it, it is yours.'],
  },
  {
    id: 'drifter', name: 'A Weary Drifter', at: [-4.5, -1.05, 0], facing: Math.PI, pose: 'sit',
    look: { skin: '#e0ac85', hair: '#9a9a9a', shirt: '#7a3a2a', pants: '#4a3a2a', hat: '#5a4a3a' },
    lines: ['Rode in from the east. Rooms upstairs are cheap, the beds are lumpy.', "Miss Lottie keeps her money in a safe in her suite. Don't get any ideas."],
  },
  {
    id: 'lottie', name: 'Miss Lottie', at: [-3.5, -9.6, F2], facing: Math.PI, pose: 'sit', owner: true,
    look: { skin: '#f3d7c0', hair: '#a33a22', shirt: '#4a2a6a', pants: '#2a1a2a' },
    lines: ['This is my saloon and this is my suite. Mind your paws.', "The Golden Spur has stood on this street for a hundred years. I'll not have it robbed by a cat."],
  },
  {
    id: 'sleeper', name: 'Sleeping Traveler', at: [-5.6, 10.2, F2 + 0.55], facing: 0, pose: 'lie',
    look: { skin: '#e0ac85', hair: '#2a1d14', shirt: '#e8e0d0', pants: '#5a4a3a' },
    lines: ['Zzz... five more minutes... zzz', '*snore* ...not the cattle... *snore*'],
  },
  {
    id: 'traveler', name: 'Tired Traveler', at: [-0.4, 9.3, F2], facing: Math.PI, pose: 'sit', seat: 0.5,
    look: { skin: '#c68b5e', hair: '#4a3020', shirt: '#2f5a8a', pants: '#3a3a3a', hat: '#6a5a3a' },
    lines: ['Long ride tomorrow. A cat for company is nice, though.', "If you're looking for treasure, check the storeroom down the hall."],
  },
];

// Where carryable things sit. y is the surface they rest on.
const SLOTS = [
  ['mug', -4.2, 1.16, -8.2], ['mug', 0.2, 1.16, -8.3], ['bottle', -1.4, 1.16, -8.15],
  ['cards', 2.1, 0.79, 2.3], ['pokerchips', 2.4, 0.79, 2.85], ['hat', -4.4, 0.79, -2.2],
  ['candle', -4, 0.79, 3.5], ['harmonica', -7.3, 1.32, 6.3], ['horseshoe', 4.6, 0, 9.4], ['rope', 6.4, 0, -9.6],
  ['pouch', -1.6, F2, 6], ['badge', 4, F2, 9.2], ['hat', -6.6, F2, 2], ['ledger', -2.8, F2 + 0.78, -10.25],
  ['candle', -6.9, F2 + 0.6, -5], ['bottle', 3.6, F2, -9.3], ['mug', 5.4, F2, -7.2], ['pouch', 6.6, F2, -10],
];

function wantedTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 80;
  const x = c.getContext('2d');
  x.fillStyle = '#e8d8b0';
  x.fillRect(0, 0, 64, 80);
  x.fillStyle = '#3a2a1a';
  x.font = 'bold 13px "Courier New", monospace';
  x.textAlign = 'center';
  x.fillText('WANTED', 32, 15);
  x.fillStyle = '#8a7050';
  x.fillRect(16, 22, 32, 32);
  x.fillStyle = '#3a2a1a';
  x.font = 'bold 9px "Courier New", monospace';
  x.fillText('$500', 32, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Saloon {
  constructor(game) {
    this.game = game;
    this.rng = new RNG(1849);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a120c');
    this.colliders = new Colliders(4);
    this.items = [];
    this.slotTaken = SLOTS.map(() => -1e9);
    this.safe = { x: -7.3, z: -6.5, progress: 0, emptyUntil: -1, locked: false };
    this.build();
    this.buildPeople();
    this.env = {
      colliders: this.colliders,
      abs: true,
      ground: (x, z, y) => this.groundAt(x, z, y),
    };
  }

  // ------------------------------------------------------------ floors

  // Highest floor surface under (x, z) that the cat can be standing on at height y.
  groundAt(x, z, y) {
    let best = 0;
    const upper = (x < STAIR.x0 || z < STAIR.zTop || z > STAIR.zBot) && Math.abs(x) <= W && Math.abs(z) <= D;
    if (upper && F2 <= y + 0.45) best = F2;
    if (x >= STAIR.x0 && x <= STAIR.x1 && z >= STAIR.zTop && z <= STAIR.zBot) {
      const h = (F2 * (STAIR.zBot - z)) / (STAIR.zBot - STAIR.zTop);
      if (h <= y + 0.6) best = Math.max(best, h);
    }
    return best;
  }

  floorName(y) {
    return y > F2 - 0.5 ? 'Upstairs' : 'Ground floor';
  }

  // ------------------------------------------------------------ building

  wall(b, x0, z0, x1, z1, y0, h, color, collide = true) {
    b.box((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, h, z1 - z0, color);
    if (collide) this.colliders.addBox(x0, z0, x1, z1, y0 + h - 0.3, y0 > 0.1 ? y0 - 0.5 : -Infinity);
  }

  build() {
    const s = this.scene, b = new MeshBuilder(), r = new SmoothBuilder();
    const paper1 = '#7a2e2a', paper2 = '#4e5e44', wains = '#4a2e18', trim = '#3a2416';
    const planks = ['#7a4e2c', '#6e4526', '#83552f'];

    // Floors: ground floor planks, and the upstairs floor with a hole for the stairwell.
    for (let x = -W, k = 0; x < W; x += 0.5, k++) b.box(x + 0.25, -0.1, 0, 0.49, 0.1, D * 2, planks[k % 3]);
    const slab = (x0, z0, x1, z1) => {
      for (let x = x0, k = 0; x < x1 - 0.01; x += 0.5, k++) {
        const w = Math.min(0.5, x1 - x);
        b.box(x + w / 2, F2 - 0.22, (z0 + z1) / 2, w, 0.22, z1 - z0, planks[k % 3]);
      }
      this.colliders.addBox(x0, z0, x1, z1, F2 + 0.15, F2 - 0.3);
    };
    slab(-W, -D, STAIR.x0, D);
    slab(STAIR.x0, -D, W, STAIR.zTop);
    slab(STAIR.x0, STAIR.zBot, W, D);
    b.box(0, TOP, 0, W * 2 + 0.4, 0.25, D * 2 + 0.4, '#3a2616');
    this.colliders.addBox(-W, -D, W, D, TOP + 5, TOP - 0.2);

    // Outer walls, both floors, with wainscoting and a chair rail on the inside.
    for (const [y0, h, paper] of [[0, F2, paper1], [F2, TOP - F2, paper2]]) {
      this.wall(b, -W - 0.2, -D - 0.2, W + 0.2, -D, y0, h, paper);
      this.wall(b, -W - 0.2, -D, -W, D, y0, h, paper);
      this.wall(b, W, -D, W + 0.2, D, y0, h, paper);
      this.wall(b, -W - 0.2, D, -1.3, D + 0.2, y0, h, paper);
      this.wall(b, 1.3, D, W + 0.2, D + 0.2, y0, h, paper);
      b.box(0, y0 + 1.15, -D + 0.03, W * 2, 0.08, 0.06, trim);
      b.box(-W + 0.03, y0 + 1.15, 0, 0.06, 0.08, D * 2, trim);
      b.box(W - 0.03, y0 + 1.15, 0, 0.06, 0.08, D * 2, trim);
      b.box(0, y0, -D + 0.02, W * 2, 1.1, 0.04, wains);
      b.box(-W + 0.02, y0, 0, 0.04, 1.1, D * 2, wains);
      b.box(W - 0.02, y0, 0, 0.04, 1.1, D * 2, wains);
    }
    b.box(0, 2.7, D + 0.1, 2.6, F2 - 2.7, 0.2, paper1);
    b.box(0, F2, D + 0.1, 2.6, TOP - F2, 0.2, paper2);
    // The way out: the cat leaves by the door (with T), not by walking through it.
    this.colliders.addBox(-1.3, D + 0.15, 1.3, D + 0.4, 3);
    // Swinging doors
    for (const dx of [-0.6, 0.6]) b.box(dx, 0.6, D - 0.02, 1.1, 1.25, 0.06, '#c08a4a');
    // Night-time windows
    for (const y of [1.3, F2 + 1.3]) {
      for (const x of [-5.5, 4.6]) {
        b.box(x, y, D - 0.03, 1.8, 1.5, 0.04, '#1e2c40');
        b.box(x, y + 0.72, D - 0.05, 1.9, 0.08, 0.06, trim);
        b.box(x, y, D - 0.05, 0.06, 1.5, 0.06, trim);
      }
    }

    // ---- Ground floor
    // Bar with a brass foot rail, shelves of bottles and a mirror behind.
    b.box(-2, 0, -8.2, 8, 1.08, 0.9, '#5a3218');
    b.box(-2, 1.08, -8.2, 8.3, 0.08, 1.15, '#8a5a32');
    r.cylinder([-2, 0.18, -7.68], 0.03, 0.03, 8, '#c8a040', [0, 0, Math.PI / 2], 8);
    this.colliders.addBox(-6.15, -8.8, 2.15, -7.6, 1.3);
    b.box(-2, 1.25, -D + 0.08, 7, 1.6, 0.04, '#8aa0b0');
    for (const y of [1.2, 1.75, 2.3]) {
      b.box(-2, y, -10.65, 8, 0.05, 0.6, '#5a3218');
      for (let x = -5.6; x < 1.6; x += 0.42) {
        const col = this.rng.pick(['#2a6a3a', '#6a3a1a', '#3a2a5a', '#8a7a3a', '#2a4a6a']);
        r.cylinder([x + this.rng.range(-0.05, 0.05), y + 0.16, -10.6], 0.06, 0.06, 0.28, col, [0, 0, 0], 8);
        r.cylinder([x, y + 0.36, -10.6], 0.022, 0.03, 0.12, col, [0, 0, 0], 6);
      }
    }
    for (let x = -5.4; x < 1.8; x += 1.4) {
      r.cylinder([x, 0.72, -7.25], 0.22, 0.22, 0.08, '#6a3a1a', [0, 0, 0], 12);
      r.cylinder([x, 0.36, -7.25], 0.04, 0.05, 0.72, '#3a2416', [0, 0, 0], 6);
    }
    // Round tables with chairs.
    const table = (x, z, y0 = 0) => {
      r.cylinder([x, y0 + 0.74, z], 0.75, 0.75, 0.06, '#7a4a28', [0, 0, 0], 20);
      r.cylinder([x, y0 + 0.37, z], 0.08, 0.2, 0.74, '#4a2e18', [0, 0, 0], 8);
      this.colliders.addCircle(x, z, 0.78, y0 + 0.9);
    };
    const chair = (x, z, facing, y0 = 0) => {
      const fx = Math.sin(facing), fz = Math.cos(facing);
      r.rbox([x, y0 + 0.45, z], [0.48, 0.06, 0.48], 0.02, '#6a3a1a', [0, facing, 0]);
      r.rbox([x - fx * 0.22, y0 + 0.78, z - fz * 0.22], [0.48, 0.6, 0.05], 0.02, '#6a3a1a', [0, facing, 0]);
      for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) r.cylinder([x + dx, y0 + 0.22, z + dz], 0.025, 0.025, 0.44, '#4a2e18', [0, 0, 0], 5);
    };
    table(-4.5, -2);
    chair(-4.5, -1.05, Math.PI);
    chair(-4.5, -2.95, 0);
    table(-4, 3.5);
    chair(-3.05, 3.5, -Math.PI / 2);
    table(2.2, 2.5);
    chair(3.1, 2.5, -Math.PI / 2);
    chair(1.3, 2.5, Math.PI / 2);
    chair(2.2, 3.45, Math.PI);
    table(-1, 7.2);
    chair(-1, 6.25, 0);
    // Upright piano against the west wall, with a stool.
    r.rbox([-7.45, 0.68, 6], [0.6, 1.36, 1.7], 0.05, '#2a1a10');
    b.box(-7.08, 0.74, 6, 0.32, 0.05, 1.5, '#f4f0e6');
    for (let z = 5.35; z < 6.7; z += 0.13) b.box(-7.12, 0.79, z, 0.18, 0.04, 0.05, '#111111');
    r.cylinder([-6.55, 0.25, 6], 0.25, 0.25, 0.5, '#4a2e18', [0, 0, 0], 12);
    this.colliders.addBox(-W, 5.1, -7.1, 6.9, 1.5);
    // Staircase up the east wall, with a low side wall.
    const steps = 13, run = (STAIR.zBot - STAIR.zTop) / steps;
    for (let k = 0; k < steps; k++) {
      const zc = STAIR.zBot - (k + 0.5) * run;
      b.box((STAIR.x0 + STAIR.x1) / 2 + 0.05, 0, zc, STAIR.x1 - STAIR.x0 + 0.1, ((k + 1) * F2) / steps, run, planks[k % 3]);
    }
    b.box(STAIR.x0 - 0.1, 0, (STAIR.zTop + STAIR.zBot) / 2, 0.2, 1.0, STAIR.zBot - STAIR.zTop, trim);
    this.colliders.addBox(STAIR.x0 - 0.2, STAIR.zTop, STAIR.x0, STAIR.zBot, 1.0);
    this.colliders.addBox(STAIR.x0, STAIR.zTop, W, 3.3, 1.8);
    // Lanterns
    this.lights = [];
    for (const [x, y, z] of [[-4, 3.2, -4], [2, 3.2, 4], [-3, 3.2, 8], [-4, TOP - 0.5, -7], [-2, TOP - 0.5, 5], [4, TOP - 0.5, -6], [2, TOP - 0.5, -2]]) {
      const light = new THREE.PointLight('#ffc070', 9, 14, 1.6);
      light.position.set(x, y, z);
      s.add(light);
      this.lights.push(light);
      const glass = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), glowMat);
      glass.position.set(x, y, z);
      s.add(glass);
      b.box(x, y + 0.12, z, 0.03, (y < F2 ? F2 : TOP) - y - 0.12, 0.03, '#2a2a2a');
    }
    s.add(new THREE.HemisphereLight('#ffd8a8', '#3a2010', 0.75));
    // Wall decorations: wanted posters and the saloon's name over the bar.
    const wanted = new THREE.MeshLambertMaterial({ map: wantedTexture() });
    for (const [x, y, z, ry] of [[-W + 0.03, 1.8, -4, Math.PI / 2], [-W + 0.03, 1.8, 1, Math.PI / 2], [W - 0.03, F2 + 1.7, -7, -Math.PI / 2], [3.5, 1.9, D - 0.03, Math.PI]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.8), wanted);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      s.add(m);
    }
    const name = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.9), new THREE.MeshBasicMaterial({ map: textTexture('THE GOLDEN SPUR', '#3a1e0c', '#f4d58a') }));
    name.position.set(-2, 3.1, -D + 0.05);
    s.add(name);
    b.box(-4, 0.005, 3.5, 3.4, 0.01, 2.4, '#7a2a2a');

    // ---- Upstairs: a corridor, three guest rooms at the front, the owner's suite and a storeroom at the back.
    const up = (x0, z0, x1, z1) => this.wall(b, x0, z0, x1, z1, F2, TOP - F2, paper2);
    up(-W, -4.1, -4, -3.9);
    up(-2.8, -4.1, 3, -3.9);
    up(4.2, -4.1, W, -3.9);
    up(1.4, -D, 1.6, -4.1);
    up(-W, -0.1, -6, 0.1);
    up(-4.8, -0.1, -1, 0.1);
    up(0.2, -0.1, 3.3, 0.1);
    up(4.5, -0.1, STAIR.x0, 0.1);
    up(-3.1, 0.1, -2.9, D);
    up(2.3, 0.1, 2.5, D);
    up(STAIR.x0 - 0.1, 0.1, STAIR.x0 + 0.1, D);
    // Railing where the stairwell opens to the floor above the front door.
    b.box((STAIR.x0 + W) / 2, F2, STAIR.zBot + 0.05, W - STAIR.x0, 1, 0.1, trim);
    this.colliders.addBox(STAIR.x0, STAIR.zBot, W, STAIR.zBot + 0.1, F2 + 1, F2 - 0.5);
    for (const [x0, z0, x1, z1] of [[-4, -4.1, -2.8, -3.9], [3, -4.1, 4.2, -3.9], [-6, -0.1, -4.8, 0.1], [-1, -0.1, 0.2, 0.1], [3.3, -0.1, 4.5, 0.1]]) {
      b.box((x0 + x1) / 2, TOP - 1.2, (z0 + z1) / 2, x1 - x0, 1.2, z1 - z0, paper2);
    }
    const bed = (x, z, len, wide, alongZ, blanket) => {
      const [sx, sz] = alongZ ? [wide, len] : [len, wide];
      r.rbox([x, F2 + 0.25, z], [sx, 0.3, sz], 0.05, '#5a3218');
      r.rbox([x, F2 + 0.47, z], [sx - 0.1, 0.16, sz - 0.1], 0.07, blanket);
      const px = alongZ ? x : x - len / 2 + 0.35, pz = alongZ ? z - len / 2 + 0.35 : z;
      r.rbox([px, F2 + 0.6, pz], [alongZ ? wide - 0.3 : 0.4, 0.12, alongZ ? 0.4 : wide - 0.3], 0.05, '#f0ece0');
      this.colliders.addBox(x - sx / 2, z - sz / 2, x + sx / 2, z + sz / 2, F2 + 0.7, F2 - 0.5);
    };
    bed(-5.6, 9.3, 2.2, 1.2, true, '#6a7a9a');
    bed(-0.4, 9.6, 2.0, 1.1, true, '#8a5a3a');
    bed(4, 6, 2.0, 1.0, true, '#5a7a5a');
    for (const [x, z] of [[-7.2, 6], [1.6, 5], [3.4, 2]]) {
      r.rbox([x, F2 + 0.25, z], [0.8, 0.5, 0.5], 0.05, '#6a4a2a');
      this.colliders.addBox(x - 0.4, z - 0.25, x + 0.4, z + 0.25, F2 + 0.6, F2 - 0.5);
    }
    // Owner's suite: big bed, desk, rug, wardrobe and the safe.
    bed(-6.2, -8.3, 2.4, 1.9, false, '#7a2a4a');
    r.rbox([-3.5, F2 + 0.38, -10.3], [1.8, 0.76, 0.8], 0.04, '#5a3218');
    this.colliders.addBox(-4.4, -10.7, -2.6, -9.9, F2 + 0.9, F2 - 0.5);
    chair(-3.5, -9.35, Math.PI, F2);
    r.rbox([-0.2, F2 + 1.1, -10.6], [1.4, 2.2, 0.7], 0.05, '#4a2e18');
    this.colliders.addBox(-0.9, -10.95, 0.5, -10.25, TOP, F2 - 0.5);
    b.box(-3.5, F2 + 0.005, -6.8, 3.4, 0.01, 2.4, '#5a2a5a');
    r.rbox([-6.9, F2 + 0.3, -5], [0.5, 0.6, 0.5], 0.04, '#5a3218');
    r.rbox([this.safe.x, F2 + 0.45, this.safe.z], [0.7, 0.9, 0.8], 0.06, '#2a2a30');
    r.cylinder([this.safe.x + 0.36, F2 + 0.55, this.safe.z], 0.11, 0.11, 0.04, '#c8a040', [0, 0, Math.PI / 2], 14);
    r.rbox([this.safe.x + 0.36, F2 + 0.3, this.safe.z + 0.22], [0.03, 0.06, 0.18], 0.01, '#c8a040');
    this.colliders.addBox(this.safe.x - 0.35, this.safe.z - 0.4, this.safe.x + 0.35, this.safe.z + 0.4, F2 + 1, F2 - 0.5);
    // Storeroom: crates and barrels.
    for (const [x, z] of [[3, -10.2], [4.2, -10.2], [3.6, -10.2]]) r.rbox([x, F2 + 0.35, z], [0.7, 0.7, 0.7], 0.04, '#9a7a4a');
    r.rbox([3.6, F2 + 1.05, -10.2], [0.7, 0.7, 0.7], 0.04, '#8a6a3a');
    this.colliders.addBox(2.6, -10.6, 4.6, -9.8, F2 + 1.5, F2 - 0.5);
    for (const [x, z] of [[7, -6], [7, -7.2], [6.9, -8.5]]) {
      r.cylinder([x, F2 + 0.5, z], 0.38, 0.38, 1, '#7a5a32', [0, 0, 0], 14);
      this.colliders.addCircle(x, z, 0.38, F2 + 1.1);
    }
    for (const g of [b.build()]) {
      const m = new THREE.Mesh(g, flatMat);
      s.add(m);
    }
    s.add(new THREE.Mesh(r.build(), roundMat));
  }

  buildPeople() {
    this.people = PEOPLE.map((d) => {
      const h = makeHumanoid(d.look);
      const [x, z, y] = d.at;
      h.group.position.set(x, y, z);
      h.group.rotation.y = d.facing;
      this.scene.add(h.group);
      return { ...d, h, pos: h.group.position, home: { x, z, y, facing: d.facing }, state: 'idle', timer: 0, t: this.rng.range(0, 6), chat: 0, punchT: 0, cd: 0 };
    });
    // A floating "Zzz" over the sleeping traveler.
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 32;
    const x = c.getContext('2d');
    x.font = 'bold 24px "Courier New", monospace';
    x.fillStyle = '#e8f0ff';
    x.strokeStyle = '#000';
    x.lineWidth = 4;
    x.strokeText('Zzz', 6, 24);
    x.fillText('Zzz', 6, 24);
    this.zzz = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    this.zzz.scale.set(0.8, 0.4, 1);
    this.scene.add(this.zzz);
  }

  person(id) {
    return this.people.find((p) => p.id === id);
  }

  // ------------------------------------------------------------ items

  refill() {
    const g = this.game;
    SLOTS.forEach(([kind, x, y, z], i) => {
      if (this.items.some((it) => it.slot === i)) return;
      if (g.time - this.slotTaken[i] < REFILL_AFTER) return;
      const mesh = litterMesh(kind);
      mesh.scale.setScalar(ITEM_SIZE);
      mesh.position.set(x, y, z);
      mesh.rotation.y = this.rng.range(0, Math.PI * 2);
      this.scene.add(mesh);
      this.items.push({ kind, name: KINDS[kind].name, mesh, pos: mesh.position, carried: false, vy: 0, slot: i });
    });
  }

  nearest(x, z, r, y = 0) {
    let best = null, bd = r;
    for (const it of this.items) {
      if (Math.abs(it.pos.y - y) > 1.4) continue;
      const d = Math.hypot(it.pos.x - x, it.pos.z - z);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    return best;
  }

  take(it) {
    it.carried = true;
    this.scene.remove(it.mesh);
    this.forget(it);
    if (it.slot !== undefined) this.slotTaken[it.slot] = this.game.time;
    it.slot = undefined;
  }

  forget(it) {
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
  }

  putDown(it, x, y, z, facing) {
    it.carried = false;
    it.mesh.position.set(x, y, z);
    it.mesh.rotation.set(0, facing + Math.PI / 2, 0);
    it.mesh.scale.setScalar(ITEM_SIZE);
    it.vy = 0;
    this.scene.add(it.mesh);
    this.items.push(it);
  }

  // ------------------------------------------------------------ entering and leaving

  enter() {
    const g = this.game, p = g.player;
    this.refill();
    g.inside = this;
    this.scene.add(p.root, p.claw);
    p.pos.set(0, 0, D - 1.2);
    p.facing = Math.PI;
    p.vy = 0;
    g.cam.yaw = 0;
    g.cam.pitch = 0.3;
    g.cam.first = true;
    g.sfx.play('door');
    g.ui.toast('The Golden Spur Saloon', '#f4d58a');
  }

  exit() {
    const g = this.game, p = g.player, door = g.world.pois.saloon.door, s = g.world.pois.saloon.facing;
    g.inside = null;
    g.scene.add(p.root, p.claw);
    p.pos.set(door.x + s * 0.5, 0.15, door.z);
    p.facing = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    p.vy = 0;
    g.cam.yaw = p.facing + Math.PI;
    g.cam.first = true;
    this.safe.progress = 0;
    g.sfx.play('door');
  }

  // ------------------------------------------------------------ people

  talk(person) {
    const g = this.game, name = person.name;
    if (person.id === 'sleeper') {
      g.ui.showDialog([{ name, text: person.lines[person.chat++ % person.lines.length] }]);
      return;
    }
    if (person.state === 'shoo') return;
    const text = person.lines[person.chat++ % person.lines.length];
    if (person.shop) g.ui.showDialog([{ name, text }], () => g.ui.openPanel('shop', person.shop));
    else if (person.piano) {
      g.ui.showDialog([{ name, text }]);
      g.sfx.play('ragtime');
    } else g.ui.showDialog([{ name, text }]);
  }

  // Hissing inside works like outside: each person either recoils or shoos you, 50/50.
  hissAt(pos, r) {
    const g = this.game;
    for (const p of this.people) {
      if (p.id === 'sleeper' || Math.abs(p.pos.y - pos.y) > 1.5 || Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) > r) continue;
      if (this.rng.chance(0.5)) {
        if (p.owner && p.state !== 'out') {
          p.state = 'out';
          p.timer = 40;
          g.animals.toast('"Eek! A wild cat!" Miss Lottie flees downstairs.', '#cfe8b0');
        } else {
          p.hop = 1;
          g.animals.toast(`${p.name.split(' ')[0]} jumps out of their seat!`, '#cfe8b0');
        }
      } else if (p.state !== 'out') {
        p.state = 'shoo';
        p.timer = 5;
        g.animals.toast(`"Shoo, cat!" ${p.name.split(' ')[0]} chases you off.`, '#ffb07a');
      }
    }
  }

  // Sprayed with the water gun: the owner flees her suite, the sleeper wakes, everyone else jumps.
  soak(p) {
    const g = this.game, first = p.name.split(' ')[0];
    if (p.id === 'sleeper') g.animals.toast('"Bwah! Wha-? It\'s raining indoors!"', '#9adcff');
    else if (p.owner && p.state !== 'out') {
      p.state = 'out';
      p.timer = 40;
      this.safe.progress = 0;
      g.animals.toast('"My dress! You soggy menace!" Miss Lottie storms downstairs.', '#9adcff');
    } else {
      p.hop = 1;
      g.animals.toast(`${first} sputters, dripping wet!`, '#9adcff');
    }
  }

  hitInFront(pos, fx, fz) {
    for (const p of this.people) {
      if (Math.abs(p.pos.y - pos.y) > 1.5) continue;
      const dx = p.pos.x - pos.x, dz = p.pos.z - pos.z, d = Math.hypot(dx, dz);
      if (d > 1.3 || (dx * fx + dz * fz) / (d || 1) < 0.3) continue;
      this.hissAt(p.pos, 0.1);
      return true;
    }
    return false;
  }

  onMeow() {
    const g = this.game, p = g.player.pos;
    const fan = this.people.find((o) => o.id !== 'sleeper' && Math.abs(o.pos.y - p.y) < 1.5 && Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < 5);
    if (fan && g.time - (this.lastTip || -99) > 25 && this.rng.chance(0.4)) {
      this.lastTip = g.time;
      g.ui.toast(`"Well, ain't you a charmer." ${fan.name.split(' ')[0]} slides you a coin.`, '#ffb0c8');
      g.rpg.addMoney(3 + Math.floor(this.rng.range(0, 6)));
    }
  }

  pushOut(q, r) {
    for (const p of this.people) {
      if (Math.abs(p.pos.y - q.y) > 1.2 || p.pose === 'lie') continue;
      const dx = q.x - p.pos.x, dz = q.z - p.pos.z, d = Math.hypot(dx, dz), m = r + 0.3;
      if (d < m && d > 1e-4) {
        q.x = p.pos.x + (dx / d) * m;
        q.z = p.pos.z + (dz / d) * m;
      }
    }
  }

  nearestPerson(pos, r) {
    let best = null, bd = r;
    for (const p of this.people) {
      if (Math.abs(p.pos.y - pos.y) > 1.5) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  // ------------------------------------------------------------ the safe

  // Cracking the safe means holding T next to it. Miss Lottie sits at her desk with her
  // back to it, but every so often she turns around.
  crackSafe(dt, holding) {
    const g = this.game, sf = this.safe, lottie = this.person('lottie');
    if (g.time < sf.emptyUntil) return 'The safe is empty. Come back later.';
    if (!holding) {
      sf.progress = Math.max(0, sf.progress - dt * 0.5);
      return sf.progress > 0 ? 'Keep holding T to crack the safe' : '[Hold T] Crack the safe';
    }
    sf.progress += dt / 3.5;
    // A short grace period after she starts turning lets you let go of T in time.
    const watching = lottie.state === 'idle' && lottie.lookT > 0 && lottie.lookAge > 0.5;
    if (watching) {
      sf.progress = 0;
      lottie.state = 'shoo';
      lottie.timer = 6;
      g.rpg.rep -= 10;
      g.ui.toast('"THIEF! Get away from my safe, you rotten cat!" (-10 rep)', '#ff7a6b');
      g.sfx.play('fail');
      return '';
    }
    if (sf.progress >= 1) {
      sf.progress = 0;
      sf.emptyUntil = g.time + SAFE_REFILL;
      const cash = 150 + Math.floor(this.rng.range(0, 150));
      g.rpg.addMoney(cash);
      g.rpg.addXP(40);
      g.sfx.play('levelup');
      g.ui.toast(`*click* The safe swings open! You swipe $${cash}.`, '#ffd34d');
      g.save();
      return '';
    }
    const n = Math.round(sf.progress * 10);
    return `Cracking the safe [${'#'.repeat(n)}${'-'.repeat(10 - n)}]`;
  }

  // ------------------------------------------------------------ per frame

  // Prompt text and T action for whatever the cat is next to inside.
  interaction(inp, dt) {
    const g = this.game, p = g.player, pos = p.pos;
    const atDoor = pos.y < 0.5 && Math.abs(pos.x) < 1.6 && pos.z > D - 1.8;
    const person = this.nearestPerson(pos, 1.9);
    const atSafe = pos.y > F2 - 0.5 && Math.hypot(pos.x - this.safe.x, pos.z - this.safe.z) < 1.5;
    let text = '', action = null;
    if (atSafe) {
      text = this.crackSafe(dt, inp.down('KeyT'));
    } else if (person) {
      text = `[T] Talk to ${person.name}`;
      action = () => this.talk(person);
    } else if (atDoor) {
      text = '[T] Leave the saloon';
      action = () => this.exit();
    }
    return { text, action };
  }

  update(dt) {
    const g = this.game, pl = g.player.pos;
    for (const p of this.people) {
      p.t += dt;
      const h = p.h;
      p.punchT = Math.max(0, p.punchT - dt * 3);
      p.hop = Math.max(0, (p.hop || 0) - dt * 2.5);
      if (p.state === 'shoo' && Math.abs(pl.y - p.pos.y) < 1.5) {
        // Chase the cat around, swatting; people can't actually hurt you.
        p.timer -= dt;
        p.cd -= dt;
        const dx = pl.x - p.pos.x, dz = pl.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
        p.facing = Math.atan2(dx, dz);
        if (d > 0.9) {
          p.pos.x += (dx / d) * 3.4 * dt;
          p.pos.z += (dz / d) * 3.4 * dt;
          this.colliders.resolveCircle(p.pos, 0.3, p.pos.y + 0.3);
        } else if (p.cd <= 0) {
          p.cd = 1;
          p.punchT = 1;
          g.sfx.play('swing');
          g.cam.shake = 0.05;
        }
        p.phase = (p.phase || 0) + dt * 9;
        h.group.rotation.y = p.facing;
        animateHumanoid(h, p.phase, d > 0.9 ? 1 : 0, p.punchT);
        if (p.timer < 0) this.goHome(p);
        continue;
      }
      if (p.state === 'shoo') this.goHome(p);
      if (p.state === 'out') {
        // Miss Lottie waits downstairs at the end of the bar, then goes back up.
        p.timer -= dt;
        p.pos.set(3, 0, -7.2);
        h.group.rotation.y = -Math.PI / 2;
        animateHumanoid(h, 0, 0);
        if (p.timer < 0) this.goHome(p);
        continue;
      }
      // Idle poses: sitting, lying in bed, or standing behind the bar.
      h.group.rotation.y = p.home.facing;
      if (p.pose === 'sit') {
        animateHumanoid(h, 0, 0);
        h.rig.position.y = -(0.84 - (p.seat ?? 0.48)) + p.hop * 0.25;
        h.legL.rotation.x = h.legR.rotation.x = -1.45;
        h.armL.rotation.x = h.armR.rotation.x = -0.5;
        if (p.piano) {
          h.armL.rotation.x = -1.1 + Math.sin(p.t * 9) * 0.15;
          h.armR.rotation.x = -1.1 + Math.cos(p.t * 11) * 0.15;
        }
      } else if (p.pose === 'lie') {
        animateHumanoid(h, 0, 0);
        h.rig.rotation.x = -Math.PI / 2;
        h.rig.position.y = 0.1;
      } else {
        animateHumanoid(h, 0, 0);
        h.armR.rotation.x = -0.4 + Math.sin(p.t * 2) * 0.3;
        h.rig.position.y = p.hop * 0.25;
      }
      // Miss Lottie now and then turns around in her chair to look at the room.
      if (p.owner) {
        if (p.lookT > 0) {
          p.lookT -= dt;
          p.lookAge += dt;
          h.group.rotation.y = p.home.facing + Math.PI * 0.85 * Math.min(1, p.lookAge * 3);
          if (p.lookT <= 0) p.turnT = this.rng.range(3, 7);
        } else {
          p.turnT = (p.turnT ?? 4) - dt;
          if (p.turnT < 0) {
            p.lookT = 1.8;
            p.lookAge = 0;
            if (g.player.pos.y > F2 - 0.5 && this.safe.progress > 0) g.ui.toast('Miss Lottie starts to turn around...', '#ffb07a');
          }
        }
      }
    }
    const sl = this.person('sleeper');
    this.zzz.position.set(sl.pos.x, sl.pos.y + 0.9 + Math.sin(g.time * 1.5) * 0.08, sl.pos.z - 1.6);
    this.zzz.material.opacity = 0.6 + Math.sin(g.time * 3) * 0.3;
    for (const [i, l] of this.lights.entries()) l.intensity = 9 + Math.sin(g.time * 7 + i * 1.7) * 0.6;
    // Dropped things fall to the floor.
    for (const it of this.items) {
      const gh = this.groundAt(it.pos.x, it.pos.z, it.pos.y);
      if (it.pos.y > gh + 0.001 && !SLOTS[it.slot]) {
        it.vy -= 12 * dt;
        it.pos.y = Math.max(gh, it.pos.y + it.vy * dt);
      }
    }
  }

  goHome(p) {
    p.state = 'idle';
    p.pos.set(p.home.x, p.home.y, p.home.z);
    p.facing = p.home.facing;
    p.lookT = 0;
  }
}
