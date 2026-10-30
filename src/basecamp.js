import * as THREE from 'three';
import { SmoothBuilder } from './smooth.js';
import { makeCat, animateCat, CATS, CAT_ORDER } from './cat.js';
import { angDiff } from './util.js';

const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });

function propsGeo() {
  // Around the stash box: a plaid blanket, food and water bowls and a scratching post.
  const b = new SmoothBuilder();
  b.rbox([-1.5, 0.015, 1.3], [1.4, 0.03, 1.1], 0.01, (x, y, z) => ((Math.floor((x + 3) * 6) + Math.floor((z + 3) * 6)) % 2 ? '#b8443a' : '#e8d8b0'));
  for (const [x, col] of [[1.6, '#c8442a'], [2.05, '#3a7ac0']]) {
    b.cylinder([x, 0.05, 1.5], 0.16, 0.12, 0.1, col, [0, 0, 0], 16);
    b.cylinder([x, 0.095, 1.5], 0.13, 0.13, 0.01, x < 2 ? '#8a5a2a' : '#7ab8e0', [0, 0, 0], 16);
  }
  b.rbox([-1.8, 0.04, -0.6], [0.5, 0.08, 0.5], 0.02, '#c8b898');
  b.cylinder([-1.8, 0.55, -0.6], 0.09, 0.09, 1.0, (x, y) => (Math.sin(y * 70) > 0 ? '#c8a878' : '#b8986a'), [0, 0, 0], 12);
  b.rbox([-1.8, 1.07, -0.6], [0.42, 0.06, 0.42], 0.02, '#c8b898');
  return b.build();
}

// Base camp: the stash, plus the two cats you're not playing as, lounging around.
// Talk to one (T) to switch to it.
export class BaseCamp {
  constructor(game) {
    this.game = game;
    const s = game.stash.pos;
    this.pos = s;
    const props = new THREE.Mesh(propsGeo(), mat);
    props.position.copy(s);
    props.castShadow = props.receiveShadow = true;
    game.scene.add(props);
    // Spots for the two lounging cats: on the cat bed, and on the blanket.
    const rot = Math.PI * 0.15, bx = 0.95, bz = 0.1;
    this.spots = [
      { x: s.x + bx * Math.cos(rot) + bz * Math.sin(rot), y: s.y + 0.09, z: s.z - bx * Math.sin(rot) + bz * Math.cos(rot), facing: 0.5 },
      { x: s.x - 1.5, y: s.y + 0.03, z: s.z + 1.3, facing: -0.4 },
    ];
    this.cats = [];
  }

  refresh() {
    for (const c of this.cats) this.game.scene.remove(c.model.group);
    const others = CAT_ORDER.filter((id) => id !== this.game.player.catId);
    this.cats = others.map((id, i) => {
      const model = makeCat(id), spot = this.spots[i];
      model.group.position.set(spot.x, spot.y, spot.z);
      model.group.rotation.y = spot.facing;
      this.game.scene.add(model.group);
      return { id, name: CATS[id].name, model, pos: model.group.position, facing: spot.facing, home: spot.facing, t: i * 3 };
    });
  }

  nearest(pos, r) {
    let best = null, bd = r;
    for (const c of this.cats) {
      const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  talk(c) {
    const g = this.game;
    const lines = ['Mrrp?', 'Mrow. *stretches*', '*slow blink*', 'Prrrrt!'];
    g.sfx.play('meow', CATS[c.id].meow);
    g.ui.showDialog([{
      name: c.name,
      text: lines[Math.floor(Math.random() * lines.length)],
      choices: [
        { label: `Play as ${c.name}`, fn: () => this.switchTo(c.id) },
        { label: 'Head bump', fn: () => g.ui.toast(`${c.name} purrs and bumps you back.`, '#ffb0c8') },
      ],
    }]);
  }

  switchTo(id) {
    const g = this.game, prev = CATS[g.player.catId].name;
    g.rpg.cat = id;
    g.player.setCat(id);
    g.ui.toast(`You're ${CATS[id].name} now. ${prev} curls up at base camp.`, '#ffd34d');
    g.save();
  }

  update(dt) {
    const p = this.game.player.pos;
    if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) > 80 || this.game.inside) return;
    for (const c of this.cats) {
      c.t += dt;
      // Lounging, with an occasional look toward you when you're close.
      const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
      const want = d < 5 ? Math.atan2(p.x - c.pos.x, p.z - c.pos.z) : c.home;
      c.facing += angDiff(c.facing, want) * Math.min(1, dt * 2);
      c.model.group.rotation.y = c.facing;
      animateCat(c.model, dt, 0, 0, 0, 1, 0, Math.max(0, Math.sin(c.t * 0.4)) > 0.98 ? 0.5 : 0);
    }
  }
}
