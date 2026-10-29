import * as THREE from 'three';
import { nodePos, segExists, LANE, MAIN_I } from './world.js';
import { RNG, clamp } from './util.js';

const rng = new RNG(Date.now() & 0xffff);

function pickDoors(g, from, n) {
  const doors = g.world.houseDoors, pts = [];
  let cur = from;
  for (let k = 0; k < n; k++) {
    const near = doors.filter((d) => {
      const dd = Math.hypot(d.x - cur.x, d.z - cur.z);
      return dd > 90 && dd < 330 && !pts.includes(d);
    });
    const d = rng.pick(near.length ? near : doors);
    pts.push(d);
    cur = d;
  }
  return pts;
}

function raceRoute(start, n) {
  let [i, j] = start, dir = [0, 1];
  const pts = [];
  for (let k = 0; k < n; k++) {
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => dx !== -dir[0] || dz !== -dir[1]);
    for (let t = 0; t < 20; t++) {
      const d = rng.pick(opts), len = d[0] ? 1 : rng.int(2, 4);
      let ok = true;
      for (let s = 0; s < len; s++) ok = ok && segExists(i + d[0] * s, j + d[1] * s, d[0], d[1]);
      if (!ok) continue;
      const ni = i + d[0] * len, nj = j + d[1] * len;
      i = ni;
      j = nj;
      dir = d;
      break;
    }
    pts.push(nodePos(i, j));
  }
  return pts;
}

export const QUESTS = {
  welcome: {
    title: 'Welcome to Maple Heights', giver: 'rosa', level: 1,
    intro: [
      "Well, hello there, kitty! A new resident? Welcome to Maple Heights. I'm Rosa, the mayor.",
      "Why don't you get to know the place? Walk down Main Street: pop into the Corner Bodega and Vic's Garage, then come tell me what you think.",
    ],
    outro: [
      "See? Friendly folks. Here's a little something to get you started.",
      "Mrs. Hendricks down south was looking for help, and Tony at the pizza place is always short a driver.",
    ],
    stages: [
      { type: 'goto', text: 'Visit the Corner Bodega', at: (g) => g.world.pois.mart.door, r: 4 },
      { type: 'goto', text: "Visit Vic's Garage", at: (g) => g.world.pois.garage.door, r: 4 },
      { type: 'talk', text: 'Return to Mayor Rosa', npc: 'rosa' },
    ],
    reward: { xp: 100, money: 60 },
  },
  cat: {
    title: 'Where Is Whiskers?', giver: 'hendricks', level: 1,
    intro: [
      "Oh dear, oh dear. My cat Whiskers slipped out last night and hasn't come home.",
      'She loves hiding in backyards. You\'re a cat, you know all the good hiding spots. Could you look around?',
    ],
    outro: ['Whiskers! You naughty thing. Thank you so much, dear. Take this for your trouble.'],
    stages: [
      {
        type: 'find', text: 'Search nearby backyards for Whiskers',
        setup: (g, q) => {
          const home = g.npcs.get('hendricks').pos;
          const yards = g.world.backyards.filter((y) => {
            const d = Math.hypot(y.x - home.x, y.z - home.z);
            return d > 90 && d < 260;
          });
          const y = rng.pick(yards);
          const x = y.x + rng.range(-y.w / 3, y.w / 3), z = y.z + rng.range(-y.w / 3, y.w / 3);
          q.data.item = g.pickups.add('cat', x, z, { interact: 'Pick up Whiskers', quest: 'cat' });
          q.data.hint = { x: x + rng.range(-18, 18), z: z + rng.range(-18, 18), r: 32 };
        },
        at: (g, q) => q.data.hint,
      },
      { type: 'talk', text: 'Bring Whiskers home to Mrs. Hendricks', npc: 'hendricks' },
    ],
    reward: { xp: 140, money: 80 },
  },
  pizza: {
    title: 'Pizza Rush', giver: 'tony', level: 1, repeatable: true,
    intro: [
      'Ay! My driver quit. Three pizzas, three houses, and they gotta be hot.',
      "Clock's ticking. Grab any car out there. I don't wanna know where you got it.",
    ],
    outro: ['Fantastico! Happy customers. Come back anytime you need work.'],
    stages: [
      {
        type: 'route', text: 'Deliver pizzas', label: 'Delivery', r: 4.5,
        setup: (g, q) => {
          q.data.points = pickDoors(g, g.world.pois.pizza.door, 3);
          let total = 0, prev = g.world.pois.pizza.door;
          for (const p of q.data.points) {
            total += Math.abs(p.x - prev.x) + Math.abs(p.z - prev.z);
            prev = p;
          }
          q.data.time = clamp(Math.round(35 + total / 9), 90, 260);
        },
      },
      { type: 'talk', text: 'Collect your pay from Tony', npc: 'tony' },
    ],
    reward: { xp: 120, money: 110 },
  },
  race: {
    title: 'Street Race', giver: 'vic', level: 2, repeatable: true,
    intro: ["You've got a lead foot? Prove it.", 'Hit every checkpoint before the clock runs out. Bring your own wheels.'],
    outro: ['Not bad. Not bad at all. Here\'s your cut.'],
    stages: [
      {
        type: 'goto', text: 'Get a car and drive to the starting line', r: 8, vehicle: true,
        setup: (g, q) => {
          q.data.start = { x: nodePos(MAIN_I, 12).x + LANE, z: g.world.pois.garage.door.z };
        },
        at: (g, q) => q.data.start,
      },
      {
        type: 'route', text: 'RACE! Hit every checkpoint', label: 'Checkpoint', r: 9, vehicle: true,
        setup: (g, q) => {
          q.data.points = raceRoute([MAIN_I, 12], 8);
          let total = 0, prev = q.data.start;
          for (const p of q.data.points) {
            total += Math.abs(p.x - prev.x) + Math.abs(p.z - prev.z);
            prev = p;
          }
          q.data.time = Math.round(12 + total / 17);
          g.sfx.play('levelup');
        },
      },
    ],
    reward: { xp: 220, money: 200 },
  },
  watch: {
    title: 'Neighborhood Watch', giver: 'daniels', level: 3,
    intro: [
      "Got a situation. A gang of vandals has been trashing the meadow in Maple Park.",
      "I'm short-staffed. Head over there and run them off. Don't get yourself hurt.",
    ],
    outro: ["The park's quiet again. The neighborhood owes you one."],
    stages: [
      { type: 'goto', text: 'Head to the meadow in Maple Park', at: (g) => g.world.parks.watch, r: 40 },
      {
        type: 'defeat', text: 'Run off the vandals', tag: 'watch',
        setup: (g) => {
          const c = g.world.parks.watch;
          g.npcs.clearEnemies('watch');
          for (let i = 0; i < 3; i++) g.npcs.spawnEnemy(c.x + rng.range(-12, 12), c.z + 6 + rng.range(-4, 4), 'watch');
        },
        at: (g) => g.world.parks.watch,
      },
      { type: 'talk', text: 'Report back to Officer Daniels', npc: 'daniels' },
    ],
    reward: { xp: 320, money: 180 },
  },
  gnomes: {
    title: 'The Golden Gnomes', giver: 'pete', level: 1,
    intro: [
      'Psst. Years ago I hid ten golden gnomes around the neighborhood.',
      "Backyards, parks... they glow a little, if you look close. Find all ten and I'll make it worth your while.",
    ],
    outro: ["All ten! Ha! You've got sharp eyes, kid. Here's my life savings. Well, some of it."],
    stages: [
      { type: 'collect', text: 'Find the golden gnomes', need: 10 },
      { type: 'talk', text: 'Tell Old Pete you found them all', npc: 'pete' },
    ],
    reward: { xp: 400, money: 500 },
  },
};

