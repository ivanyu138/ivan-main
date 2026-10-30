import * as THREE from 'three';
import { SmoothBuilder } from './smooth.js';
import { groundHeight, HALF } from './world.js';
import { RNG } from './util.js';

const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
const wrapMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, transparent: true, opacity: 0.7 });

// Small things a cat can carry in its mouth. Each model sits on the ground (y = 0)
// with its long side along z, which becomes crosswise in the cat's mouth.
export const KINDS = {
  wrap: {
    name: 'plastic wrap', mat: wrapMat,
    build: (b) => {
      b.sphere([0, 0.04, 0], [0.07, 0.04, 0.09], '#e6f0f6', 10);
      b.sphere([0.04, 0.05, 0.05], [0.05, 0.035, 0.05], '#f4fafc', 8);
      b.sphere([-0.04, 0.035, -0.05], [0.05, 0.03, 0.06], '#d8e8f0', 8);
    },
  },
  chips: {
    name: 'chip bag',
    build: (b) => b.rbox([0, 0.025, 0], [0.13, 0.05, 0.2], 0.02, (x, y, z) => (Math.abs(z) < 0.03 ? '#f2c230' : '#c8282a')),
  },
  fish: {
    name: 'fish',
    build: (b) => {
      b.sphere([0, 0.04, 0.02], [0.035, 0.04, 0.12], (x, y) => (y > 0.05 ? '#5a7a8e' : '#c8d4dc'), 12);
      b.cone([0, 0.04, -0.13], 0.045, 0.07, '#5a7a8e', [Math.PI / 2, 0, 0], 8, [0.4, 1, 1]);
      for (const sx of [-1, 1]) b.sphere([sx * 0.03, 0.055, 0.1], [0.008, 0.01, 0.01], '#111111', 6);
    },
  },
  sock: {
    name: 'sock',
    build: (b) => {
      const stripes = (x, y, z) => (Math.sin(z * 60) > 0.3 ? '#e04848' : '#f4f0e8');
      b.capsule([0, 0.03, 0.02], 0.03, 0.16, stripes, [Math.PI / 2, 0, 0], 8);
      b.sphere([0.04, 0.03, -0.09], [0.05, 0.03, 0.04], '#f4f0e8', 8);
    },
  },
  paper: {
    name: 'paper ball',
    build: (b) => b.add(new THREE.IcosahedronGeometry(0.06, 1), '#f2f0ea', [0, 0.055, 0]),
  },
  mouse: {
    name: 'toy mouse',
    build: (b) => {
      b.sphere([0, 0.035, 0.02], [0.035, 0.035, 0.065], '#9a9aa2', 10);
      for (const sx of [-1, 1]) b.sphere([sx * 0.025, 0.07, 0.05], [0.018, 0.018, 0.006], '#e8a0b0', 8);
      b.tube([[0, 0.02, -0.04], [0.02, 0.01, -0.1], [-0.01, 0.01, -0.16]], 0.005, '#e8a0b0', 8, 4);
    },
  },
  crust: {
    name: 'pizza crust',
    build: (b) => b.tube([[-0.02, 0.02, -0.1], [0.025, 0.02, -0.03], [0.025, 0.02, 0.04], [-0.02, 0.02, 0.1]], 0.022, '#d89a52', 12, 8),
  },
  cap: {
    name: 'bottle cap',
    build: (b) => b.cylinder([0, 0.012, 0], 0.03, 0.03, 0.024, '#c02a2a', [0, 0, 0], 14),
  },
  leaf: {
    name: 'leaf',
    build: (b) => {
      b.sphere([0, 0.006, 0], [0.05, 0.006, 0.09], (x) => (Math.abs(x) < 0.005 ? '#8a4a1a' : '#d8762a'), 12);
      b.cylinder([0, 0.006, -0.11], 0.004, 0.004, 0.05, '#8a4a1a', [Math.PI / 2, 0, 0], 4);
    },
  },
  feather: {
    name: 'feather',
    build: (b) => {
      b.sphere([0, 0.006, 0.02], [0.025, 0.005, 0.1], '#f4f4f0', 10);
      b.cylinder([0, 0.008, -0.04], 0.003, 0.003, 0.18, '#d8d0c0', [Math.PI / 2, 0, 0], 4);
    },
  },
  donut: {
    name: 'donut',
    build: (b) => b.add(new THREE.TorusGeometry(0.045, 0.022, 8, 16), (x, y, z, nx, ny) => (ny > 0.2 ? '#f08aa8' : '#d8a060'), [0, 0.022, 0], [Math.PI / 2, 0, 0]),
  },
  cardboard: {
    name: 'piece of cardboard',
    build: (b) => b.rbox([0, 0.008, 0], [0.14, 0.016, 0.18], 0.005, '#b08a5a'),
  },
};
// Fish and socks turn up more often, since people want them.
const KIND_IDS = [...Object.keys(KINDS), 'fish', 'fish', 'sock', 'sock'];
// Drawn a bit larger than life so they're easy to spot from the chase camera.
const SIZE = 1.5;
const geoCache = {};
function geoFor(kind) {
  if (!geoCache[kind]) {
    const b = new SmoothBuilder();
    KINDS[kind].build(b);
    geoCache[kind] = b.build();
  }
  return geoCache[kind];
}

