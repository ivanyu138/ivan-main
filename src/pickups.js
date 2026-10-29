import * as THREE from 'three';
import { MeshBuilder } from './geo.js';
import { groundHeight, onRoad, HALF } from './world.js';
import { RNG } from './util.js';

const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
const glowMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#5a4400' });

function gnomeGeo() {
  const b = new MeshBuilder();
  b.box(0, 0, 0, 0.32, 0.36, 0.26, '#e8b830');
  b.box(0, 0.36, 0, 0.24, 0.2, 0.22, '#f1c9a5');
  b.box(0, 0.3, 0.1, 0.22, 0.16, 0.06, '#f4f4f4');
  b.box(0, 0.56, 0, 0.26, 0.12, 0.24, '#e8b830');
  b.box(0, 0.68, 0, 0.16, 0.14, 0.16, '#e8b830');
  b.box(0, 0.82, 0, 0.08, 0.1, 0.08, '#e8b830');
  return b.build();
}
function cashGeo() {
  const b = new MeshBuilder();
  b.box(0, 0, 0, 0.42, 0.06, 0.22, '#3f9a4a');
  b.box(0, 0.06, 0, 0.12, 0.01, 0.12, '#cfe8b0');
  return b.build();
}
function catGeo() {
  const b = new MeshBuilder();
  b.box(0, 0.12, 0, 0.24, 0.22, 0.5, '#d8893a');
  b.box(0, 0.24, 0.3, 0.22, 0.2, 0.2, '#d8893a');
  b.box(-0.07, 0.44, 0.32, 0.06, 0.08, 0.04, '#b86a2a');
  b.box(0.07, 0.44, 0.32, 0.06, 0.08, 0.04, '#b86a2a');
  b.box(0, 0.22, -0.32, 0.06, 0.06, 0.24, '#b86a2a');
  for (const [x, z] of [[-0.08, 0.18], [0.08, 0.18], [-0.08, -0.18], [0.08, -0.18]]) b.box(x, 0, z, 0.06, 0.12, 0.06, '#d8893a');
  b.box(-0.05, 0.32, 0.401, 0.04, 0.04, 0.01, '#111');
  b.box(0.05, 0.32, 0.401, 0.04, 0.04, 0.01, '#111');
  return b.build();
}

export class Pickups {
  constructor(game) {
    this.game = game;
    this.rng = new RNG(555);
    this.items = [];
    this.geo = { gnome: gnomeGeo(), cash: cashGeo(), cat: catGeo() };
    // Ten gnome hiding spots, fixed for every playthrough.
    const r = new RNG(1010);
    const yards = [...game.world.backyards];
    this.gnomeSpots = [];
    while (this.gnomeSpots.length < 10 && yards.length) {
      const y = yards.splice(r.int(0, yards.length - 1), 1)[0];
      if (Math.hypot(y.x, y.z) < 200 && this.gnomeSpots.length < 8) continue;
      this.gnomeSpots.push({ x: y.x + r.range(-y.w / 3, y.w / 3), z: y.z + r.range(-y.w / 3, y.w / 3) });
    }
    this.cashTimer = 0;
  }

  add(type, x, z, opts = {}) {
    const mesh = new THREE.Mesh(this.geo[type], type === 'gnome' ? glowMat : mat);
    mesh.castShadow = true;
    mesh.position.set(x, groundHeight(x, z), z);
    this.game.scene.add(mesh);
    const it = { type, mesh, pos: mesh.position, base: mesh.position.y, t: this.rng.range(0, 6), ...opts };
    this.items.push(it);
    return it;
  }

  remove(it) {
    this.game.scene.remove(it.mesh);
    this.items = this.items.filter((i) => i !== it);
  }

  initGnomes(collected) {
    for (const it of this.items.filter((i) => i.type === 'gnome')) this.remove(it);
    this.gnomeSpots.forEach((s, i) => {
      if (!collected.includes(i)) this.add('gnome', s.x, s.z, { gid: i });
    });
  }

  addCash(x, z, value) {
    return this.add('cash', x, z, { value, life: 90 });
  }

  spawnAmbientCash() {
    const p = this.game.player.pos;
    for (let k = 0; k < 10; k++) {
      const a = this.rng.range(0, Math.PI * 2), d = this.rng.range(40, 180);
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (Math.abs(x) > HALF - 10 || Math.abs(z) > HALF - 10 || onRoad(x, z)) continue;
      if (this.game.world.colliders.pointBlocked(x, 0.5, z, 0.6)) continue;
      this.addCash(x, z, this.rng.int(5, 20)).ambient = true;
      return;
    }
  }

  nearestInteractable(pos, maxD = 2) {
    let best = null, bd = maxD;
    for (const it of this.items) {
      if (!it.interact) continue;
      const d = Math.hypot(it.pos.x - pos.x, it.pos.z - pos.z);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    return best;
  }

  update(dt) {
    const g = this.game, p = g.player.pos;
    this.cashTimer -= dt;
    if (this.cashTimer < 0) {
      this.cashTimer = 4;
      if (this.items.filter((i) => i.ambient).length < 12) this.spawnAmbientCash();
    }
    for (const it of [...this.items]) {
      it.t += dt;
      const d = Math.hypot(it.pos.x - p.x, it.pos.z - p.z);
      if (it.type === 'cash') {
        it.mesh.rotation.y += dt * 2;
        it.pos.y = it.base + 0.4 + Math.sin(it.t * 3) * 0.1;
        it.life -= dt;
        if (it.life < 0 || (it.ambient && d > 260)) {
          this.remove(it);
          continue;
        }
        if (d < (g.player.vehicle ? 2.6 : 1.3)) {
          this.remove(it);
          g.rpg.addMoney(it.value);
          g.sfx.play('coin');
        }
      } else if (it.type === 'gnome') {
        it.mesh.rotation.y += dt * 1.2;
        it.pos.y = it.base + 0.05 + Math.abs(Math.sin(it.t * 2)) * 0.15;
        if (d < 1.4 && !g.player.vehicle) {
          this.remove(it);
          g.rpg.gnomes.push(it.gid);
          g.rpg.addXP(25);
          g.sfx.play('levelup');
          g.ui.toast(`Golden gnome found! (${g.rpg.gnomes.length}/10)`, '#ffd34d');
          g.save();
        }
      } else if (it.type === 'cat') {
        it.mesh.rotation.y = Math.sin(it.t * 0.5) * 1.5;
        if (d < 25 && !it.heard) {
          it.heard = true;
          g.ui.toast('*meow* ...you hear a cat nearby', '#ffd34d');
          g.sfx.play('meow');
        }
      }
    }
  }
}