export class Quests {
  constructor(game) {
    this.game = game;
    this.state = {};
    for (const id of Object.keys(QUESTS)) this.state[id] = { status: 'available', stage: 0, data: {}, count: 0 };
    this.tracked = null;
    const beamMat = new THREE.MeshBasicMaterial({
      color: '#ffd34d', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 90, 10, 1, true).translate(0, 45, 0), beamMat);
    this.beam.visible = false;
    game.scene.add(this.beam);
  }

  def(id) {
    return QUESTS[id];
  }

  stageOf(id) {
    const q = this.state[id];
    return QUESTS[id].stages[q.stage];
  }

  active() {
    return Object.keys(QUESTS).filter((id) => this.state[id].status === 'active');
  }

  offerFor(npcId) {
    return Object.keys(QUESTS).find((id) => QUESTS[id].giver === npcId && this.state[id].status === 'available');
  }

  markerFor(npcId) {
    for (const id of this.active()) {
      const s = this.stageOf(id);
      if (s.type === 'talk' && s.npc === npcId) return 'turnin';
    }
    const offer = this.offerFor(npcId);
    if (!offer || this.active().includes(offer)) return null;
    return this.game.rpg.level >= QUESTS[offer].level ? 'offer' : 'locked';
  }

  accept(id) {
    const q = this.state[id];
    q.status = 'active';
    q.stage = 0;
    q.data = {};
    this.tracked = id;
    this.game.ui.toast(`New quest: ${QUESTS[id].title}`, '#ffd34d');
    this.game.sfx.play('quest');
    this.startStage(id);
  }

  startStage(id) {
    const q = this.state[id], s = this.stageOf(id);
    if (s.setup) s.setup(this.game, q);
    if (s.type === 'route') {
      q.data.idx = 0;
      q.data.timeLeft = q.data.time || s.time || 120;
    }
  }

  cleanup(id) {
    const q = this.state[id], g = this.game;
    if (q.data.item) {
      g.pickups.remove(q.data.item);
      q.data.item = null;
    }
    if (id === 'watch') g.npcs.clearEnemies('watch');
  }

  advance(id) {
    const q = this.state[id];
    q.stage++;
    if (q.stage >= QUESTS[id].stages.length) return this.complete(id);
    this.game.sfx.play('quest');
    this.startStage(id);
    this.game.save();
  }

