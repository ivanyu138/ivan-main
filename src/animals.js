import * as THREE from 'three';
import { SmoothBuilder } from './smooth.js';
import { makeCat, animateCat } from './cat.js';
import { charMat } from './characters.js';
import { groundHeight, onRoad, HALF } from './world.js';
import { RNG, angDiff, clamp } from './util.js';

// Coats for the neighborhood's stray cats (same shape as the playable cats in cat.js).
const STRAY_COATS = [
  { name: 'black cat', body: '#262626', light: '#3a3a3a', muzzle: '#333333', paws: '#262626', eye: '#d8c040', meow: 600 },
  { name: 'white cat', body: '#f0eee8', light: '#ffffff', muzzle: '#ffffff', paws: '#ffffff', eye: '#7ab0e0', meow: 760 },
  { name: 'grey tabby', body: '#8a8a88', stripe: '#3a3a3a', light: '#e8e6e0', muzzle: '#e8e6e0', paws: '#e8e6e0', eye: '#a8b84a', meow: 680 },
  { name: 'orange tabby', body: '#d8893a', stripe: '#a8602a', light: '#f3e2c8', muzzle: '#f3e2c8', paws: '#f3e2c8', eye: '#c8a830', meow: 560 },
  { name: 'tuxedo cat', body: '#222222', light: '#f2f2f0', muzzle: '#f2f2f0', paws: '#f2f2f0', eye: '#a8b84a', belly: true, meow: 640 },
].map((c) => ({ ...c, shape: { bw: 0.31, bh: 0.27, bd: 0.58 } }));

const DOG_COATS = [
  { body: '#8a5a32', ear: '#5a3a1e', light: '#d8b890' },
  { body: '#d8a860', ear: '#b8843a', light: '#f0dcb0' },
  { body: '#2a2a2a', ear: '#1a1a1a', light: '#f0f0ea' },
  { body: '#f0ece4', ear: '#8a6a4a', light: '#ffffff' },
];

// Per-species tuning: walk/run speed, how close it gets to attack, and its name in messages.
const SPECIES = {
  cat: { walk: 1.2, run: 6.8, chase: 6.4, reach: 0.75, wander: 7 },
  dog: { walk: 1.5, run: 8, chase: 7.4, reach: 0.95, wander: 9 },
  rat: { walk: 0.9, run: 5, chase: 4.8, reach: 0.55, wander: 4 },
  pigeon: { walk: 0.5, run: 6, chase: 5.5, reach: 0.65, wander: 3 },
};

function makeDog(coat) {
  const b = new SmoothBuilder(), L = 0.38;
  const fur = (x, y, z, nx, ny, nz) => (ny < -0.4 || (z > 0.28 && y < 0.5) ? coat.light : coat.body);
  b.sphere([0, 0.5, 0], [0.17, 0.15, 0.36], fur, 18);
  b.sphere([0, 0.53, 0.24], [0.16, 0.16, 0.16], fur, 14);
  b.sphere([0, 0.66, 0.36], [0.08, 0.1, 0.09], coat.body, 10);
  b.sphere([0, 0.75, 0.43], [0.11, 0.11, 0.12], coat.body, 14);
  b.sphere([0, 0.71, 0.55], [0.06, 0.055, 0.09], coat.light, 12);
  b.sphere([0, 0.735, 0.635], [0.026, 0.022, 0.02], '#111111', 8);
  for (const sx of [-1, 1]) {
    b.sphere([sx * 0.045, 0.785, 0.53], [0.018, 0.02, 0.012], '#111111', 8);
    b.sphere([sx * 0.11, 0.72, 0.41], [0.03, 0.085, 0.055], coat.ear, 10, [0, 0, sx * 0.25]);
  }
  const body = new THREE.Mesh(b.build(), charMat);
  const lb = new SmoothBuilder();
  lb.capsule([0, -L / 2, 0], 0.045, L - 0.09, coat.body, [0, 0, 0], 8);
  lb.sphere([0, -L + 0.025, 0.02], [0.05, 0.03, 0.065], coat.light, 8);
  const legG = lb.build();
  const legs = [[-0.1, 0.24], [0.1, 0.24], [-0.1, -0.24], [0.1, -0.24]].map(([x, z]) => {
    const m = new THREE.Mesh(legG, charMat);
    m.position.set(x, L, z);
    return m;
  });
  const tb = new SmoothBuilder();
  tb.tube([[0, 0, 0.02], [0, 0.06, -0.12], [0, 0.16, -0.22]], 0.035, coat.body, 10, 8);
  const tail = new THREE.Mesh(tb.build(), charMat);
  tail.position.set(0, 0.58, -0.33);
  return assemble(body, tail, legs, { y: 0.66, z: 0.6 });
}

