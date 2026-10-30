import * as THREE from 'three';
import { makeCat, animateCat, CATS } from './cat.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bubbleTex(text, color) {
  return canvasTex(128, 48, (x) => {
    x.fillStyle = '#ffffff';
    x.strokeStyle = '#000000';
    x.lineWidth = 4;
    x.beginPath();
    x.roundRect(4, 4, 120, 30, 8);
    x.moveTo(54, 34);
    x.lineTo(64, 45);
    x.lineTo(72, 34);
    x.fill();
    x.stroke();
    x.fillStyle = '#ffffff';
    x.fillRect(56, 30, 14, 5);
    x.fillStyle = color;
    x.font = 'bold 26px "Courier New", monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, 64, 20);
  });
}

const clawTex = canvasTex(32, 32, (x) => {
  x.strokeStyle = '#ffffff';
  x.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    x.beginPath();
    x.moveTo(6 + i * 8, 4);
    x.lineTo(2 + i * 8 + 6, 28);
    x.stroke();
  }
});
import { groundHeight, HALF } from './world.js';
import { angDiff, clamp } from './util.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    game.scene.add(this.root);
    this.pos = this.root.position;
    this.setCat('ginger');
    this.pos.set(0, 0.15, -2);
    this.vy = 0;
    this.facing = Math.PI;
    this.onGround = true;
    this.phase = 0;
    this.stride = 0;
    this.punchT = 0;
    this.punchCd = 0;
    this.vehicle = null;
    this.radius = 0.26;
    this.moving = false;
    this.idleT = 0;
    this.sit = 0;
    this.meowT = 0;
    this.meowCd = 0;
    this.hissT = 0;
    this.hissCd = 0;
    this.bubbles = {
      meow: new THREE.SpriteMaterial({ map: bubbleTex('Meow!', '#1a1a1a'), depthTest: false }),
      hiss: new THREE.SpriteMaterial({ map: bubbleTex('HSSS!', '#b00000'), depthTest: false }),
    };
    this.bubble = new THREE.Sprite(this.bubbles.meow);
    this.bubble.scale.set(1.3, 0.49, 1);
    this.bubble.position.y = 1.25;
    this.bubble.renderOrder = 12;
    this.bubble.visible = false;
    this.bubbleT = 0;
    this.root.add(this.bubble);
    this.claw = new THREE.Sprite(new THREE.SpriteMaterial({ map: clawTex, transparent: true, depthTest: false }));
    this.claw.scale.set(0.5, 0.5, 1);
    this.claw.renderOrder = 12;
    this.claw.visible = false;
    game.scene.add(this.claw);
  }

  say(kind) {
    this.bubble.material = this.bubbles[kind];
    this.bubble.visible = true;
    this.bubbleT = 1.3;
  }

  mouthWorld() {
    const m = this.cat.mouth;
    return { x: this.pos.x + Math.sin(this.facing) * m.z, y: this.pos.y + m.y, z: this.pos.z + Math.cos(this.facing) * m.z };
  }

  // Pick up the nearest small item in reach, carrying it crosswise in the mouth.
  grab() {
    const g = this.game, w = this.mouthWorld();
    const it = g.litter.nearest(w.x, w.z, 0.9);
    if (!it) return false;
    g.litter.take(it);
    this.carry = it;
    this.attachCarry();
    g.sfx.play('pick');
    return true;
  }

  attachCarry() {
    const m = this.cat.mouth, mesh = this.carry.mesh;
    mesh.position.set(0, m.y - 0.03, m.z + 0.02);
    mesh.rotation.set(0.15, Math.PI / 2, 0);
    mesh.scale.setScalar(1.15);
    this.cat.rig.add(mesh);
  }

  drop() {
    const it = this.carry;
    if (!it) return;
    const w = this.mouthWorld();
    this.cat.rig.remove(it.mesh);
    this.game.litter.putDown(it, w.x, w.y, w.z, this.facing);
    this.carry = null;
    this.game.sfx.play('drop');
  }

  meow() {
    const g = this.game;
    this.drop();
    this.meowCd = 0.9;
    this.meowT = 1;
    g.sfx.play('meow', CATS[this.catId].meow);
    if (!this.vehicle) this.say('meow');
    g.onMeow();
  }

  hiss() {
    const g = this.game;
    this.drop();
    this.hissCd = 2.5;
    this.hissT = 1;
    g.sfx.play('hiss');
    this.say('hiss');
    g.peds.scare(this.pos.x, this.pos.z, 11);
    g.npcs.hissAt(this.pos, 4.5);
  }

  setCat(id) {
    if (this.cat) this.root.remove(this.cat.group);
    this.catId = id;
    this.cat = makeCat(id);
    this.root.add(this.cat.group);
    if (this.carry) this.attachCarry();
  }

  canAct() {
    return !this.game.modal && !this.game.dead;
  }

  update(dt) {
    const g = this.game, inp = g.input, rpg = g.rpg;
    this.meowCd -= dt;
    this.hissCd -= dt;
    this.meowT = Math.max(0, this.meowT - dt * 2);
    this.bubbleT -= dt;
    if (this.bubbleT < 0) this.bubble.visible = false;
    if (this.claw.visible) {
      this.claw.material.opacity -= dt * 4;
      if (this.claw.material.opacity <= 0) this.claw.visible = false;
    }
    if (this.canAct() && inp.pressed('KeyQ') && this.meowCd <= 0) this.meow();
    if (this.vehicle) {
      this.root.visible = false;
      this.pos.copy(this.vehicle.pos);
      return;
    }
    this.root.visible = true;

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
      speed = sprint ? 8 + 0.35 * rpg.skills.stamina : 3.4;
      if (sprint) rpg.drainStamina(dt);
      const target = Math.atan2(mx, mz);
      this.facing += angDiff(this.facing, target) * (1 - Math.exp(-14 * dt));
    }
    this.moving = speed > 0;
    this.pos.x += mx * speed * dt;
    this.pos.z += mz * speed * dt;

    if (this.canAct() && inp.pressed('Space') && this.onGround) {
      this.vy = 6.8;
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

    if (this.canAct() && inp.pressed('KeyR') && this.hissCd <= 0) this.hiss();
    this.hissT = Math.max(0, this.hissT - dt * 1.1);

    // Scratch
    this.punchCd -= dt;
    if (this.punchT > 0) this.punchT = Math.max(0, this.punchT - dt * 3.2);
    if (this.canAct() && (inp.pressed('Mouse0') || inp.pressed('KeyJ')) && this.punchCd <= 0) {
      this.punchCd = 0.42;
      this.punchT = 1;
      g.sfx.play('scratch');
      this.claw.position.set(this.pos.x + Math.sin(this.facing) * 0.7, this.pos.y + 0.45, this.pos.z + Math.cos(this.facing) * 0.7);
      this.claw.material.opacity = 1;
      this.claw.material.rotation = Math.random() * 0.6 - 0.3;
      this.claw.visible = true;
      const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
      const dmg = 7 + rpg.skills.strength * 3;
      const hit = g.npcs.hitInFront(this.pos, fx, fz, dmg) || g.peds.hitInFront(this.pos, fx, fz, dmg);
      if (hit) g.sfx.play('punch');
    }

    this.root.rotation.y = this.facing;
    const targetStride = this.onGround ? clamp(speed / 4, 0, 1.2) : 0.2;
    this.stride += (targetStride - this.stride) * Math.min(1, dt * 10);
    this.phase += dt * (speed > 6 ? 16 : 11) * (speed > 0 ? 1 : 0);
    // Cats sit down when left alone for a few seconds.
    this.idleT = speed > 0 || !this.onGround || this.punchT > 0 || this.hissT > 0 ? 0 : this.idleT + dt;
    this.sit += ((this.idleT > 3 ? 1 : 0) - this.sit) * Math.min(1, dt * 5);
    animateCat(this.cat, dt, this.phase, this.stride, this.punchT, this.sit, Math.min(1, this.hissT * 3), this.meowT);
  }
}