  complete(id) {
    const g = this.game, q = this.state[id], d = QUESTS[id];
    this.cleanup(id);
    q.count++;
    q.status = d.repeatable ? 'available' : 'done';
    q.stage = 0;
    q.data = {};
    g.ui.toast(`Quest complete: ${d.title}`, '#ffd34d');
    g.rpg.addXP(d.reward.xp);
    g.rpg.addMoney(Math.round(d.reward.money * g.rpg.payMult()));
    g.rpg.rep += 5;
    if (this.tracked === id) this.tracked = this.active()[0] || null;
    g.sfx.play('levelup');
    g.save();
  }

  fail(id, why) {
    const q = this.state[id];
    this.cleanup(id);
    q.status = 'available';
    q.stage = 0;
    q.data = {};
    this.game.ui.toast(`Quest failed: ${why}`, '#ff7a6b');
    this.game.sfx.play('fail');
    if (this.tracked === id) this.tracked = this.active()[0] || null;
  }

  failTimed(why) {
    for (const id of this.active()) {
      const t = this.stageOf(id).type;
      if (t === 'route' || t === 'defeat' || (t === 'goto' && this.stageOf(id).vehicle)) this.fail(id, why);
    }
  }

  // Returns quest id whose 'talk' stage this NPC completes.
  talkTarget(npcId) {
    return this.active().find((id) => {
      const s = this.stageOf(id);
      return s.type === 'talk' && s.npc === npcId;
    });
  }

  target(id) {
    const q = this.state[id], s = this.stageOf(id), g = this.game;
    if (!s) return null;
    if (s.type === 'talk') return g.npcs.get(s.npc).pos;
    if (s.type === 'route') return q.data.points[q.data.idx];
    if (s.at) return s.at(g, q);
    return null;
  }

  update(dt) {
    const g = this.game, p = g.player.pos;
    for (const id of this.active()) {
      const q = this.state[id], s = this.stageOf(id);
      if (s.type === 'goto') {
        const t = s.at(g, q);
        if (Math.hypot(p.x - t.x, p.z - t.z) < s.r && (!s.vehicle || g.player.vehicle)) this.advance(id);
      } else if (s.type === 'route') {
        q.data.timeLeft -= dt;
        const t = q.data.points[q.data.idx];
        if (Math.hypot(p.x - t.x, p.z - t.z) < s.r && (!s.vehicle || g.player.vehicle)) {
          q.data.idx++;
          g.sfx.play('coin');
          if (q.data.idx >= q.data.points.length) {
            if (id === 'race') g.ui.toast(`Vic: "${QUESTS.race.outro[0]}"`, '#9fd0ff');
            this.advance(id);
            continue;
          }
          if (id === 'pizza') g.ui.toast('"Thanks! Keep the change."', '#cfe8b0');
          if (id === 'race') q.data.timeLeft += 2;
        }
        if (q.data.timeLeft <= 0) this.fail(id, 'out of time');
      } else if (s.type === 'find') {
        if (!q.data.item) this.advance(id);
      } else if (s.type === 'defeat') {
        if (g.npcs.enemiesAlive(s.tag) === 0) this.advance(id);
      } else if (s.type === 'collect') {
        if (g.rpg.gnomes.length >= s.need) this.advance(id);
      }
    }

    const id = this.tracked && this.state[this.tracked].status === 'active' ? this.tracked : this.active()[0];
    this.tracked = id || null;
    const t = id ? this.target(id) : null;
    this.beam.visible = !!t;
    if (t) {
      this.beam.position.set(t.x, 0, t.z);
      const r = t.r ? t.r / 3 : 1;
      this.beam.scale.set(r, 1, r);
    }
  }

  objective() {
    const id = this.tracked;
    if (!id) return null;
    const q = this.state[id], s = this.stageOf(id), g = this.game;
    let text = s.text;
    if (s.type === 'route') text += ` (${q.data.idx}/${q.data.points.length})`;
    if (s.type === 'collect') text += ` (${g.rpg.gnomes.length}/${s.need})`;
    if (s.type === 'defeat') text += ` (${g.npcs.enemiesAlive(s.tag)} left)`;
    if (s.vehicle && !g.player.vehicle) text += ' - you need a car!';
    const t = this.target(id);
    const dist = t ? Math.round(Math.hypot(t.x - g.player.pos.x, t.z - g.player.pos.z)) : null;
    return { title: QUESTS[id].title, text, dist, time: s.type === 'route' ? q.data.timeLeft : null };
  }

  serialize() {
    const out = {};
    for (const [id, q] of Object.entries(this.state)) out[id] = { status: q.status, stage: q.stage, count: q.count };
    return { state: out, tracked: this.tracked };
  }

  load(d) {
    for (const [id, q] of Object.entries(d.state || {})) {
      if (!this.state[id]) continue;
      Object.assign(this.state[id], q, { data: {} });
      // Timed or spawned stages restart from the top of the quest after a reload.
      if (q.status === 'active') {
        const s = QUESTS[id].stages[q.stage];
        if (!s || ['route', 'defeat', 'find'].includes(s.type) || id === 'race') this.state[id].stage = 0;
        this.startStage(id);
      }
    }
    this.tracked = d.tracked || null;
  }
}
