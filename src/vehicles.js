import * as THREE from 'three';
import { MeshBuilder } from './geo.js';
import { NAX, NSZ, PX, PZ, ROAD, LANE, HALF, nodePos, groundHeight, segExists } from './world.js';
import { angDiff, clamp, RNG } from './util.js';

export const SPECS = {
  sedan: { name: 'Sedan', len: 4.4, wid: 1.9, max: 30, accel: 9 },
  taxi: { name: 'Taxi', len: 4.4, wid: 1.9, max: 31, accel: 9.5 },
  van: { name: 'Van', len: 5.0, wid: 2.0, max: 24, accel: 7 },
  sports: { name: 'Sports Car', len: 4.3, wid: 1.95, max: 47, accel: 16 },
};
const COLORS = ['#c0392b', '#2e86c1', '#e8eaea', '#1c2833', '#7d8c8d', '#27ae60', '#8e44ad', '#d68910', '#5d6d7e', '#a04000', '#f2d7a0'];

const carMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const geoCache = new Map();

function carGeo(type, color) {
  const key = type + color;
  if (geoCache.has(key)) return geoCache.get(key);
  const s = SPECS[type], b = new MeshBuilder();
  const glass = '#26303a', tire = '#151515', light = '#fff4c0', tail = '#c02020', trim = '#2a2a2a';
  const L = s.len / 2;
  if (type === 'van') {
    b.box(0, 0.38, 0, s.wid, 1.72, s.len, color);
    b.box(0, 1.25, L, 1.8, 0.7, 0.08, glass);
    b.box(-s.wid / 2, 1.3, 1.5, 0.06, 0.6, 1.3, glass);
    b.box(s.wid / 2, 1.3, 1.5, 0.06, 0.6, 1.3, glass);
    b.box(0, 0.5, -L - 0.02, 1.6, 0.12, 0.04, trim);
  } else if (type === 'sports') {
    b.box(0, 0.28, 0, s.wid, 0.52, s.len, color);
    b.box(0, 0.8, -0.35, 1.6, 0.38, 1.8, glass);
    b.box(0, 1.18, -0.4, 1.62, 0.06, 1.5, color);
    b.box(0, 0.98, -L + 0.2, 1.8, 0.08, 0.4, trim);
    b.box(0.6, 0.8, -L + 0.2, 0.08, 0.18, 0.2, trim);
    b.box(-0.6, 0.8, -L + 0.2, 0.08, 0.18, 0.2, trim);
    b.box(0, 0.8, 0.9, 0.8, 0.03, 1.0, trim);
  } else {
    b.box(0, 0.32, 0, s.wid, 0.62, s.len, color);
    b.box(0, 0.94, -0.25, 1.7, 0.5, 2.3, glass);
    b.box(0, 1.44, -0.25, 1.72, 0.07, 2.2, color);
    if (type === 'taxi') b.box(0, 1.51, -0.25, 0.7, 0.25, 0.3, '#ffe680');
  }
  const ly = type === 'van' ? 0.7 : type === 'sports' ? 0.5 : 0.6;
  for (const sx of [-1, 1]) {
    b.box(sx * (s.wid / 2 - 0.3), ly, L, 0.42, 0.16, 0.06, light);
    b.box(sx * (s.wid / 2 - 0.3), ly, -L, 0.42, 0.16, 0.06, tail);
    for (const sz of [-1, 1]) {
      const wz = sz * (L - 0.95);
      b.box(sx * (s.wid / 2 - 0.12), 0, wz, 0.3, 0.64, 0.64, tire);
      b.box(sx * (s.wid / 2 + 0.03), 0.2, wz, 0.02, 0.24, 0.24, '#9a9a9a');
    }
  }
  b.box(0, 0.24, L + 0.02, s.wid, 0.16, 0.08, trim);
  b.box(0, 0.24, -L - 0.02, s.wid, 0.16, 0.08, trim);
  const g = b.build();
  geoCache.set(key, g);
  return g;
}