function makeRat() {
  const b = new SmoothBuilder(), fur = '#6a5e52';
  b.sphere([0, 0.06, 0], [0.05, 0.05, 0.1], (x, y, z, nx, ny) => (ny < -0.4 ? '#9a8e82' : fur), 12);
  b.sphere([0, 0.07, 0.11], [0.035, 0.035, 0.06], fur, 10);
  b.sphere([0, 0.065, 0.17], [0.01, 0.01, 0.01], '#e8a0b0', 6);
  for (const sx of [-1, 1]) {
    b.sphere([sx * 0.03, 0.105, 0.09], [0.02, 0.022, 0.006], '#e8a0b0', 8);
    b.sphere([sx * 0.022, 0.085, 0.135], [0.008, 0.008, 0.006], '#111111', 6);
    for (const z of [0.07, -0.06]) b.sphere([sx * 0.035, 0.012, z], [0.015, 0.012, 0.02], '#e8a0b0', 6);
  }
  b.tube([[0, 0.05, -0.08], [0.03, 0.03, -0.18], [-0.02, 0.015, -0.28], [0.02, 0.01, -0.34]], 0.007, '#d89aa0', 12, 5);
  const body = new THREE.Mesh(b.build(), charMat);
  const rig = new THREE.Group();
  rig.add(body);
  const group = new THREE.Group();
  group.add(rig);
  body.castShadow = true;
  return { group, rig, body, t: 0 };
}

function makePigeon() {
  const b = new SmoothBuilder();
  const plumage = (x, y, z, nx, ny, nz) => (z > 0.04 && y > 0.12 ? (nx > 0 ? '#5a8a72' : '#7a5a8a') : ny < -0.4 ? '#a8acb4' : '#8a8e98');
  b.sphere([0, 0.12, 0], [0.065, 0.065, 0.12], plumage, 12);
  b.sphere([0, 0.2, 0.08], [0.045, 0.05, 0.05], '#6a6e78', 10);
  b.cone([0, 0.195, 0.14], 0.012, 0.035, '#3a3a3a', [Math.PI / 2, 0, 0], 6);
  for (const sx of [-1, 1]) {
    b.sphere([sx * 0.03, 0.21, 0.11], [0.008, 0.008, 0.006], '#e85a2a', 6);
    b.cylinder([sx * 0.02, 0.03, 0.01], 0.006, 0.006, 0.06, '#d86a6a', [0, 0, 0], 4);
  }
  b.sphere([0, 0.12, -0.15], [0.05, 0.012, 0.07], '#4a4e58', 8);
  const body = new THREE.Mesh(b.build(), charMat);
  const wb = new SmoothBuilder();
  wb.sphere([0.05, 0, -0.02], [0.06, 0.014, 0.1], (x, y, z) => (Math.abs(z + 0.04) < 0.012 || Math.abs(z + 0.075) < 0.012 ? '#2a2a2a' : '#7a7e88'), 10);
  const wingG = wb.build();
  const wingL = new THREE.Mesh(wingG, charMat), wingR = new THREE.Mesh(wingG, charMat);
  wingR.position.set(0.04, 0.15, 0);
  wingL.position.set(-0.04, 0.15, 0);
  wingL.scale.x = -1;
  const rig = new THREE.Group();
  rig.add(body, wingL, wingR);
  const group = new THREE.Group();
  group.add(rig);
  body.castShadow = true;
  return { group, rig, body, wingL, wingR, t: 0 };
}

