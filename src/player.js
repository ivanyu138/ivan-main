import { makeHumanoid, animateHumanoid } from './characters.js';
import { groundHeight, HALF } from './world.js';
import { angDiff, clamp } from './util.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.h = makeHumanoid({ skin: '#e8b48c', hair: '#3a2512', shirt: '#2f8fd0', pants: '#2a2a3a', shoes: '#f0f0f0' });
    game.scene.add(this.h.group);
    this.pos = this.h.group.position;
    this.pos.set(0, 0.15, -2);
    this.vy = 0;
    this.facing = Math.PI;
    this.onGround = true;
    this.phase = 0;
    this.stride = 0;
    this.punchT = 0;
    this.punchCd = 0;
    this.vehicle = null;
    this.radius = 0.35;
    this.moving = false;
  }

  canAct() {
    return !this.game.modal && !this.game.dead;
  }

  update(dt) {
    const g = this.game, inp = g.input, rpg = g.rpg;
    if (this.vehicle) {
      this.h.group.visible = false;
      this.pos.copy(this.vehicle.pos);
      return;
    }
    this.h.group.visible = true;

    let mx = 0, mz = 0;
    if (this.canAct()) {
      const f = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0);
      const s = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0);
      const yaw = g.cam.yaw;
      mx = -Math.sin(yaw) * f + Math.cos(yaw) * s;
      mz = -Math.cos(yaw) * f - Math.sin(yaw) * s;
    }
    const len = Math.hypot(mx, mz);
    let speed = 0;
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const sprint = (inp.down('ShiftLeft') || inp.down('ShiftRight')) && rpg.stamina > 1;
      speed = sprint ? 7.6 + 0.3 * rpg.skills.stamina : 4.2;
      if (sprint) rpg.drainStamina(dt);
      const target = Math.atan2(mx, mz);
      this.facing += angDiff(this.facing, target) * (1 - Math.exp(-14 * dt));
    }
    this.moving = speed > 0;
    this.pos.x += mx * speed * dt;
    this.pos.z += mz * speed * dt;

    if (this.canAct() && inp.pressed('Space') && this.onGround) {
      this.vy = 6.2;
      this.onGround = false;
    }
    this.vy -= 20 * dt;
    this.pos.y += this.vy * dt;
    const gh = groundHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= gh) {
      this.pos.y = gh;
      this.vy = 0;
      this.onGround = true;
    }

    g.world.colliders.resolveCircle(this.pos, this.radius, this.pos.y - gh + 0.3);
    g.traffic.pushOut(this.pos, this.radius);
    g.peds.pushOut(this.pos, this.radius);
    g.npcs.pushOut(this.pos, this.radius);
    const lim = HALF + 6;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);

    // Punch
    this.punchCd -= dt;
    if (this.punchT > 0) this.punchT = Math.max(0, this.punchT - dt * 3.2);
    if (this.canAct() && (inp.pressed('Mouse0') || inp.pressed('KeyJ')) && this.punchCd <= 0) {
      this.punchCd = 0.42;
      this.punchT = 1;
      g.sfx.play('swing');
      const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
      const dmg = 7 + rpg.skills.strength * 3;
      const hit = g.npcs.hitInFront(this.pos, fx, fz, dmg) || g.peds.hitInFront(this.pos, fx, fz, dmg);
      if (hit) g.sfx.play('punch');
    }

    this.h.group.rotation.y = this.facing;
    const targetStride = this.onGround ? clamp(speed / 5, 0, 1.2) : 0.3;
    this.stride += (targetStride - this.stride) * Math.min(1, dt * 10);
    this.phase += dt * (speed > 6 ? 13 : 9) * (speed > 0 ? 1 : 0);
    animateHumanoid(this.h, this.phase, this.stride, this.punchT);
  }
}