export class Car {
  constructor(game, type, color) {
    this.game = game;
    this.type = type;
    this.spec = SPECS[type];
    this.color = color;
    this.mesh = new THREE.Mesh(carGeo(type, color), carMat);
    this.mesh.castShadow = true;
    game.scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.heading = 0;
    this.speed = 0;
    this.steer = 0;
    this.hp = 100;
    this.mode = 'ai'; // ai | parked | player
    this.ai = {};
    this.cruise = 10;
    this.blockT = 0;
    this.ghostT = 0;
    this.owned = false;
  }

  get fx() { return Math.sin(this.heading); }
  get fz() { return Math.cos(this.heading); }

  drive(dt, inp, canAct, rpg) {
    const s = this.spec;
    const thr = canAct && inp.down('KeyW'), brk = canAct && inp.down('KeyS'), hb = canAct && inp.down('Space');
    const steerIn = canAct ? (inp.down('KeyA') ? 1 : 0) - (inp.down('KeyD') ? 1 : 0) : 0;
    const skill = 1 + 0.05 * (rpg.skills.driving - 1);
    const maxV = this.hp <= 0 ? 5 : s.max * skill;
    if (thr) this.speed += (this.speed < 0 ? 18 : s.accel * skill * (1 - 0.55 * this.speed / maxV)) * dt;
    if (brk) this.speed -= (this.speed > 0.5 ? 22 : 7) * dt;
    if (!thr && !brk) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 2.5 * dt);
    if (hb) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt);
    this.speed = clamp(this.speed, -9, maxV);
    this.steer += (steerIn - this.steer) * Math.min(1, dt * 7);
    const turn = ((hb ? 3.1 : 2.2) / (1 + Math.abs(this.speed) / 24)) * skill;
    this.heading += this.steer * turn * clamp(this.speed / 5, -1, 1) * dt;
    this.move(dt);
    this.collide();
  }

  coast(dt) {
    this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    if (Math.abs(this.speed) > 0.01) {
      this.move(dt);
      this.collide();
    }
  }

  move(dt) {
    this.pos.x += this.fx * this.speed * dt;
    this.pos.z += this.fz * this.speed * dt;
    const lim = HALF + 6;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);
    const gh = groundHeight(this.pos.x, this.pos.z);
    this.pos.y += (gh - this.pos.y) * Math.min(1, dt * 15);
  }

  circles() {
    const off = this.spec.len / 2 - this.spec.wid / 2;
    return [
      { x: this.pos.x + this.fx * off, z: this.pos.z + this.fz * off },
      { x: this.pos.x - this.fx * off, z: this.pos.z - this.fz * off },
    ];
  }

  collide() {
    const g = this.game, col = g.world.colliders, r = this.spec.wid / 2;
    let hit = false, nx = 0, nz = 0;
    for (const c of this.circles()) {
      const ox = c.x, oz = c.z;
      if (col.resolveCircle(c, r, 0.5)) {
        this.pos.x += c.x - ox;
        this.pos.z += c.z - oz;
        nx += col.nx;
        nz += col.nz;
        hit = true;
      }
    }
    for (const o of g.traffic.cars) {
      if (o === this || Math.abs(o.pos.x - this.pos.x) > 6 || Math.abs(o.pos.z - this.pos.z) > 6) continue;
      const ro = o.spec.wid / 2;
      for (const a of this.circles()) {
        for (const b of o.circles()) {
          const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz), m = r + ro;
          if (d >= m || d < 1e-4) continue;
          const push = (m - d) / 2;
          this.pos.x += (dx / d) * push;
          this.pos.z += (dz / d) * push;
          o.pos.x -= (dx / d) * push;
          o.pos.z -= (dz / d) * push;
          o.speed *= 0.6;
          nx += dx / d;
          nz += dz / d;
          hit = true;
        }
      }
    }
    if (!hit) return;
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    const dot = this.fx * nx + this.fz * nz;
    const into = -dot * this.speed; // closing speed into the obstacle
    if (into > 0.5) {
      this.speed *= 1 - 0.85 * Math.abs(dot);
      if (into > 7) {
        this.hp = Math.max(0, this.hp - into * 1.2);
        if (this.mode === 'player') {
          g.sfx.play('crash');
          g.cam.shake = Math.min(0.6, into / 30);
          if (into > 18) g.rpg.damage(Math.round((into - 18) * 1.5));
        }
      }
    }
  }

  sync() {
    this.mesh.rotation.y = this.heading;
  }
}

