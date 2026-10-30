import { makeHumanoid, animateHumanoid, randomLook } from './characters.js';
import { blockRect, blockAt, isParkBlock, NBX, NBZ, HALF, PX, PZ, groundHeight } from './world.js';
import { RNG, clamp, angDiff, mod } from './util.js';

const INSET = 1.0;

// Ambient pedestrians strolling around block sidewalks. A fixed pool is recycled
// around the player so the streets always feel populated.
export class Pedestrians {
  constructor(game, count = 16) {
    this.game = game;
    this.rng = new RNG(4242);
    this.list = [];
    for (let i = 0; i < count; i++) {
      const h = makeHumanoid(randomLook(this.rng));
      game.scene.add(h.group);
      const p = {
        h, pos: h.group.position, facing: 0, state: 'walk', timer: 0, hp: 20, phase: this.rng.range(0, 6),
        speed: this.rng.range(1.1, 1.6), dir: this.rng.chance(0.5) ? 1 : -1, s: 0, ring: null, vx: 0, vz: 0, fx: 0, fz: 0,
      };
      this.list.push(p);
      this.spawn(p, 5, 160);
    }
    this.lastScold = 0;
  }

  ringOf(bi, bj) {
    const r = blockRect(bi, bj);
    const x0 = r.x0 + INSET, x1 = r.x1 - INSET, z0 = r.z0 + INSET, z1 = r.z1 - INSET;
    return { x0, x1, z0, z1, w: x1 - x0, d: z1 - z0, P: 2 * (x1 - x0 + z1 - z0) };
  }

  ringPoint(R, s) {
    s = mod(s, R.P);
    if (s < R.w) return [R.x0 + s, R.z0];
    s -= R.w;
    if (s < R.d) return [R.x1, R.z0 + s];
    s -= R.d;
    if (s < R.w) return [R.x1 - s, R.z1];
    s -= R.w;
    return [R.x0, R.z1 - s];
  }

  nearestS(R, x, z) {
    const cx = clamp(x, R.x0, R.x1), cz = clamp(z, R.z0, R.z1);
    const dl = cx - R.x0, dr = R.x1 - cx, dt = cz - R.z0, db = R.z1 - cz, m = Math.min(dl, dr, dt, db);
    if (m === dt) return cx - R.x0;
    if (m === dr) return R.w + (cz - R.z0);
    if (m === db) return R.w + R.d + (R.x1 - cx);
    return 2 * R.w + R.d + (R.z1 - cz);
  }

  spawn(p, minR, maxR) {
    const pl = this.game.player ? this.game.player.pos : { x: 0, z: 0 };
    const rng = this.rng;
    for (let k = 0; k < 30; k++) {
      const bi = clamp(Math.floor((pl.x + HALF) / PX) + rng.int(-1, 1), 0, NBX - 1);
      const bj = clamp(Math.floor((pl.z + HALF) / PZ) + rng.int(-2, 2), 0, NBZ - 1);
      if (isParkBlock(bi, bj)) continue;
      const R = this.ringOf(bi, bj), s = rng.range(0, R.P);
      const [x, z] = this.ringPoint(R, s);
      const d = Math.hypot(x - pl.x, z - pl.z);
      if (d < minR || d > maxR) continue;
      p.ring = R;
      p.s = s;
      p.pos.set(x, groundHeight(x, z), z);
      p.state = 'walk';
      p.hp = 20;
      p.timer = rng.range(5, 20);
      return;
    }
  }

  // Used when a driver is pulled out of their car.
  spawnFleeing(x, z, fromX, fromZ) {
    const pl = this.game.player.pos;
    let far = this.list[0];
    for (const p of this.list) if (Math.hypot(p.pos.x - pl.x, p.pos.z - pl.z) > Math.hypot(far.pos.x - pl.x, far.pos.z - pl.z)) far = p;
    far.pos.set(x, 0, z);
    const b = blockAt(x, z);
    far.ring = this.ringOf(b[0], b[1]);
    this.flee(far, fromX, fromZ, 6);
  }

  flee(p, fx, fz, t = 5) {
    if (p.state === 'down') return;
    p.state = 'flee';
    p.timer = t;
    const dx = p.pos.x - fx, dz = p.pos.z - fz, d = Math.hypot(dx, dz) || 1;
    p.fx = dx / d;
    p.fz = dz / d;
  }