function assemble(body, tail, legs, mouth) {
  const rig = new THREE.Group();
  rig.add(body, tail, ...legs);
  const group = new THREE.Group();
  group.add(rig);
  for (const m of [body, tail, ...legs]) m.castShadow = true;
  return { group, rig, body, tail, legs, mouth, t: 0 };
}

// Stray cats, dogs, pigeons and rats living around the player. Hiss at them and each one
// either runs off or turns on you; only another cat can actually hurt you.
export class Animals {
  constructor(game) {
    this.game = game;
    this.rng = new RNG(31337);
    this.list = [];
    const add = (kind, model, name, extra = {}) => {
      game.scene.add(model.group);
      this.list.push({ kind, model, name, pos: model.group.position, facing: 0, state: 'wander', timer: 0, phase: 0, speed: 0, tx: 0, tz: 0, cd: 0, swipe: 0, y: 0, vy: 0, ...extra });
    };
    for (let i = 0; i < 5; i++) {
      const coat = STRAY_COATS[i % STRAY_COATS.length];
      add('cat', makeCat(coat, true), coat.name, { meow: coat.meow });
    }
    for (let i = 0; i < 3; i++) add('dog', makeDog(DOG_COATS[i % DOG_COATS.length]), 'dog');
    for (let i = 0; i < 4; i++) add('rat', makeRat(), 'rat');
    for (let i = 0; i < 8; i++) add('pigeon', makePigeon(), 'pigeon', { flock: Math.floor(i / 4) });
    this.lastToast = -99;
    for (const a of this.list) this.respawn(a, 15, 120);
  }

  toast(text, color) {
    const g = this.game;
    if (g.time - this.lastToast < 1.5) return;
    this.lastToast = g.time;
    g.ui.toast(text, color);
  }

  freeSpot(cx, cz, minR, maxR) {
    const rng = this.rng, col = this.game.world.colliders;
    for (let k = 0; k < 20; k++) {
      const ang = rng.range(0, Math.PI * 2), d = rng.range(minR, maxR);
      const x = cx + Math.cos(ang) * d, z = cz + Math.sin(ang) * d;
      if (Math.abs(x) > HALF - 5 || Math.abs(z) > HALF - 5 || onRoad(x, z) || col.pointBlocked(x, 0.2, z, 0.5)) continue;
      return [x, z];
    }
    return null;
  }

  respawn(a, minR, maxR) {
    const p = this.game.player.pos;
    // Pigeons land in flocks: the first of each flock picks a spot, the rest gather near it.
    const lead = a.kind === 'pigeon' ? this.list.find((o) => o.kind === 'pigeon' && o.flock === a.flock && o !== a && o.state === 'wander' && o.placed) : null;
    const spot = lead ? this.freeSpot(lead.pos.x, lead.pos.z, 0.4, 2.5) : this.freeSpot(p.x, p.z, minR, maxR);
    if (!spot) return;
    a.pos.set(spot[0], groundHeight(spot[0], spot[1]), spot[1]);
    a.y = 0;
    a.state = 'wander';
    a.timer = 0;
    a.placed = true;
    a.facing = this.rng.range(0, Math.PI * 2);
  }