export class Traffic {
  constructor(game, count = 45) {
    this.game = game;
    this.rng = new RNG(99);
    this.cars = [];
    const types = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'sedan', 'van'];
    for (let i = 0; i < count; i++) {
      const t = this.rng.pick(types);
      const car = new Car(game, t, t === 'taxi' ? '#f1c40f' : this.rng.pick(COLORS));
      car.cruise = this.rng.range(8.5, 12);
      this.cars.push(car);
      this.spawnNear(car, 10, 320);
    }
  }

  setSegment(car, i, j, dx, dz, t = 0) {
    const A = nodePos(i, j), B = nodePos(i + dx, j + dz);
    const rx = -dz, rz = dx, e = ROAD / 2 + 2;
    car.ai = {
      i, j, dx, dz, phase: 'seg',
      tx: B.x - dx * e + rx * LANE, tz: B.z - dz * e + rz * LANE,
    };
    if (t >= 0) {
      const sx = A.x + dx * e + rx * LANE, sz = A.z + dz * e + rz * LANE;
      const segLen = (dx ? PX : PZ) - 2 * e;
      car.pos.set(sx + dx * segLen * t, 0, sz + dz * segLen * t);
      car.heading = Math.atan2(dx, dz);
    }
  }

  chooseNext(car) {
    const a = car.ai, ni = a.i + a.dx, nj = a.j + a.dz;
    const ok = (dx, dz) => segExists(ni, nj, dx, dz);
    const opts = [];
    if (ok(a.dx, a.dz)) opts.push([a.dx, a.dz], [a.dx, a.dz]);
    if (ok(a.dz, -a.dx)) opts.push([a.dz, -a.dx]);
    if (ok(-a.dz, a.dx)) opts.push([-a.dz, a.dx]);
    if (!opts.length) opts.push([-a.dx, -a.dz]);
    const [dx, dz] = this.rng.pick(opts);
    const B = nodePos(ni, nj), e = ROAD / 2 + 2, rx = -dz, rz = dx;
    car.ai = { ...a, phase: 'turn', ni, nj, ndx: dx, ndz: dz, tx: B.x + dx * e + rx * LANE, tz: B.z + dz * e + rz * LANE };
  }

  spawnNear(car, minR, maxR) {
    const p = this.game.player ? this.game.player.pos : { x: 0, z: 0 };
    const rng = this.rng;
    for (let k = 0; k < 40; k++) {
      const i = clamp(Math.round((p.x + HALF) / PX) + rng.int(-1, 1), 0, NAX - 1);
      const j = clamp(Math.round((p.z + HALF) / PZ) + rng.int(-3, 3), 0, NSZ - 1);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => segExists(i, j, dx, dz));
      if (!dirs.length) continue;
      const [dx, dz] = rng.pick(dirs);
      const t = rng.range(0, 0.9);
      const save = car.pos.clone(), sh = car.heading;
      this.setSegment(car, i, j, dx, dz, t);
      const d = Math.hypot(car.pos.x - p.x, car.pos.z - p.z);
      const crowded = this.cars.some((o) => o !== car && Math.hypot(o.pos.x - car.pos.x, o.pos.z - car.pos.z) < 12);
      if (d >= minR && d <= maxR && !crowded) {
        car.mode = 'ai';
        car.speed = car.cruise * 0.7;
        car.hp = 100;
        car.ghostT = 0;
        car.sync();
        return true;
      }
      car.pos.copy(save);
      car.heading = sh;
    }
    return false;
  }

  blockedAhead(car) {
    const fx = car.fx, fz = car.fz, reach = 6 + car.speed * 0.5;
    for (const o of this.cars) {
      if (o === car || (car.ghostT > 0 && o.mode === 'ai')) continue;
      const rx = o.pos.x - car.pos.x, rz = o.pos.z - car.pos.z;
      const along = rx * fx + rz * fz;
      if (along < 0.5 || along > reach) continue;
      if (Math.abs(rx * fz - rz * fx) < 2.2) return 'car';
    }
    const p = this.game.player;
    if (!p.vehicle) {
      const rx = p.pos.x - car.pos.x, rz = p.pos.z - car.pos.z;
      const along = rx * fx + rz * fz;
      if (along > 0 && along < reach + 1 && Math.abs(rx * fz - rz * fx) < 1.7) return 'player';
    }
    return null;
  }

  aiUpdate(car, dt) {
    const a = car.ai;
    if (car.ghostT > 0) car.ghostT -= dt;
    const dx = a.tx - car.pos.x, dz = a.tz - car.pos.z, dist = Math.hypot(dx, dz);
    const dh = angDiff(car.heading, Math.atan2(dx, dz));
    car.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    let target = a.phase === 'turn' ? 6 : dist < 16 ? 7.5 : car.cruise;
    if (Math.abs(dh) > 0.5) target = Math.min(target, 4.5);
    const blk = this.blockedAhead(car);
    if (blk) {
      target = 0;
      car.blockT += dt;
      if (blk === 'car' && car.blockT > 3) {
        car.ghostT = 2.5;
        car.blockT = 0;
      }
      if (blk === 'player' && car.blockT > 2.5 && car.blockT - dt <= 2.5) this.game.sfx.play('horn', car.pos);
    } else car.blockT = 0;
    car.speed += clamp(target - car.speed, -14 * dt, 5 * dt);
    car.move(dt);
    if (a.phase === 'seg') {
      if ((car.pos.x - a.tx) * a.dx + (car.pos.z - a.tz) * a.dz > -0.5 || dist < 2.5) this.chooseNext(car);
    } else if (dist < 2.5) {
      this.setSegment(car, a.ni, a.nj, a.ndx, a.ndz, -1);
    }
  }

  update(dt) {
    const g = this.game, p = g.player.pos;
    for (const car of this.cars) {
      const d = Math.hypot(car.pos.x - p.x, car.pos.z - p.z);
      if (car.mode === 'player') car.drive(dt, g.input, g.player.canAct(), g.rpg);
      else if (car.mode === 'ai') {
        if (d > 380) this.spawnNear(car, 230, 330);
        else this.aiUpdate(car, dt);
      } else {
        if (d > 420 && !car.owned) this.spawnNear(car, 230, 330);
        else car.coast(dt);
      }
      car.mesh.visible = d < 460;
      car.sync();
    }
  }

  nearest(pos, maxD) {
    let best = null, bd = maxD;
    for (const c of this.cars) {
      const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) - c.spec.len / 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  // Keep a walking body (p with .x/.z) out of car footprints.
  pushOut(p, r) {
    for (const c of this.cars) {
      if (c.mode === 'player' && this.game.player.vehicle === c && p === this.game.player.pos) continue;
      if (Math.abs(c.pos.x - p.x) > 4 || Math.abs(c.pos.z - p.z) > 4) continue;
      const rr = c.spec.wid / 2 + r;
      for (const k of c.circles()) {
        const dx = p.x - k.x, dz = p.z - k.z, d = Math.hypot(dx, dz);
        if (d < rr && d > 1e-4) {
          p.x = k.x + (dx / d) * rr;
          p.z = k.z + (dz / d) * rr;
        }
      }
    }
  }

  addCar(type, color, x, z, heading) {
    const car = new Car(this.game, type, color);
    car.mode = 'parked';
    car.pos.set(x, 0, z);
    car.heading = heading;
    car.sync();
    this.cars.push(car);
    return car;
  }
}
