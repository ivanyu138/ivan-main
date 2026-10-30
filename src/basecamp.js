import * as THREE from 'three';
import { SmoothBuilder } from './smooth.js';
import { makeCat, animateCat, CATS, CAT_ORDER } from './cat.js';
import { angDiff } from './util.js';

const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });

// Things money can buy for base camp, cheapest first.
export const UPGRADES = [
  { id: 'mat', name: 'Welcome Mat & Sign', price: 30, desc: 'A doormat and a hand-painted BASE CAMP sign' },
  { id: 'cushion', name: 'Comfy Cushion', price: 40, desc: 'A second bed, so both your cats have somewhere soft' },
  { id: 'lights', name: 'Fairy Lights', price: 75, desc: 'Strings of colored lights across the alley' },
  { id: 'tarp', name: 'Tarp Roof', price: 90, desc: 'A blue tarp to keep the rain off' },
  { id: 'snack', name: 'Snack Station', price: 120, desc: 'Heals you to full when you visit camp (once a minute)' },
  { id: 'shelves', name: 'Treasure Shelves', price: 150, desc: 'Show off your stash: +50% XP from stash milestones' },
  { id: 'tree', name: 'Cat Tree', price: 220, desc: 'A tall cat tree; one of your cats naps on top' },
];

// Base camp layout, relative to the stash box at the back of the alley.
// The alley runs along z: the street is toward -z, the dead end toward +z.
function campGeo(owned) {
  const b = new SmoothBuilder();
  // Always there: plaid blanket, food and water bowls, scratching post.
  b.rbox([1.6, 0.015, 0.4], [1.3, 0.03, 1.1], 0.01, (x, y, z) => ((Math.floor((x + 3) * 6) + Math.floor((z + 3) * 6)) % 2 ? '#b8443a' : '#e8d8b0'));
  for (const [z, col, food] of [[-2.6, '#c8442a', '#8a5a2a'], [-2.05, '#3a7ac0', '#7ab8e0']]) {
    b.cylinder([-2.25, 0.05, z], 0.16, 0.12, 0.1, col, [0, 0, 0], 16);
    b.cylinder([-2.25, 0.095, z], 0.13, 0.13, 0.01, food, [0, 0, 0], 16);
  }
  b.rbox([2.3, 0.04, -2.4], [0.5, 0.08, 0.5], 0.02, '#c8b898');
  b.cylinder([2.3, 0.55, -2.4], 0.09, 0.09, 1.0, (x, y) => (Math.sin(y * 70) > 0 ? '#c8a878' : '#b8986a'), [0, 0, 0], 12);
  b.rbox([2.3, 1.07, -2.4], [0.42, 0.06, 0.42], 0.02, '#c8b898');

  if (owned.has('mat')) {
    b.rbox([0, 0.012, -4.6], [1.2, 0.024, 0.7], 0.01, (x, y, z) => (Math.abs(x) > 0.5 || Math.abs(z + 4.6) > 0.28 ? '#5a3a20' : '#8a6a3a'));
  }
  if (owned.has('cushion')) {
    b.add(new THREE.TorusGeometry(0.3, 0.1, 10, 22), '#c86a9a', [1.6, 0.1, 0.4], [Math.PI / 2, 0, 0]);
    b.cylinder([1.6, 0.05, 0.4], 0.28, 0.28, 0.06, '#f0e0ea', [0, 0, 0], 20);
  }
  if (owned.has('tarp')) {
    for (const [x, z] of [[-2.6, -1.4], [2.6, -1.4]]) b.cylinder([x, 1.25, z], 0.04, 0.04, 2.5, '#6a6a6a', [0, 0, 0], 6);
    b.rbox([0, 2.62, 0.4], [5.6, 0.04, 3.8], 0.01, '#2f6ac0', [-0.18, 0, 0]);
  }
  if (owned.has('snack')) {
    b.rbox([-2.25, 0.45, 0.7], [0.45, 0.7, 0.4], 0.04, '#d8d0c0');
    b.rbox([-2.25, 0.85, 0.7], [0.5, 0.08, 0.45], 0.03, '#c8442a');
    b.cylinder([-2.25, 0.05, 1.1], 0.2, 0.15, 0.1, '#c8442a', [0, 0, 0], 16);
    b.cylinder([-2.25, 0.1, 1.1], 0.17, 0.17, 0.01, '#8a5a2a', [0, 0, 0], 16);
  }
  if (owned.has('shelves')) {
    for (const y of [0.4, 0.95, 1.5]) {
      b.rbox([2.75, y, -0.9], [0.4, 0.05, 1.8], 0.01, '#8a5a32');
      for (let z = -1.6; z < -0.1; z += 0.35) b.rbox([2.75, y + 0.09, z], [0.16, 0.14, 0.14], 0.03, ['#e0b830', '#3a7ac0', '#c8442a', '#3f8a5a'][Math.floor((z + 2) * 3 + y * 2) % 4]);
    }
    for (const z of [-1.75, -0.05]) b.cylinder([2.75, 0.85, z], 0.03, 0.03, 1.7, '#5a3a20', [0, 0, 0], 6);
  }
  if (owned.has('tree')) {
    b.rbox([1.9, 0.05, 1.7], [0.9, 0.1, 0.9], 0.02, '#c8b898');
    for (const [x, z, h] of [[1.7, 1.5, 1.9], [2.15, 1.95, 1.3]]) b.cylinder([x, h / 2, z], 0.08, 0.08, h, (px, y) => (Math.sin(y * 70) > 0 ? '#c8a878' : '#b8986a'), [0, 0, 0], 10);
    b.cylinder([2.15, 1.32, 1.95], 0.3, 0.3, 0.06, '#c8b898', [0, 0, 0], 16);
    b.add(new THREE.TorusGeometry(0.28, 0.08, 8, 18), '#c8b898', [1.7, 1.95, 1.5], [Math.PI / 2, 0, 0]);
    b.cylinder([1.7, 1.92, 1.5], 0.28, 0.28, 0.05, '#e8e0d0', [0, 0, 0], 16);
  }
  return b.build();
}