  // Meowing makes nearby walkers stop and look. Returns the people charmed.
  charm(x, z, radius) {
    const out = [];
    for (const p of this.list) {
      if ((p.state !== 'walk' && p.state !== 'idle' && p.state !== 'look') || !p.h.group.visible) continue;
      if (Math.hypot(p.pos.x - x, p.pos.z - z) > radius) continue;
      p.state = 'look';
      p.timer = 2.5;
      p.lookX = x;
      p.lookZ = z;
      out.push(p);
    }
    return out;
  }

  // Hissed at: each person either runs off or chases the cat to shoo it away (50/50).
  // People already chasing have the same chance of giving up.
  hissAt(x, z, radius) {
    const g = this.game;
    for (const p of this.list) {
      if (!p.h.group.visible || p.state === 'down') continue;
      if (Math.hypot(p.pos.x - x, p.pos.z - z) > (p.state === 'chase' ? radius + 3 : radius)) continue;
      const fight = this.rng.chance(0.5);
      if (p.state === 'chase') {
        if (fight) g.animals.toast('"I said SHOO!"', '#ff8a7a');
        else {
          this.flee(p, x, z, 4);
          g.animals.toast('They back off!', '#cfe8b0');
        }
      } else if (fight) {
        p.state = 'chase';
        p.timer = this.rng.range(7, 10);
        p.cd = 0.4;
        g.animals.toast('"Hey! Shoo! Get outta here!"', '#ffb07a');
      } else this.flee(p, x, z, 5);
    }
  }

  scare(x, z, radius) {
    for (const p of this.list) if (Math.hypot(p.pos.x - x, p.pos.z - z) < radius) this.flee(p, x, z, 4);
  }

  knock(p, vx, vz, byPlayer) {
    p.state = 'down';
    p.timer = 3.5;
    p.vx = vx;
    p.vz = vz;
    if (byPlayer) {
      const g = this.game;
      g.rpg.rep -= 3;
      g.sfx.play('punch');
      if (g.time - this.lastScold > 6) {
        this.lastScold = g.time;
        g.ui.toast('Watch the road! (-3 rep)', '#ff8a7a');
      }
    }
  }

