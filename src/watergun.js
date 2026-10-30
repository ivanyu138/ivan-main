import * as THREE from 'three';
import { SmoothBuilder } from './smooth.js';

// A bright plastic water blaster the cat holds in its mouth. V equips it; hold click or R
// to spray where the camera is looking. People get soaked and run, vandals get knocked
// about, and animals (especially cats) bolt.
const MAX = 260; // droplets in flight
const RATE = 55; // droplets per second
const SPEED = 13;
const DRAIN = 22; // tank per second while spraying
const REFILL = 18; // tank per second once you stop
const SOAKED = ['"Hey! I\'m soaked!"', '"Ack! Who brought a water gun?!"', '"My new shoes!"', '"Not cool, cat!"', '"Ahh, it\'s cold!"'];

function gunGeometry() {
  const b = new SmoothBuilder();
  const orange = '#ff8a1e', yellow = '#ffd23a';
  b.rbox([0, 0, 0.02], [0.09, 0.08, 0.26], 0.03, orange);
  b.sphere([0, 0.075, -0.02], [0.065, 0.065, 0.065], '#5ec8ff', 10);
  b.cylinder([0, 0.12, -0.02], 0.02, 0.02, 0.04, yellow, [0, 0, 0], 8);
  b.cylinder([0, 0.005, 0.18], 0.018, 0.024, 0.1, yellow, [Math.PI / 2, 0, 0], 8);
  b.rbox([0, -0.07, -0.05], [0.06, 0.1, 0.05], 0.02, orange, [0.35, 0, 0]);
  b.rbox([0, -0.04, 0.03], [0.02, 0.05, 0.02], 0.008, yellow);
  return b.build();
}

