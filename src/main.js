import * as THREE from 'three';
import { World, CURB, groundHeight, roadPos } from './world.js';
import { DayNight } from './sky.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { RPG, SHOPS, SKILL_MAX } from './rpg.js';
import { Player } from './player.js';
import { CameraRig } from './camera.js';
import { Traffic } from './vehicles.js';
import { Pedestrians } from './peds.js';
import { NPCs } from './npcs.js';
import { Pickups } from './pickups.js';
import { Quests, QUESTS } from './quests.js';
import { Sfx } from './audio.js';
import { CatSelect } from './select.js';

const SAVE_KEY = 'mapleheights_save_v1';
const PX_KEY = 'mapleheights_px';

function store(key, val) {
  try {
    if (val === undefined) return localStorage.getItem(key);
    if (val === null) localStorage.removeItem(key);
    else localStorage.setItem(key, val);
  } catch {
    return null;
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 430);
    this.time = 0;
    this.modal = null;
    this.dead = false;
    this.state = 'title';
    this.hadLock = false;
    this.pixelScale = Number(store(PX_KEY)) || 3;

    this.sfx = new Sfx();
    this.world = new World(this.scene);
    this.sky = new DayNight(this);
    this.input = new Input(this.canvas);
    this.ui = new UI(this);
    this.rpg = new RPG(this);
    this.player = new Player(this);
    this.cam = new CameraRig(this.camera, this);
    this.cam.shake = 0;
    this.traffic = new Traffic(this);
    this.peds = new Pedestrians(this);
    this.npcs = new NPCs(this);
    this.pickups = new Pickups(this);
    this.quests = new Quests(this);
    this.select = new CatSelect();

    this.toSpawn();
    if (!this.load()) this.pickups.initGnomes([]);

    addEventListener('resize', () => this.resize());
    this.resize();
    this.setupMenus();
    this.saveTimer = 20;
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  toSpawn() {
    const p = this.world.plaza;
    this.player.pos.set(p.x, CURB, p.z + 18);
    this.player.facing = 0;
    this.cam.yaw = Math.PI;
  }

  resize() {
    const s = this.pixelScale, w = innerWidth, h = innerHeight;
    this.renderer.setSize(Math.max(1, Math.floor(w / s)), Math.max(1, Math.floor(h / s)), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.select.resize(w / h);
  }

  // ------------------------------------------------------------ menus

  setupMenus() {
    const title = document.getElementById('title'), pause = document.getElementById('pause');
    const play = document.getElementById('btn-play'), fresh = document.getElementById('btn-new');
    const hasSave = !!store(SAVE_KEY);
    play.textContent = hasSave ? 'CONTINUE' : 'PLAY';
    fresh.style.display = hasSave ? '' : 'none';
    const lock = () => {
      try {
        const r = this.canvas.requestPointerLock();
        if (r && r.catch) r.catch(() => {});
      } catch { /* pointer lock unavailable: mouse-drag look still works */ }
    };
    const hud = document.getElementById('ui'), changeCat = document.getElementById('btn-cat');
    hud.style.display = 'none';
    changeCat.style.display = hasSave ? '' : 'none';
    const start = (first) => {
      title.style.display = 'none';
      hud.style.display = '';
      this.sfx.unlock();
      this.state = 'play';
      lock();
      if (first) this.ui.toast('Talk to Mayor Rosa (the yellow !) to get started', '#ffd34d');
    };
    const pickCat = (first) => {
      title.style.display = 'none';
      this.sfx.unlock();
      this.state = 'select';
      this.select.open(this.rpg.cat, (id) => {
        this.rpg.cat = id;
        this.player.setCat(id);
        this.save();
        start(first);
      });
    };
    play.onclick = () => (hasSave ? start(false) : pickCat(true));
    fresh.onclick = () => {
      this.newGame();
      pickCat(true);
    };
    changeCat.onclick = () => pickCat(false);
    pause.onclick = () => {
      pause.style.display = 'none';
      this.state = 'play';
      lock();
    };
    this.canvas.addEventListener('click', () => {
      if (this.state === 'play' && !this.input.locked) lock();
    });
    document.addEventListener('pointerlockchange', () => {
      if (this.input.locked) this.hadLock = true;
      else if (this.state === 'play' && this.hadLock) {
        this.state = 'paused';
        pause.style.display = 'flex';
        this.save();
      }
    });
  }

  newGame() {
    store(SAVE_KEY, null);
    for (const id of Object.keys(QUESTS)) {
      this.quests.cleanup(id);
      this.quests.state[id] = { status: 'available', stage: 0, data: {}, count: 0 };
    }
    this.quests.tracked = null;
    this.rpg.reset();
    for (const c of this.traffic.cars) c.owned = false;
    if (this.player.vehicle) this.exitCar();
    this.pickups.initGnomes([]);
    this.sky.time = 9;
    this.toSpawn();
  }

  // ------------------------------------------------------------ save / load

  save() {
    const p = this.player.pos, car = this.traffic.cars.find((c) => c.owned);
    const data = {
      v: 1, rpg: this.rpg.serialize(), quests: this.quests.serialize(), pos: [p.x, p.z], time: this.sky.time,
      car: car && { type: car.type, color: car.color, x: car.pos.x, z: car.pos.z, h: car.heading, hp: car.hp },
    };
    store(SAVE_KEY, JSON.stringify(data));
  }

  load() {
    let d;
    try {
      d = JSON.parse(store(SAVE_KEY));
    } catch {
      return false;
    }
    if (!d || d.v !== 1) return false;
    this.rpg.load(d.rpg);
    this.quests.load(d.quests);
    this.player.pos.set(d.pos[0], groundHeight(d.pos[0], d.pos[1]), d.pos[1]);
    this.sky.time = d.time ?? 9;
    if (d.car) {
      const c = this.traffic.addCar(d.car.type, d.car.color, d.car.x, d.car.z, d.car.h);
      c.owned = true;
      c.hp = d.car.hp ?? 100;
    }
    this.pickups.initGnomes(this.rpg.gnomes);
    this.player.setCat(this.rpg.cat || 'ginger');
    return true;
  }

  // ------------------------------------------------------------ actions

  talk(npc) {
    const q = this.quests, name = npc.def.name, page = (text) => ({ name, text });
    const turnIn = q.talkTarget(npc.id);
    if (turnIn) {
      this.ui.showDialog(QUESTS[turnIn].outro.map(page), () => q.advance(turnIn));
      return;
    }
    const offer = q.offerFor(npc.id);
    if (offer) {
      const d = QUESTS[offer];
      if (this.rpg.level < d.level) {
        this.ui.showDialog([page(`Come back when you've got a little more experience. (Requires level ${d.level})`)]);
        return;
      }
      const pages = d.intro.map(page);
      pages.push({
        name, text: `Quest: ${d.title}${q.state[offer].count ? ' (repeat)' : ''}`,
        choices: [{ label: 'Accept', fn: () => q.accept(offer) }, { label: 'Not now', fn: () => {} }],
      });
      this.ui.showDialog(pages);
      return;
    }
    const mine = q.active().find((id) => QUESTS[id].giver === npc.id);
    if (mine) {
      this.ui.showDialog([page(`Don't forget: ${q.stageOf(mine).text.toLowerCase()}.`)]);
      return;
    }
    const lines = npc.def.chat;
    this.ui.showDialog([page(lines[npc.chatI++ % lines.length])]);
  }

  pickUp(item) {
    this.pickups.remove(item);
    if (item.quest === 'cat') {
      this.quests.state.cat.data.item = null;
      this.ui.toast('You picked up Whiskers. She purrs.', '#ffd34d');
      this.sfx.play('meow', 950);
    }
  }

  onMeow() {
    const p = this.player.pos;
    // Whiskers answers if she's within earshot, which pins down where she's hiding.
    const cat = this.quests.state.cat.data.item;
    if (cat && Math.hypot(cat.pos.x - p.x, cat.pos.z - p.z) < 45) {
      this.sfx.play('meowback', 950);
      this.quests.state.cat.data.hint = { x: cat.pos.x, z: cat.pos.z, r: 6 };
      this.ui.toast('Something meows back!', '#ffd34d');
    }
    if (this.player.vehicle) return;
    const fans = this.peds.charm(p.x, p.z, 9);
    if (fans.length && this.time - (this.lastTip || -99) > 25 && Math.random() < 0.4) {
      this.lastTip = this.time;
      const f = fans[0];
      this.ui.toast('"Aww, what a cute kitty!"', '#ffb0c8');
      this.pickups.addCash((f.pos.x + p.x) / 2, (f.pos.z + p.z) / 2, 2 + Math.floor(Math.random() * 6));
      this.rpg.rep += 1;
    }
  }

  enterCar(car) {
    if (car.mode === 'ai') {
      const lx = Math.cos(car.heading), lz = -Math.sin(car.heading);
      this.peds.spawnFleeing(car.pos.x + lx * 2, car.pos.z + lz * 2, car.pos.x, car.pos.z);
      this.rpg.rep -= 2;
      this.ui.toast('Carjacked! (-2 rep)', '#ff8a7a');
      car.speed *= 0.2;
    }
    car.mode = 'player';
    this.player.vehicle = car;
    this.cam.idle = 2;
    this.sfx.play('door');
  }

  exitCar() {
    const c = this.player.vehicle, lx = Math.cos(c.heading), lz = -Math.sin(c.heading);
    const off = c.spec.wid / 2 + 0.7;
    let px = c.pos.x + lx * off, pz = c.pos.z + lz * off;
    if (this.world.colliders.pointBlocked(px, 0.5, pz, 0.35)) {
      px = c.pos.x - lx * off;
      pz = c.pos.z - lz * off;
    }
    this.player.pos.set(px, groundHeight(px, pz), pz);
    this.player.facing = c.heading;
    this.player.vehicle = null;
    c.mode = 'parked';
    this.sfx.play('door');
  }

  shopPrice(s) {
    const lv = s.service === 'train_strength' ? this.rpg.skills.strength : s.service === 'train_stamina' ? this.rpg.skills.stamina : 1;
    return this.rpg.priceOf(s.price * lv);
  }

  buy(shopId, idx) {
    const s = SHOPS[shopId].stock[idx], r = this.rpg, ui = this.ui;
    if (!s) return;
    const price = this.shopPrice(s);
    const deny = (msg) => {
      ui.toast(msg, '#ff7a6b');
      this.sfx.play('deny');
    };
    if (r.money < price) return deny('Not enough money');
    const pay = () => {
      r.money -= price;
      this.sfx.play('buy');
    };
    if (s.item) {
      pay();
      r.addItem(s.item);
      return;
    }
    const garage = this.world.pois.garage.door;
    switch (s.service) {
      case 'heal':
        if (r.hp >= r.maxHp) return deny("You're already in perfect health");
        pay();
        r.hp = r.maxHp;
        ui.toast('Fully healed', '#cfe8b0');
        break;
      case 'train_strength':
      case 'train_stamina': {
        const k = s.service === 'train_strength' ? 'strength' : 'stamina';
        if (r.skills[k] >= SKILL_MAX) return deny('Already maxed out');
        pay();
        r.skills[k]++;
        ui.toast(`${k[0].toUpperCase() + k.slice(1)} is now ${r.skills[k]}`, '#9fd0ff');
        break;
      }
      case 'repair': {
        const car = this.traffic.cars.find(
          (c) => (c.owned || c === this.lastCar) && Math.hypot(c.pos.x - garage.x, c.pos.z - garage.z) < 30,
        );
        if (!car) return deny('Park your car out front first');
        if (car.hp >= 100) return deny('That car is in great shape');
        pay();
        car.hp = 100;
        ui.toast('Car repaired', '#cfe8b0');
        break;
      }
      case 'buy_sedan':
      case 'buy_sports': {
        pay();
        for (const c of this.traffic.cars) c.owned = false;
        const sports = s.service === 'buy_sports';
        const c = this.traffic.addCar(sports ? 'sports' : 'sedan', sports ? '#e03030' : '#5d7d9e', garage.x + 10, roadPos(11) + 4.5, Math.PI / 2);
        c.owned = true;
        ui.closePanel();
        ui.toast(`Your new ${c.spec.name} is parked out front!`, '#ffd34d');
        this.save();
        break;
      }
    }
  }

  die() {
    this.dead = true;
    this.deadT = 3.5;
    this.ui.showDead(true);
    this.ui.closeDialog();
    this.ui.closePanel();
    if (this.player.vehicle) this.exitCar();
    this.quests.failTimed('you were knocked out');
  }

  respawn() {
    const door = this.world.pois.clinic.door, r = this.rpg;
    this.dead = false;
    this.ui.showDead(false);
    this.player.pos.set(door.x, CURB, door.z - 1);
    this.player.facing = Math.PI;
    this.cam.yaw = 0;
    r.hp = r.maxHp;
    const lost = Math.floor(r.money * 0.1);
    r.money -= lost;
    this.ui.toast(`You wake up at St. Mercy Clinic. Medical bill: $${lost}`, '#ff8a7a');
  }

  // ------------------------------------------------------------ loop

  handleKeys() {
    const inp = this.input, ui = this.ui, p = this.player;
    if (inp.pressed('KeyP')) {
      this.pixelScale = (this.pixelScale % 4) + 1;
      store(PX_KEY, String(this.pixelScale));
      this.resize();
      ui.toast(`Pixel size: ${this.pixelScale}x`);
    }
    if (this.modal === 'dialog') return ui.dialogInput(inp);
    if (this.modal === 'panel') return ui.panelInput(inp);
    if (this.dead) return;

    if (inp.pressed('Tab')) return ui.openPanel('log');
    if (inp.pressed('KeyI')) return ui.openPanel('inv');
    if (inp.pressed('KeyC')) return ui.openPanel('char');
    if (inp.pressed('KeyM')) return ui.openPanel('map');
    const n = inp.digit();
    if (n && ui.hotbarItems && ui.hotbarItems[n - 1]) this.rpg.useItem(ui.hotbarItems[n - 1]);

    if (p.vehicle) {
      ui.prompt('');
      if (inp.pressed('KeyF') || inp.pressed('KeyE')) {
        this.lastCar = p.vehicle;
        this.exitCar();
      }
      if (inp.pressed('KeyH')) {
        this.sfx.play('horn');
        this.peds.scare(p.pos.x, p.pos.z, 10);
      }
      return;
    }

    let text = '', action = null;
    const item = this.pickups.nearestInteractable(p.pos, 2);
    const npc = this.npcs.nearest(p.pos, 2.6);
    const poi = Object.values(this.world.pois).find((q) => q.shop && Math.hypot(q.door.x - p.pos.x, q.door.z - p.pos.z) < 2.6);
    if (item) {
      text = `[E] ${item.interact}`;
      action = () => this.pickUp(item);
    } else if (npc) {
      text = `[E] Talk to ${npc.def.name}`;
      action = () => this.talk(npc);
    } else if (poi) {
      text = `[E] Enter ${poi.name}`;
      action = () => {
        this.sfx.play('door');
        ui.openPanel('shop', poi.shop);
      };
    }
    const car = this.traffic.nearest(p.pos, 1.6);
    if (car) text += (text ? '\n' : '') + `[F] ${car.mode === 'ai' ? 'Carjack' : 'Get in'} ${car.owned ? 'your ' : ''}${car.spec.name}`;
    ui.prompt(text);
    if (inp.pressed('KeyE') && action) action();
    else if (inp.pressed('KeyF') && car) this.enterCar(car);
  }

  update(dt) {
    this.time += dt;
    this.handleKeys();
    if (this.dead) {
      this.deadT -= dt;
      if (this.deadT < 0) this.respawn();
    }
    this.player.update(dt);
    this.traffic.update(dt);
    this.peds.update(dt);
    this.npcs.update(dt);
    this.pickups.update(dt);
    this.quests.update(dt);
    this.rpg.update(dt);
    this.sky.update(dt, this.player.pos);
    this.cam.update(dt);
    if (this.cam.shake > 0) {
      const s = this.cam.shake;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.cam.shake = Math.max(0, s - dt * 1.5);
    }
    const car = this.player.vehicle;
    this.sfx.setEngine(!!car, car ? car.speed : 0);
    this.ui.update();
    this.saveTimer -= dt;
    if (this.saveTimer < 0) {
      this.saveTimer = 20;
      this.save();
    }
  }

  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (this.state === 'play') this.update(dt);
    else if (this.state === 'title') {
      const a = t * 0.00005, p = this.world.plaza;
      this.sky.update(0, this.player.pos);
      this.traffic.update(dt);
      this.peds.update(dt);
      this.camera.position.set(p.x + Math.cos(a) * 150, 125, p.z + Math.sin(a) * 150);
      this.camera.lookAt(p.x, 5, p.z);
    } else if (this.state === 'select') {
      this.select.update(dt, this.input);
      this.renderer.render(this.select.scene, this.select.camera);
      this.input.endFrame();
      return;
    } else this.sfx.setEngine(false, 0);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }
}

window.game = new Game();
