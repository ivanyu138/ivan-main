import * as THREE from 'three';
import { makeHumanoid, animateHumanoid } from './characters.js';
import { lotRect, groundHeight } from './world.js';
import { angDiff, RNG } from './util.js';

export const NPC_DEFS = {
  rosa: {
    name: 'Mayor Rosa',
    look: { skin: '#c68b5e', hair: '#1a1a1a', shirt: '#7a2a4a', pants: '#2a2a3a' },
    at: (w) => ({ x: w.pois.townhall.door.x - 2, z: w.pois.townhall.door.z + 3.5 }),
    chat: ['Lovely day in Maple Heights, isn\'t it?', 'The fountain was my idea. Don\'t tell anyone it leaks.', 'Vote Rosa! ...Oh, the election\'s over? Old habits.'],
  },
  hendricks: {
    name: 'Mrs. Hendricks',
    look: { skin: '#f3d7c0', hair: '#d8d8d8', shirt: '#9ab88d', pants: '#5a4a3a' },
    at: () => {
      const L = lotRect(2, 1);
      return { x: L.x0 + 60, z: L.z0 - 1.2 };
    },
    wants: 'fish',
    chat: ['Have you tried the cherry pie at Lou\'s? Divine.', 'If you ever find a fish, bring it here. I always have treats for a good kitty.', 'In my day, cars didn\'t go this fast.', 'Whiskers sends her regards. Probably.'],
  },
  tony: {
    name: 'Tony',
    look: { skin: '#e0ac85', hair: '#2a1d14', shirt: '#e8e8e8', pants: '#3a3a3a', hat: '#c94a4a' },
    at: (w) => ({ x: w.pois.pizza.door.x, z: w.pois.pizza.door.z + 4 }),
    chat: ['Best pizza in town. Only pizza in town, but still.', 'You hungry? Slices inside.'],
  },
  vic: {
    name: 'Vic',
    look: { skin: '#8d5a3b', hair: '#1a1a1a', shirt: '#3a4a5a', pants: '#2a3448', hat: '#2a2a2a' },
    at: (w) => ({ x: w.pois.garage.door.x, z: w.pois.garage.door.z + 4 }),
    chat: ['Engines are poetry, man.', 'If you break it, I can fix it. For a price.'],
  },
  daniels: {
    name: 'Officer Daniels',
    look: { skin: '#c68b5e', hair: '#2a1d14', shirt: '#2a3a6a', pants: '#1f1f24', hat: '#1a2448' },
    at: (w) => ({ x: w.pois.police.door.x, z: w.pois.police.door.z + 4 }),
    chat: ['Keep your nose clean.', 'Slow down out there. Kids play on these streets.'],
  },
  sal: {
    name: 'Sock Sal',
    look: { skin: '#e0ac85', hair: '#9a9a9a', shirt: '#4ac9c0', pants: '#8a4ac9', shoes: '#e04848' },
    at: () => {
      const L = lotRect(0, 2);
      return { x: L.x1 + 1.2, z: L.z1 - 3 };
    },
    facing: Math.PI / 2,
    wants: 'sock',
    chat: [
      'Socks! I buy socks. Any sock. Lost socks, odd socks, chewed socks. Bring them here.',
      'Every sock has a story. Usually it is "fell behind the dryer."',
      'Five socks makes a set. Bring me a set and there\'s a bonus in it for you.',
    ],
  },
  pete: {
    name: 'Old Pete',
    look: { skin: '#f1c9a5', hair: '#e8e8e8', shirt: '#6a5a3a', pants: '#4a4a3a', hat: '#3f7a35' },
    at: (w) => ({ x: w.parks.prospect.x, z: w.parks.prospect.z }),
    chat: ['The gnomes are out there. Watching.', 'Back in my day this was all cornfields.'],
  },
};