export function litterMesh(kind) {
  const mesh = new THREE.Mesh(geoFor(kind), KINDS[kind].mat || mat);
  mesh.castShadow = true;
  return mesh;
}

// Litter scattered on sidewalks, lots and backyards, recycled around the player.
export class Litter {
  constructor(game, count = 32) {
    this.game = game;
    this.rng = new RNG(808);
    this.items = [];
    this.count = count;
    this.timer = 0;
  }

  spawnOne(minR, maxR) {
    const g = this.game, p = g.player.pos, rng = this.rng;
    for (let k = 0; k < 12; k++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(minR, maxR);
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (Math.abs(x) > HALF - 5 || Math.abs(z) > HALF - 5) continue;
      if (g.world.colliders.pointBlocked(x, 0.1, z, 0.3)) continue;
      const kind = rng.pick(KIND_IDS);
      const mesh = litterMesh(kind);
      mesh.position.set(x, groundHeight(x, z), z);
      mesh.rotation.y = rng.range(0, Math.PI * 2);
      mesh.scale.setScalar(SIZE);
      g.scene.add(mesh);
      const it = { kind, name: KINDS[kind].name, mesh, pos: mesh.position, carried: false, vy: 0 };
      this.items.push(it);
      return it;
    }
    return null;
  }

  nearest(x, z, r) {
    let best = null, bd = r;
    for (const it of this.items) {
      if (it.carried) continue;
      const d = Math.hypot(it.pos.x - x, it.pos.z - z);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    return best;
  }

  // Hand an item to the cat: it leaves the ground and is reparented to the cat's rig.
  take(it) {
    it.carried = true;
    this.game.scene.remove(it.mesh);
  }

  // Stop tracking an item (it was given away or stashed).
  forget(it) {
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
  }

  // Drop an item from height y; it falls to the ground.
  putDown(it, x, y, z, facing) {
    it.carried = false;
    it.mesh.position.set(x, y, z);
    it.mesh.rotation.set(0, facing + Math.PI / 2, 0);
    it.mesh.scale.setScalar(SIZE);
    it.vy = 0;
    this.game.scene.add(it.mesh);
  }

  update(dt) {
    const g = this.game, p = g.player.pos;
    if (this.items.length < this.count) {
      // Fill in quickly at first, then trickle new litter in out of sight.
      const fresh = this.items.length < this.count * 0.5;
      for (let i = 0; i < (fresh ? 4 : 1); i++) this.spawnOne(fresh ? 3 : 60, 140);
    }
    for (const it of [...this.items]) {
      if (it.carried) continue;
      const gh = groundHeight(it.pos.x, it.pos.z);
      if (it.pos.y > gh) {
        it.vy -= 12 * dt;
        it.pos.y = Math.max(gh, it.pos.y + it.vy * dt);
      }
      if (Math.hypot(it.pos.x - p.x, it.pos.z - p.z) > 200) {
        g.scene.remove(it.mesh);
        this.items.splice(this.items.indexOf(it), 1);
      }
    }
  }
}
