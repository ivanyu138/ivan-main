import * as THREE from 'three';
import { SmoothBuilder } from './smooth.js';
import { litterMesh, KINDS } from './litter.js';
import { CURB } from './world.js';

const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
const MAX_SHOWN = 60;

function denGeo() {
  const b = new SmoothBuilder();
  // An open cardboard box lying on its side, and a round cat bed beside it.
  const card = '#b08a5a', inner = '#8a6a42';
  b.rbox([0, 0.015, 0], [0.9, 0.03, 0.7], 0.01, inner);
  b.rbox([0, 0.36, 0], [0.9, 0.03, 0.7], 0.01, card);
  b.rbox([0, 0.19, -0.34], [0.9, 0.36, 0.03], 0.01, card);
  for (const sx of [-1, 1]) b.rbox([sx * 0.44, 0.19, 0], [0.03, 0.36, 0.7], 0.01, card);
  b.rbox([0, 0.37, 0.42], [0.9, 0.02, 0.16], 0.01, card, [0.5, 0, 0]);
  b.add(new THREE.TorusGeometry(0.32, 0.1, 10, 22), '#5a8ac0', [0.95, 0.1, 0.1], [Math.PI / 2, 0, 0]);
  b.cylinder([0.95, 0.05, 0.1], 0.3, 0.3, 0.06, '#e8e0f0', [0, 0, 0], 20);
  return b.build();
}

// The cats' home base: anything carried here joins a pile that is saved between sessions.
export class Stash {
  constructor(game) {
    this.game = game;
    // Tucked at the back of the alley, with the box opening toward the street.
    const c = game.world.alley.camp;
    this.pos = new THREE.Vector3(c.x, CURB, c.z);
    this.rot = Math.PI;
    const den = new THREE.Mesh(denGeo(), mat);
    den.position.copy(this.pos);
    den.rotation.y = this.rot;
    den.castShadow = den.receiveShadow = true;
    game.scene.add(den);
    this.kinds = [];
    this.meshes = [];
  }

  near(pos, r = 2.4) {
    return Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z) < r;
  }

  // Treasure piles up in a loose spiral in front of the box, kept within the alley walls.
  place(mesh, i) {
    const a = i * 2.4, r = 0.55 + 0.1 * Math.sqrt(i * 3);
    mesh.position.set(this.pos.x + Math.cos(a) * Math.min(r, 2.2), this.pos.y + Math.floor(i / 25) * 0.04, this.pos.z - 1.4 + Math.sin(a) * r * 0.5);
    mesh.rotation.set(0, a * 1.7, 0);
    this.game.scene.add(mesh);
    this.meshes.push(mesh);
  }

  add(item) {
    const g = this.game, n = this.kinds.length;
    this.kinds.push(item.kind);
    item.mesh.scale.setScalar(1.5);
    if (n < MAX_SHOWN) this.place(item.mesh, n);
    g.sfx.play('drop');
    g.ui.toast(`Stashed the ${item.name} at base camp (${n + 1} treasures)`, '#e8c890');
    if ((n + 1) % 5 === 0) {
      // Treasure shelves at base camp make showing off the stash worth more.
      const xp = Math.round((20 + (n + 1) * 2) * (g.baseCamp.has('shelves') ? 1.5 : 1));
      g.rpg.addXP(xp);
      g.ui.toast((n + 1) % 25 === 0 ? 'What a hoard! Every cat in Brooklyn is jealous.' : 'Your stash is growing!', '#ffd34d');
      g.sfx.play('levelup');
    }
    g.save();
  }

  load(kinds) {
    for (const m of this.meshes) this.game.scene.remove(m);
    this.meshes = [];
    this.kinds = (kinds || []).filter((k) => KINDS[k]);
    this.kinds.slice(0, MAX_SHOWN).forEach((k, i) => {
      const m = litterMesh(k);
      m.scale.setScalar(1.5);
      this.place(m, i);
    });
  }
}