export class WaterGun {
  constructor(game) {
    this.game = game;
    this.equipped = false;
    this.tank = 100;
    this.spraying = false;
    this.idleT = 0;
    this.emitAcc = 0;
    this.sndT = 0;
    this.mesh = new THREE.Mesh(gunGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }));
    this.mesh.visible = false;
    this.drops = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.05, 6, 4),
      new THREE.MeshBasicMaterial({ color: '#9adcff', transparent: true, opacity: 0.8 }),
      MAX,
    );
    this.drops.frustumCulled = false;
    this.drops.count = 0;
    this.p = new Float32Array(MAX * 3);
    this.v = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.size = new Float32Array(MAX);
    this.n = 0;
    this.m = new THREE.Matrix4();
    this.attach();
  }

  // The gun lives on the cat's head rig, so it moves with every step; re-attached when switching cats.
  attach() {
    const cat = this.game.player.cat, m = cat.mouth;
    this.mesh.position.set(0, m.y - 0.04, m.z + 0.13);
    this.mesh.scale.setScalar(1.3);
    cat.rig.add(this.mesh);
  }

  toggle() {
    const g = this.game, p = g.player;
    if (!this.equipped && p.carry) {
      g.ui.toast(`Drop the ${p.carry.name} first (G)`, '#ffb07a');
      return;
    }
    this.equipped = !this.equipped;
    this.mesh.visible = this.equipped;
    g.sfx.play(this.equipped ? 'pump' : 'drop');
    if (this.equipped) g.ui.toast('Water gun ready: hold click or R to spray', '#9adcff');
  }

  muzzle() {
    const p = this.game.player, m = p.cat.mouth, f = p.facing, r = m.z + 0.42;
    return { x: p.pos.x + Math.sin(f) * r, y: p.pos.y + m.y - 0.01, z: p.pos.z + Math.cos(f) * r };
  }

  emit(aim) {
    if (this.n >= MAX) return;
    const i = this.n++, o = this.muzzle(), k = i * 3, j = 0.6;
    this.p[k] = o.x;
    this.p[k + 1] = o.y;
    this.p[k + 2] = o.z;
    this.v[k] = Math.sin(aim) * SPEED + (Math.random() - 0.5) * j;
    this.v[k + 1] = 2.4 + (Math.random() - 0.5) * j;
    this.v[k + 2] = Math.cos(aim) * SPEED + (Math.random() - 0.5) * j;
    this.life[i] = 0.75;
    this.size[i] = 0.8 + Math.random() * 0.5;
  }

  // A few droplets bouncing up where the stream lands.
  splash(x, y, z) {
    for (let s = 0; s < 3 && this.n < MAX; s++) {
      const i = this.n++, k = i * 3;
      this.p[k] = x;
      this.p[k + 1] = y;
      this.p[k + 2] = z;
      this.v[k] = (Math.random() - 0.5) * 2.5;
      this.v[k + 1] = 1.5 + Math.random() * 1.5;
      this.v[k + 2] = (Math.random() - 0.5) * 2.5;
      this.life[i] = 0.25;
      this.size[i] = 0.5;
    }
  }

  kill(i) {
    const last = --this.n, a = i * 3, b = last * 3;
    for (let c = 0; c < 3; c++) {
      this.p[a + c] = this.p[b + c];
      this.v[a + c] = this.v[b + c];
    }
    this.life[i] = this.life[last];
    this.size[i] = this.size[last];
  }

  update(dt) {
    const g = this.game, p = g.player, inp = g.input;
    // Droplets render in whichever scene the cat is in.
    const scene = g.inside ? g.inside.scene : g.scene;
    if (this.drops.parent !== scene) {
      scene.add(this.drops);
      this.n = 0;
    }
    const want = this.equipped && !p.vehicle && p.canAct() && (inp.down('Mouse0') || inp.down('KeyR'));
    this.spraying = want && this.tank > 0;
    if (want && this.tank <= 0 && g.time - (this.emptyT || -9) > 2) {
      this.emptyT = g.time;
      g.ui.toast('Out of water! Let it refill...', '#9adcff');
      g.sfx.play('deny');
    }
    if (this.spraying) {
      this.idleT = 0;
      this.tank = Math.max(0, this.tank - DRAIN * dt);
      // Aim where the camera looks: the cat turns to face it.
      const aim = Math.atan2(-Math.sin(g.cam.yaw), -Math.cos(g.cam.yaw));
      p.aim(aim, dt);
      this.emitAcc += RATE * dt;
      while (this.emitAcc >= 1) {
        this.emitAcc--;
        this.emit(p.facing);
      }
      this.sndT -= dt;
      if (this.sndT <= 0) {
        this.sndT = 0.13;
        g.sfx.play('spray');
      }
    } else {
      this.emitAcc = 0;
      this.idleT += dt;
      if (this.idleT > 0.8) this.tank = Math.min(100, this.tank + REFILL * dt);
    }
    this.mesh.visible = this.equipped;
    this.simulate(dt);
  }

  simulate(dt) {
    const g = this.game, env = g.env();
    let splashes = 0;
    for (let i = 0; i < this.n; i++) {
      const k = i * 3;
      this.life[i] -= dt;
      this.v[k + 1] -= 14 * dt;
      const x = (this.p[k] += this.v[k] * dt);
      const y = (this.p[k + 1] += this.v[k + 1] * dt);
      const z = (this.p[k + 2] += this.v[k + 2] * dt);
      let dead = this.life[i] <= 0;
      if (!dead && this.size[i] > 0.6) {
        const gh = env.ground(x, z, y);
        if (y <= gh + 0.02 || env.colliders.pointBlocked(x, y, z, 0.02)) {
          dead = true;
          if (splashes++ < 2) this.splash(x, Math.max(y, gh + 0.03), z);
        } else if (this.hit(x, y, z, this.v[k], this.v[k + 2])) {
          dead = true;
          if (splashes++ < 3) this.splash(x, y, z);
        }
      }
      if (dead) {
        this.kill(i);
        i--;
      }
    }
    for (let i = 0; i < this.n; i++) {
      const k = i * 3, s = this.size[i];
      this.m.makeScale(s, s, s).setPosition(this.p[k], this.p[k + 1], this.p[k + 2]);
      this.drops.setMatrixAt(i, this.m);
    }
    this.drops.count = this.n;
    this.drops.instanceMatrix.needsUpdate = true;
  }

  splat() {
    const g = this.game;
    if (g.time - (this.splatT || -9) < 0.18) return;
    this.splatT = g.time;
    g.sfx.play('splash');
  }

  // Does a droplet at (x, y, z) hit someone? Reactions are throttled per target.
  hit(x, y, z, vx, vz) {
    const g = this.game;
    const near = (o, r, h) => Math.abs(o.x - x) < r && Math.abs(o.z - z) < r && y > o.y - 0.1 && y < o.y + h && Math.hypot(o.x - x, o.z - z) < r;
    const fresh = (t, gap) => {
      if (g.time - (t.soakT || -99) < gap) return false;
      t.soakT = g.time;
      return true;
    };
    const d = Math.hypot(vx, vz) || 1, fx = vx / d, fz = vz / d;
    const from = { x: x - fx * 4, z: z - fz * 4 };
    if (g.inside) {
      for (const q of g.inside.people) {
        if (!near(q.pos, 0.45, 1.8)) continue;
        if (fresh(q, 2.5)) g.inside.soak(q);
        this.splat();
        return true;
      }
      return false;
    }
    for (const e of g.npcs.enemies) {
      if (e.state === 'down' || !near(e.pos, 0.45, 1.9)) continue;
      if (fresh(e, 0.12)) g.npcs.hurtEnemy(e, 3, fx * 0.5, fz * 0.5);
      this.splat();
      return true;
    }
    for (const n of g.npcs.list) {
      if (!near(n.pos, 0.45, 1.9)) continue;
      if (fresh(n, 3)) g.animals.toast(`"Hey! Quit it, you little rascal!"`, '#9adcff');
      this.splat();
      return true;
    }
    for (const q of g.peds.list) {
      if (q.state === 'down' || !q.h.group.visible || !near(q.pos, 0.45, 1.9)) continue;
      if (q.state !== 'flee' || fresh(q, 2)) {
        g.peds.flee(q, from.x, from.z, 5);
        if (fresh(this, 1.6)) g.ui.toast(SOAKED[Math.floor(Math.random() * SOAKED.length)], '#9adcff');
      }
      this.splat();
      return true;
    }
    for (const a of g.animals.list) {
      if (!a.model.group.visible || a.state === 'fly' || !near(a.pos, 0.4, 0.8)) continue;
      if (a.state !== 'flee') {
        g.animals.flee(a, from);
        a.timer = 6;
        g.animals.toast(a.kind === 'cat' ? `The ${a.name} yowls and bolts. Cats hate water!` : `The ${a.name} runs off, dripping.`, '#9adcff');
      }
      this.splat();
      return true;
    }
    return false;
  }
}