  // Each animal near the hiss rolls: run off, or turn and attack. Ones already attacking
  // have the same 50/50 chance of giving up.
  hissAt(pos, r) {
    for (const a of this.list) {
      if (!a.model.group.visible || a.state === 'fly') continue;
      if (Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z) > (a.state === 'attack' ? r + 3 : r)) continue;
      this.intimidate(a, pos);
    }
  }

  intimidate(a, from) {
    const fight = this.rng.chance(0.5);
    if (a.state === 'attack') {
      if (fight) this.toast(`The ${a.name} isn't backing down!`, '#ff8a7a');
      else {
        this.flee(a, from);
        this.toast(`The ${a.name} backs off!`, '#cfe8b0');
      }
      return;
    }
    if (fight) this.attack(a);
    else this.flee(a, from);
  }

  flee(a, from) {
    const dx = a.pos.x - from.x, dz = a.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    a.fx = dx / d;
    a.fz = dz / d;
    if (a.kind === 'pigeon') {
      a.state = 'fly';
      a.vy = 3.5;
      a.timer = 5;
      this.game.sfx.play('flap');
      return;
    }
    a.state = 'flee';
    a.timer = this.rng.range(3, 5);
  }

  attack(a) {
    const g = this.game;
    a.state = 'attack';
    a.timer = this.rng.range(10, 14);
    a.cd = 0.6;
    const msg = {
      cat: [`The ${a.name} hisses back and attacks!`, '#ff7a6b'],
      dog: ['The dog barks and gives chase!', '#ffb07a'],
      rat: ['The rat lunges at you!', '#ffb07a'],
      pigeon: ['A pigeon dive-bombs you!', '#ffb07a'],
    }[a.kind];
    this.toast(msg[0], msg[1]);
    g.sfx.play(a.kind === 'cat' ? 'yowl' : a.kind === 'dog' ? 'bark' : a.kind === 'rat' ? 'squeak' : 'flap', a.meow);
  }

  // A scratch that lands on an animal works like a hiss aimed at it.
  hitInFront(pos, fx, fz) {
    for (const a of this.list) {
      if (!a.model.group.visible || a.state === 'fly') continue;
      const dx = a.pos.x - pos.x, dz = a.pos.z - pos.z, d = Math.hypot(dx, dz);
      if (d > 1.3 || (dx * fx + dz * fz) / (d || 1) < 0.3) continue;
      this.intimidate(a, pos);
      return true;
    }
    return false;
  }

  update(dt) {
    const g = this.game, pl = g.player, p = pl.pos, col = g.world.colliders;
    for (const a of this.list) {
      const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z);
      if (d > 160 || (a.state === 'fly' && a.timer < 0)) {
        this.respawn(a, 70, 140);
        continue;
      }
      a.model.group.visible = d < 110;
      if (!a.model.group.visible) continue;
      const S = SPECIES[a.kind];
      let vx = 0, vz = 0;
      a.timer -= dt;
      a.cd -= dt;
      a.swipe = Math.max(0, a.swipe - dt * 3);

      if (a.state === 'wander') {
        if (a.timer < 0) {
          // Pick somewhere nearby to amble to, or sit still for a bit.
          if (this.rng.chance(0.4)) {
            a.tx = a.pos.x;
            a.tz = a.pos.z;
          } else {
            const s = this.freeSpot(a.pos.x, a.pos.z, 1, S.wander);
            if (s) [a.tx, a.tz] = s;
          }
          a.timer = this.rng.range(2, 6);
        }
        const dx = a.tx - a.pos.x, dz = a.tz - a.pos.z, dd = Math.hypot(dx, dz);
        if (dd > 0.3) {
          vx = (dx / dd) * S.walk;
          vz = (dz / dd) * S.walk;
        }
        // Pigeons get nervous and take off if you rush at them.
        if (a.kind === 'pigeon' && d < 1.6 && pl.moving && !pl.vehicle) this.flee(a, p);
      } else if (a.state === 'flee') {
        vx = a.fx * S.run;
        vz = a.fz * S.run;
        if (a.timer < 0) a.state = 'wander';
      } else if (a.state === 'attack') {
        // Chase the player; give up after a while or if outrun.
        const dx = p.x - a.pos.x, dz = p.z - a.pos.z;
        if (a.timer < 0 || d > 25 || pl.vehicle) {
          a.state = 'wander';
          a.timer = 0;
          if (d <= 25 && !pl.vehicle) this.toast(`The ${a.name} loses interest.`, '#cfe8b0');
        } else if (d > S.reach) {
          vx = (dx / d) * S.chase;
          vz = (dz / d) * S.chase;
        } else if (a.cd <= 0) {
          a.cd = this.rng.range(0.8, 1.2);
          a.swipe = 1;
          this.strike(a);
        }
        a.facing += angDiff(a.facing, Math.atan2(dx, dz)) * Math.min(1, dt * 10);
      } else if (a.state === 'fly') {
        a.vy = Math.max(a.vy - dt * 0.6, 1.2);
        a.y += a.vy * dt;
        vx = a.fx * S.run;
        vz = a.fz * S.run;
      }

      a.pos.x += vx * dt;
      a.pos.z += vz * dt;
      const speed = Math.hypot(vx, vz);
      if (speed > 0.05 && a.state !== 'attack') a.facing += angDiff(a.facing, Math.atan2(vx, vz)) * Math.min(1, dt * 8);
      if (a.state !== 'fly') {
        if (col.resolveCircle(a.pos, 0.2, 0.3) && a.state === 'flee') {
          const dot = a.fx * col.nx + a.fz * col.nz;
          if (dot < 0) {
            a.fx -= 2 * dot * col.nx;
            a.fz -= 2 * dot * col.nz;
          }
        }
      }
      // Attacking pigeons flap around at head height; everything else stays on the ground.
      if (a.kind === 'pigeon' && a.state === 'attack') a.y = 0.45 + Math.sin(a.model.t * 6) * 0.1;
      else if (a.state !== 'fly') a.y = 0;
      a.pos.y = groundHeight(a.pos.x, a.pos.z) + a.y;
      a.model.group.rotation.y = a.facing;
      a.phase += dt * (speed > 3 ? 16 : 10) * (speed > 0.05 ? 1 : 0);
      this.animate(a, dt, speed);
    }
  }

  strike(a) {
    const g = this.game;
    if (a.kind === 'cat') {
      // Only another cat can actually hurt you: 1 HP per hit.
      g.sfx.play('scratch');
      g.rpg.damage(1);
      g.cam.shake = 0.12;
    } else {
      g.sfx.play(a.kind === 'dog' ? 'bark' : a.kind === 'rat' ? 'squeak' : 'flap');
      g.cam.shake = 0.06;
    }
  }

  animate(a, dt, speed) {
    const m = a.model;
    if (a.kind === 'cat' || a.kind === 'dog') {
      const amt = clamp(speed / (a.kind === 'dog' ? 3 : 2.5), 0, 1.2);
      animateCat(m, dt, a.phase, amt, a.swipe, 0, a.state === 'attack' && a.kind === 'cat' ? 0.35 : 0);
      return;
    }
    m.t += dt;
    if (a.kind === 'rat') {
      m.rig.position.y = Math.abs(Math.sin(a.phase)) * 0.02 * Math.min(1, speed);
      m.rig.rotation.x = a.swipe ? -0.4 * Math.sin(a.swipe * Math.PI) : 0;
      return;
    }
    // Pigeons: head-bob walking, pecking when idle, flapping when flying or attacking.
    const flying = a.state === 'fly' || a.state === 'attack';
    const flap = flying ? Math.sin(m.t * 28) * 0.9 : 0;
    m.wingR.rotation.z = flap;
    m.wingL.rotation.z = -flap;
    m.rig.rotation.x = !flying && speed < 0.05 ? Math.max(0, Math.sin(m.t * 3 + a.flock)) * 0.5 : 0;
    m.rig.position.z = !flying && speed > 0.05 ? Math.sin(a.phase) * 0.015 : 0;
  }

  // Red dots on the minimap for anything currently attacking.
  attackers() {
    return this.list.filter((a) => a.state === 'attack' && a.model.group.visible);
  }
}