function lightsGeo() {
  // Three strands of bulbs zig-zagging across the alley.
  const b = new SmoothBuilder(), cols = ['#ff6a6a', '#ffd34d', '#6ad0ff', '#8aff8a', '#ff9ae0'];
  let n = 0;
  for (const z of [-5, -2.5, 0]) {
    for (let t = 0; t <= 1.0001; t += 1 / 12) {
      const x = -2.9 + t * 5.8, y = 3.3 - Math.sin(t * Math.PI) * 0.5;
      b.sphere([x, y, z + t * 0.6], [0.05, 0.07, 0.05], cols[n++ % cols.length], 6);
    }
  }
  return b.build();
}

// Base camp: the stash, the two cats you're not playing as, and whatever upgrades you buy.
export class BaseCamp {
  constructor(game) {
    this.game = game;
    this.pos = game.stash.pos;
    this.owned = new Set();
    this.props = null;
    this.lights = null;
    this.cats = [];
    this.nextSnack = 0;
    this.sign = this.makeSign();
    this.rebuild();
  }

  makeSign() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 48;
    const x = c.getContext('2d');
    x.fillStyle = '#c8a878';
    x.fillRect(0, 0, 128, 48);
    x.fillStyle = '#5a2e14';
    x.font = 'bold 20px "Courier New", monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('BASE CAMP', 64, 25);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.52), new THREE.MeshLambertMaterial({ map: t }));
    // On the alley wall, facing in.
    m.position.set(this.pos.x - 2.95, this.pos.y + 1.6, this.pos.z - 3.5);
    m.rotation.y = Math.PI / 2;
    return m;
  }

  has(id) {
    return this.owned.has(id);
  }

  load(ids) {
    this.owned = new Set(ids || []);
    this.rebuild();
  }

  rebuild() {
    const g = this.game, s = g.scene;
    if (this.props) s.remove(this.props);
    if (this.lights) s.remove(this.lights);
    this.props = new THREE.Mesh(campGeo(this.owned), mat);
    this.props.position.copy(this.pos);
    this.props.castShadow = this.props.receiveShadow = true;
    s.add(this.props);
    if (this.has('lights')) {
      this.lights = new THREE.Mesh(lightsGeo(), glowMat);
      this.lights.position.copy(this.pos);
      s.add(this.lights);
    } else this.lights = null;
    if (this.has('mat')) s.add(this.sign);
    else s.remove(this.sign);
    if (g.player) this.refresh();
  }

  // Where the two lounging cats sit: on the cat bed by the box, and on the blanket
  // (or the cushion, or up on the cat tree once those are bought).
  spots() {
    const p = this.pos, rot = this.game.stash.rot, bx = 0.95, bz = 0.1;
    const bed = { x: p.x + bx * Math.cos(rot) + bz * Math.sin(rot), y: p.y + 0.09, z: p.z - bx * Math.sin(rot) + bz * Math.cos(rot), facing: Math.PI + 0.4 };
    const second = this.has('tree')
      ? { x: p.x + 1.7, y: p.y + 1.95, z: p.z + 1.5, facing: Math.PI - 0.3 }
      : { x: p.x + 1.6, y: p.y + (this.has('cushion') ? 0.09 : 0.03), z: p.z + 0.4, facing: Math.PI - 0.5 };
    return [bed, second];
  }

  refresh() {
    for (const c of this.cats) this.game.scene.remove(c.model.group);
    const others = CAT_ORDER.filter((id) => id !== this.game.player.catId), spots = this.spots();
    this.cats = others.map((id, i) => {
      const model = makeCat(id), spot = spots[i];
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

  buy(i) {
    const g = this.game, u = UPGRADES[i];
    if (!u) return;
    if (this.has(u.id)) return g.ui.toast('Base camp already has that', '#cfd8e6');
    if (g.rpg.money < u.price) {
      g.ui.toast(`You need $${u.price - g.rpg.money} more`, '#ff7a6b');
      return g.sfx.play('deny');
    }
    g.rpg.money -= u.price;
    this.owned.add(u.id);
    this.rebuild();
    g.sfx.play('levelup');
    g.ui.toast(`Base camp upgraded: ${u.name}!`, '#ffd34d');
    g.save();
  }

  ids() {
    return [...this.owned];
  }

  update(dt) {
    const g = this.game, p = g.player.pos;
    if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) > 80 || g.inside) return;
    for (const c of this.cats) {
      c.t += dt;
      // Lounging, with an occasional look toward you when you're close.
      const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
      const want = d < 5 ? Math.atan2(p.x - c.pos.x, p.z - c.pos.z) : c.home;
      c.facing += angDiff(c.facing, want) * Math.min(1, dt * 2);
      c.model.group.rotation.y = c.facing;
      animateCat(c.model, dt, 0, 0, 0, 1, 0, Math.max(0, Math.sin(c.t * 0.4)) > 0.98 ? 0.5 : 0);
    }
    // The snack station tops you up when you come home.
    const r = g.rpg;
    if (this.has('snack') && g.time > this.nextSnack && r.hp < r.maxHp && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 4) {
      this.nextSnack = g.time + 60;
      r.hp = r.maxHp;
      g.sfx.play('use');
      g.ui.toast('You munch at the snack station. Fully healed!', '#cfe8b0');
    }
    if (this.lights) this.lights.visible = true;
  }
}