  update(dt) {
    const g = this.game, pl = g.player.pos, col = g.world.colliders;
    for (const p of this.list) {
      const d = Math.hypot(p.pos.x - pl.x, p.pos.z - pl.z);
      if (d > 190 && p.state !== 'down') {
        this.spawn(p, 90, 170);
        continue;
      }
      p.h.group.visible = d < 120;
      if (!p.h.group.visible) continue;

      // Getting hit by moving cars.
      if (p.state !== 'down') {
        for (const c of g.traffic.cars) {
          if (Math.abs(c.speed) < 3.5 || Math.abs(c.pos.x - p.pos.x) > 4 || Math.abs(c.pos.z - p.pos.z) > 4) continue;
          for (const k of c.circles()) {
            if (Math.hypot(k.x - p.pos.x, k.z - p.pos.z) < c.spec.wid / 2 + 0.35) {
              this.knock(p, c.fx * c.speed * 0.7, c.fz * c.speed * 0.7, c.mode === 'player');
              break;
            }
          }
          if (p.state === 'down') break;
        }
      }

      let moving = 0, speed = 0;
      if (p.state === 'walk') {
        p.timer -= dt;
        if (p.timer < 0) {
          p.state = 'idle';
          p.timer = this.rng.range(1.5, 5);
        }
        p.s += p.dir * p.speed * dt;
        const [x, z] = this.ringPoint(p.ring, p.s);
        const dx = x - p.pos.x, dz = z - p.pos.z;
        if (Math.abs(dx) + Math.abs(dz) > 1e-3) p.facing += angDiff(p.facing, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
        p.pos.x = x;
        p.pos.z = z;
        speed = p.speed;
      } else if (p.state === 'idle') {
        p.timer -= dt;
        if (p.timer < 0) {
          p.state = 'walk';
          p.timer = this.rng.range(8, 25);
          if (this.rng.chance(0.3)) p.dir *= -1;
        }
      } else if (p.state === 'flee' || p.state === 'return') {
        let vx, vz;
        if (p.state === 'flee') {
          p.timer -= dt;
          vx = p.fx * 5;
          vz = p.fz * 5;
          if (p.timer < 0) p.state = 'return';
        } else {
          const s = this.nearestS(p.ring, p.pos.x, p.pos.z);
          const [x, z] = this.ringPoint(p.ring, s);
          const dx = x - p.pos.x, dz = z - p.pos.z, dd = Math.hypot(dx, dz);
          if (dd < 0.3) {
            p.s = s;
            p.state = 'walk';
            p.timer = this.rng.range(8, 20);
          }
          vx = (dx / (dd || 1)) * 1.6;
          vz = (dz / (dd || 1)) * 1.6;
        }
        p.pos.x += vx * dt;
        p.pos.z += vz * dt;
        if (col.resolveCircle(p.pos, 0.35, 0.5) && p.state === 'flee') {
          // Bounce off walls instead of running into them forever.
          const dot = p.fx * col.nx + p.fz * col.nz;
          if (dot < 0) {
            p.fx -= 2 * dot * col.nx;
            p.fz -= 2 * dot * col.nz;
          }
        }
        speed = Math.hypot(vx, vz);
        if (speed > 0.1) p.facing += angDiff(p.facing, Math.atan2(vx, vz)) * Math.min(1, dt * 10);
      } else if (p.state === 'chase') {
        // Chasing the cat off: stomp and swat at it, but people never actually hurt you.
        const dx = pl.x - p.pos.x, dz = pl.z - p.pos.z, dd = Math.hypot(dx, dz) || 1;
        p.timer -= dt;
        p.cd -= dt;
        if (p.timer < 0 || dd > 20 || g.player.vehicle) p.state = 'return';
        else if (dd > 0.95) {
          speed = 4.2;
          p.pos.x += (dx / dd) * speed * dt;
          p.pos.z += (dz / dd) * speed * dt;
          col.resolveCircle(p.pos, 0.35, 0.5);
        } else if (p.cd <= 0) {
          p.cd = 1.1;
          p.punchT = 1;
          g.sfx.play('swing');
          g.cam.shake = 0.05;
        }
        p.facing += angDiff(p.facing, Math.atan2(dx, dz)) * Math.min(1, dt * 10);
      } else if (p.state === 'look') {
        p.timer -= dt;
        p.facing += angDiff(p.facing, Math.atan2(p.lookX - p.pos.x, p.lookZ - p.pos.z)) * Math.min(1, dt * 6);
        if (p.timer < 0) {
          p.state = 'walk';
          p.timer = this.rng.range(6, 15);
        }
      } else if (p.state === 'down') {
        p.timer -= dt;
        p.pos.x += p.vx * dt;
        p.pos.z += p.vz * dt;
        p.vx *= Math.exp(-dt * 3);
        p.vz *= Math.exp(-dt * 3);
        col.resolveCircle(p.pos, 0.35, 0.5);
        if (p.timer < 0) {
          p.hp = 20;
          this.flee(p, pl.x, pl.z, 4);
        }
      }
      moving = speed > 0.05 ? clamp(speed / 3, 0.5, 1.2) : 0;
      p.phase += dt * (speed > 3 ? 12 : 7) * (moving ? 1 : 0);
      p.pos.y = groundHeight(p.pos.x, p.pos.z);
      p.h.group.rotation.y = p.facing;
      p.punchT = Math.max(0, (p.punchT || 0) - dt * 3);
      animateHumanoid(p.h, p.phase, moving, p.punchT, p.state === 'down');
    }
  }

  pushOut(q, r) {
    for (const p of this.list) {
      if (p.state === 'down' || !p.h.group.visible) continue;
      const dx = q.x - p.pos.x, dz = q.z - p.pos.z, d = Math.hypot(dx, dz), m = r + 0.32;
      if (d < m && d > 1e-4) {
        q.x = p.pos.x + (dx / d) * m;
        q.z = p.pos.z + (dz / d) * m;
      }
    }
  }

  hitInFront(pos, fx, fz, dmg) {
    const g = this.game;
    for (const p of this.list) {
      if (p.state === 'down' || !p.h.group.visible) continue;
      const dx = p.pos.x - pos.x, dz = p.pos.z - pos.z, d = Math.hypot(dx, dz);
      if (d > 1.7 || (dx * fx + dz * fz) / (d || 1) < 0.4) continue;
      p.hp -= dmg;
      g.rpg.rep -= 1;
      if (p.hp <= 0) {
        this.knock(p, fx * 4, fz * 4, false);
        if (this.rng.chance(0.5)) g.pickups.addCash(p.pos.x + fx, p.pos.z + fz, this.rng.int(3, 12));
      } else this.flee(p, pos.x, pos.z, 6);
      this.scare(pos.x, pos.z, 12);
      return true;
    }
    return false;
  }
}