function markerTex(ch, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  x.font = 'bold 30px "Courier New", monospace';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineWidth = 5;
  x.strokeStyle = '#000';
  x.strokeText(ch, 16, 17);
  x.fillStyle = color;
  x.fillText(ch, 16, 17);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class NPCs {
  constructor(game) {
    this.game = game;
    this.rng = new RNG(77);
    this.list = [];
    this.enemies = [];
    this.marks = {
      offer: new THREE.SpriteMaterial({ map: markerTex('!', '#ffd34d'), depthTest: false }),
      locked: new THREE.SpriteMaterial({ map: markerTex('!', '#8a8a8a'), depthTest: false }),
      turnin: new THREE.SpriteMaterial({ map: markerTex('?', '#ffd34d'), depthTest: false }),
    };
    for (const [id, def] of Object.entries(NPC_DEFS)) {
      const h = makeHumanoid(def.look);
      const at = def.at(game.world);
      h.group.position.set(at.x, groundHeight(at.x, at.z), at.z);
      const sprite = new THREE.Sprite(this.marks.offer);
      sprite.scale.set(0.7, 0.7, 1);
      sprite.position.y = 2.4;
      sprite.renderOrder = 10;
      h.group.add(sprite);
      game.scene.add(h.group);
      const home = def.facing ?? Math.PI;
      h.group.rotation.y = home;
      this.list.push({ id, def, h, pos: h.group.position, facing: home, home, sprite, phase: this.rng.range(0, 6), chatI: 0 });
    }
    this.barBg = new THREE.MeshBasicMaterial({ color: '#400', depthTest: false });
    this.barFg = new THREE.MeshBasicMaterial({ color: '#e33', depthTest: false });
  }

  get(id) {
    return this.list.find((n) => n.id === id);
  }

  nearest(pos, maxD) {
    let best = null, bd = maxD;
    for (const n of this.list) {
      const d = Math.hypot(n.pos.x - pos.x, n.pos.z - pos.z);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  spawnEnemy(x, z, tag) {
    const h = makeHumanoid({ skin: this.rng.pick(['#e0ac85', '#c68b5e', '#f1c9a5']), hair: '#1a1a1a', shirt: '#3a3a3a', pants: '#2a2a3a', bandana: '#c02020' });
    h.group.position.set(x, groundHeight(x, z), z);
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.1), this.barBg);
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.1), this.barFg);
    bg.renderOrder = fg.renderOrder = 11;
    fg.position.z = 0.001;
    bar.add(bg, fg);
    bar.position.y = 2.15;
    h.group.add(bar);
    this.game.scene.add(h.group);
    const e = { h, pos: h.group.position, tag, hp: 45, maxHp: 45, state: 'idle', cd: 1, punchT: 0, phase: 0, facing: 0, vx: 0, vz: 0, bar, fg, hx: x, hz: z, downT: 0 };
    this.enemies.push(e);
    return e;
  }

  clearEnemies(tag) {
    this.enemies = this.enemies.filter((e) => {
      if (e.tag !== tag) return true;
      this.game.scene.remove(e.h.group);
      return false;
    });
  }

  enemiesAlive(tag) {
    return this.enemies.filter((e) => e.tag === tag && e.state !== 'down').length;
  }

  hurtEnemy(e, dmg, fx, fz) {
    if (e.state === 'down') return;
    e.hp -= dmg;
    e.vx = fx * 5;
    e.vz = fz * 5;
    e.state = 'chase';
    if (e.hp <= 0) {
      e.hp = 0;
      e.state = 'down';
      e.bar.visible = false;
      this.game.rpg.addXP(30);
      this.game.ui.toast('Vandal down!', '#ffd34d');
    }
    e.fg.scale.x = Math.max(0.001, e.hp / e.maxHp);
    e.fg.position.x = -0.4 * (1 - e.hp / e.maxHp);
  }

  // A hiss knocks nearby vandals back and freezes them for a moment.
  hissAt(pos, r) {
    for (const e of this.enemies) {
      if (e.state === 'down') continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z, d = Math.hypot(dx, dz) || 1;
      if (d > r) continue;
      e.vx = (dx / d) * 7;
      e.vz = (dz / d) * 7;
      e.stunT = 1.8;
      e.state = 'chase';
    }
  }

  hitInFront(pos, fx, fz, dmg) {
    for (const e of this.enemies) {
      if (e.state === 'down') continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z, d = Math.hypot(dx, dz);
      if (d > 1.8 || (dx * fx + dz * fz) / (d || 1) < 0.35) continue;
      this.hurtEnemy(e, dmg, fx, fz);
      return true;
    }
    return false;
  }

  pushOut(q, r) {
    for (const n of this.list) {
      const dx = q.x - n.pos.x, dz = q.z - n.pos.z, d = Math.hypot(dx, dz), m = r + 0.32;
      if (d < m && d > 1e-4) {
        q.x = n.pos.x + (dx / d) * m;
        q.z = n.pos.z + (dz / d) * m;
      }
    }
    for (const e of this.enemies) {
      if (e.state === 'down') continue;
      const dx = q.x - e.pos.x, dz = q.z - e.pos.z, d = Math.hypot(dx, dz), m = r + 0.32;
      if (d < m && d > 1e-4) {
        q.x = e.pos.x + (dx / d) * m;
        q.z = e.pos.z + (dz / d) * m;
      }
    }
  }

  update(dt) {
    const g = this.game, pl = g.player, col = g.world.colliders;
    for (const n of this.list) {
      const dx = pl.pos.x - n.pos.x, dz = pl.pos.z - n.pos.z, d = Math.hypot(dx, dz);
      const want = d < 7 && !pl.vehicle ? Math.atan2(dx, dz) : n.home;
      n.facing += angDiff(n.facing, want) * Math.min(1, dt * 5);
      n.h.group.rotation.y = n.facing;
      n.phase += dt;
      animateHumanoid(n.h, 0, 0);
      n.h.armL.rotation.x = Math.sin(n.phase * 1.3) * 0.08;
      const m = g.npcMarker(n);
      n.sprite.visible = !!m;
      if (m) n.sprite.material = this.marks[m];
      n.sprite.position.y = 2.4 + Math.sin(n.phase * 3) * 0.08;
    }

    for (const e of this.enemies) {
      e.bar.quaternion.copy(g.camera.quaternion);
      e.bar.quaternion.premultiply(e.h.group.quaternion.clone().invert());
      if (e.state === 'down') {
        animateHumanoid(e.h, 0, 0, 0, true);
        continue;
      }
      // Run over by the player's car?
      if (pl.vehicle && Math.abs(pl.vehicle.speed) > 5 && Math.hypot(pl.vehicle.pos.x - e.pos.x, pl.vehicle.pos.z - e.pos.z) < 2.4) {
        this.hurtEnemy(e, 999, pl.vehicle.fx, pl.vehicle.fz);
        continue;
      }
      const dx = pl.pos.x - e.pos.x, dz = pl.pos.z - e.pos.z, d = Math.hypot(dx, dz);
      if (e.state === 'idle' && d < 20) {
        e.state = 'chase';
        g.ui.toast('"Hey! Get lost!"', '#ff8a7a');
      }
      let speed = 0;
      e.cd -= dt;
      if (e.punchT > 0) e.punchT = Math.max(0, e.punchT - dt * 3);
      e.stunT = Math.max(0, (e.stunT || 0) - dt);
      if (e.state === 'chase' && !g.dead && e.stunT <= 0) {
        const tx = pl.vehicle ? e.hx : pl.pos.x, tz = pl.vehicle ? e.hz : pl.pos.z;
        const ex = tx - e.pos.x, ez = tz - e.pos.z, ed = Math.hypot(ex, ez);
        e.facing += angDiff(e.facing, Math.atan2(ex, ez)) * Math.min(1, dt * 8);
        if (ed > 1.15) {
          speed = 3.7;
          e.pos.x += (ex / ed) * speed * dt;
          e.pos.z += (ez / ed) * speed * dt;
        } else if (!pl.vehicle && e.cd <= 0) {
          e.cd = 1.25;
          e.punchT = 1;
          g.rpg.damage(6);
          g.sfx.play('punch');
          g.cam.shake = 0.15;
        }
      }
      e.pos.x += e.vx * dt;
      e.pos.z += e.vz * dt;
      e.vx *= Math.exp(-dt * 8);
      e.vz *= Math.exp(-dt * 8);
      col.resolveCircle(e.pos, 0.35, 0.5);
      for (const o of this.enemies) {
        if (o === e || o.state === 'down') continue;
        const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, od = Math.hypot(ox, oz);
        if (od < 0.7 && od > 1e-4) {
          e.pos.x = o.pos.x + (ox / od) * 0.7;
          e.pos.z = o.pos.z + (oz / od) * 0.7;
        }
      }
      e.pos.y = groundHeight(e.pos.x, e.pos.z);
      e.phase += dt * 10 * (speed > 0 ? 1 : 0);
      e.h.group.rotation.y = e.facing;
      animateHumanoid(e.h, e.phase, speed > 0 ? 1 : 0, e.punchT);
    }
  }
}
