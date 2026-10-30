import { MAP_EXT, MAP_PX, HALF } from './world.js';
import { ITEMS, SHOPS, SKILLS, SKILL_MAX } from './rpg.js';
import { QUESTS } from './quests.js';
import { NPC_DEFS } from './npcs.js';
import { CATS } from './cat.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const ITEM_ORDER = Object.keys(ITEMS);

function houseIcon(x, cx, cy) {
  x.fillStyle = '#000';
  x.beginPath();
  x.moveTo(cx - 7, cy);
  x.lineTo(cx, cy - 7);
  x.lineTo(cx + 7, cy);
  x.lineTo(cx + 5, cy);
  x.lineTo(cx + 5, cy + 6);
  x.lineTo(cx - 5, cy + 6);
  x.lineTo(cx - 5, cy);
  x.closePath();
  x.fill();
  x.fillStyle = '#e8c890';
  x.beginPath();
  x.moveTo(cx - 5, cy - 0.5);
  x.lineTo(cx, cy - 5);
  x.lineTo(cx + 5, cy - 0.5);
  x.lineTo(cx + 3.5, cy - 0.5);
  x.lineTo(cx + 3.5, cy + 4.5);
  x.lineTo(cx - 3.5, cy + 4.5);
  x.lineTo(cx - 3.5, cy - 0.5);
  x.closePath();
  x.fill();
}

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      lvl: $('lvl'), money: $('money'), clock: $('clock'),
      hp: document.querySelector('.bar.hp .fill'), xp: document.querySelector('.bar.xp .fill'),
      objective: $('objective'), toasts: $('toasts'), prompt: $('prompt'), hotbar: $('hotbar'), speedo: $('speedo'),
      dialog: $('dialog'), panel: $('panel'), dead: $('dead'),
    };
    this.mm = $('minimap');
    this.mmCtx = this.mm.getContext('2d');
    this.cache = {};
    this.dialog = null;
    this.panel = null;
    this.flashEl = document.createElement('div');
    Object.assign(this.flashEl.style, { position: 'absolute', inset: '0', background: '#d8463c', opacity: '0', transition: 'opacity 0.25s' });
    $('ui').prepend(this.flashEl);
  }

  set(key, el, html) {
    if (this.cache[key] === html) return;
    this.cache[key] = html;
    el.innerHTML = html;
  }

  toast(text, color = '#fff') {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.color = color;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 5) this.el.toasts.firstChild.remove();
    setTimeout(() => (d.style.opacity = '0'), 2800);
    setTimeout(() => d.remove(), 3500);
  }

  flash(strength = 0.35) {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = String(strength);
    requestAnimationFrame(() => {
      this.flashEl.style.transition = 'opacity 0.4s';
      this.flashEl.style.opacity = '0';
    });
  }

  prompt(text) {
    this.set('prompt', this.el.prompt, esc(text || ''));
  }

  // ------------------------------------------------------------ HUD

  update() {
    const g = this.game, r = g.rpg;
    this.set('lvl', this.el.lvl, `LV ${r.level}`);
    this.set('money', this.el.money, `$${r.money}`);
    this.set('clock', this.el.clock, g.sky.clock);
    this.el.hp.style.width = `${(100 * r.hp) / r.maxHp}%`;
    this.el.xp.style.width = `${(100 * r.xp) / r.xpNext}%`;

    const o = g.quests.objective();
    let html = '';
    if (o) {
      html = `<div class="q">${esc(o.title)}</div><div>${esc(o.text)}</div>`;
      if (o.dist != null) html += `<div class="dim">${o.dist} m</div>`;
      if (o.time != null) html += `<div class="t">${Math.max(0, Math.ceil(o.time))}s</div>`;
    } else html = '<div class="dim">No active quest &mdash; look for <b style="color:#ffd34d">!</b> on the map</div>';
    if (r.boostT > 0) html += `<div style="color:#7ae6ff">Speed boost: ${Math.ceil(r.boostT)}s</div>`;
    if (r.skillPoints > 0) html += `<div style="color:#9fd0ff">Skill point available [C]</div>`;
    this.set('obj', this.el.objective, html);

    const car = g.player.vehicle;
    this.set('speedo', this.el.speedo, car ? `${Math.round(Math.abs(car.speed) * 2.237)}<small>MPH &middot; ${car.spec.name} &middot; ${Math.round(car.hp)}%</small>` : '');

    const slots = ITEM_ORDER.filter((id) => r.inventory[id]).slice(0, 5);
    this.hotbarItems = slots;
    this.set('hot', this.el.hotbar, slots.map((id, i) => `<div class="slot"><b>${i + 1}</b> ${esc(ITEMS[id].name)}<span class="n">${r.inventory[id]}</span></div>`).join(''));

    this.drawMinimap();
  }

  drawMinimap() {
    const g = this.game, x = this.mmCtx, W = this.mm.width, R = W / 2;
    const p = g.player.pos, yaw = g.cam.yaw;
    const ppm = g.player.vehicle ? 0.42 : 0.75;
    x.save();
    x.fillStyle = '#3f6a30';
    x.fillRect(0, 0, W, W);
    x.beginPath();
    x.arc(R, R, R, 0, Math.PI * 2);
    x.clip();
    x.translate(R, R);
    x.rotate(yaw);
    const k = ppm / MAP_PX;
    x.scale(k, k);
    x.imageSmoothingEnabled = false;
    x.drawImage(g.world.mapCanvas, -(p.x + MAP_EXT) * MAP_PX, -(p.z + MAP_EXT) * MAP_PX);
    x.restore();

    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const to = (wx, wz, clampR = R - 7) => {
      const dx = (wx - p.x) * ppm, dz = (wz - p.z) * ppm;
      let rx = dx * cos - dz * sin, rz = dx * sin + dz * cos;
      const l = Math.hypot(rx, rz);
      const out = l > clampR;
      if (out) {
        rx *= clampR / l;
        rz *= clampR / l;
      }
      return [R + rx, R + rz, out];
    };
    x.font = 'bold 10px monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    for (const poi of Object.values(g.world.pois)) {
      if (!poi.shop && poi.id !== 'police' && poi.id !== 'townhall') continue;
      const [mx, my, out] = to(poi.door.x, poi.door.z);
      if (out) continue;
      x.fillStyle = '#000';
      x.fillRect(mx - 5, my - 5, 10, 10);
      x.fillStyle = poi.color;
      x.fillRect(mx - 4, my - 4, 8, 8);
      x.fillStyle = '#fff';
      x.fillText(poi.name[0], mx, my + 1);
    }
    for (const n of g.npcs.list) {
      const m = g.npcMarker(n);
      if (!m) continue;
      const [mx, my] = to(n.pos.x, n.pos.z);
      x.fillStyle = m === 'locked' ? '#8a8a8a' : '#ffd34d';
      x.strokeStyle = '#000';
      x.lineWidth = 3;
      x.font = 'bold 14px monospace';
      x.strokeText(m === 'turnin' ? '?' : '!', mx, my);
      x.fillText(m === 'turnin' ? '?' : '!', mx, my);
    }
    // Home base: a little house icon.
    {
      const [hx, hy, out] = to(g.stash.pos.x, g.stash.pos.z);
      if (!out) houseIcon(x, hx, hy);
    }
    for (const c of g.traffic.cars) {
      if (!c.owned) continue;
      const [mx, my] = to(c.pos.x, c.pos.z);
      x.fillStyle = '#4fa3e8';
      x.fillRect(mx - 3, my - 3, 6, 6);
    }
    for (const a of g.animals.attackers()) {
      const [mx, my] = to(a.pos.x, a.pos.z);
      x.fillStyle = a.kind === 'cat' ? '#e33' : '#e8a040';
      x.beginPath();
      x.arc(mx, my, 3, 0, Math.PI * 2);
      x.fill();
    }
    for (const e of g.npcs.enemies) {
      if (e.state === 'down') continue;
      const [mx, my] = to(e.pos.x, e.pos.z);
      x.fillStyle = '#e33';
      x.fillRect(mx - 2.5, my - 2.5, 5, 5);
    }
    const id = g.quests.tracked, t = id && g.quests.target(id);
    if (t) {
      if (t.r) {
        const [mx, my] = to(t.x, t.z, 1e9);
        x.fillStyle = '#ffd34d33';
        x.beginPath();
        x.arc(mx, my, t.r * ppm, 0, Math.PI * 2);
        x.fill();
      }
      const [mx, my] = to(t.x, t.z);
      x.fillStyle = '#000';
      x.beginPath();
      x.arc(mx, my, 6, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#ffd34d';
      x.beginPath();
      x.arc(mx, my, 4, 0, Math.PI * 2);
      x.fill();
    }
    // North marker
    const [nx, ny] = to(p.x, p.z - 1e5, R - 9);
    x.font = 'bold 12px monospace';
    x.strokeStyle = '#000';
    x.lineWidth = 3;
    x.strokeText('N', nx, ny);
    x.fillStyle = '#fff';
    x.fillText('N', nx, ny);
    // Player arrow
    const f = g.player.vehicle ? g.player.vehicle.heading : g.player.facing;
    const ang = Math.atan2(Math.sin(f) * sin + Math.cos(f) * cos, Math.sin(f) * cos - Math.cos(f) * sin);
    x.save();
    x.translate(R, R);
    x.rotate(ang);
    x.beginPath();
    x.moveTo(7, 0);
    x.lineTo(-5, -5);
    x.lineTo(-2, 0);
    x.lineTo(-5, 5);
    x.closePath();
    x.fillStyle = '#fff';
    x.strokeStyle = '#000';
    x.lineWidth = 2;
    x.fill();
    x.stroke();
    x.restore();
  }

  // ------------------------------------------------------------ dialog

  // pages: [{ name, text, choices?: [{ label, fn }] }]
  showDialog(pages, onDone) {
    this.dialog = { pages, i: 0, onDone };
    this.game.modal = 'dialog';
    this.renderDialog();
  }

  renderDialog() {
    const d = this.dialog, p = d.pages[d.i], el = this.el.dialog;
    el.style.display = 'block';
    el.querySelector('.name').textContent = p.name || '';
    el.querySelector('.text').textContent = p.text;
    el.querySelector('.opts').innerHTML = p.choices
      ? p.choices.map((c, i) => `<span class="k">[${i + 1}]</span> ${esc(c.label)}`).join('&nbsp;&nbsp;&nbsp;')
      : '<span class="k">[T]</span> continue';
  }

  dialogInput(inp) {
    const d = this.dialog, p = d.pages[d.i];
    if (p.choices) {
      const n = inp.digit();
      if (n && p.choices[n - 1]) {
        this.closeDialog();
        p.choices[n - 1].fn();
      } else if (inp.pressed('Escape') || inp.pressed('Backspace')) this.closeDialog();
      return;
    }
    if (inp.pressed('KeyT') || inp.pressed('Enter') || inp.pressed('Space') || inp.pressed('Mouse0')) {
      d.i++;
      if (d.i >= d.pages.length) {
        const cb = d.onDone;
        this.closeDialog();
        if (cb) cb();
      } else this.renderDialog();
    }
  }

  closeDialog() {
    this.dialog = null;
    this.el.dialog.style.display = 'none';
    if (this.game.modal === 'dialog') this.game.modal = null;
  }

  // ------------------------------------------------------------ panels

  openPanel(type, arg) {
    this.panel = { type, arg };
    this.game.modal = 'panel';
    this.el.panel.style.display = 'block';
    this.renderPanel();
  }

  closePanel() {
    this.panel = null;
    this.el.panel.style.display = 'none';
    this.el.panel.classList.remove('wide');
    this.cache.panel = null;
    if (this.game.modal === 'panel') this.game.modal = null;
  }

  renderPanel() {
    const g = this.game, r = g.rpg, P = this.panel;
    let h = '';
    this.el.panel.classList.toggle('wide', P.type === 'map');
    if (P.type === 'shop') {
      const shop = SHOPS[P.arg];
      h = `<h2>${esc(shop.title)}</h2><div class="dim">You have $${r.money}</div><h3>For sale</h3>`;
      shop.stock.forEach((s, i) => {
        const label = s.item ? `${ITEMS[s.item].name} <span class="dim">(${ITEMS[s.item].desc})</span>` : esc(s.label);
        const own = s.item && r.inventory[s.item] ? ` <span class="dim">x${r.inventory[s.item]}</span>` : '';
        h += `<div class="item"><span><span class="k">[${i + 1}]</span> ${label}${own}</span><span>$${g.shopPrice(s)}</span></div>`;
      });
      h += `<div class="foot">Press a number to buy &middot; T / Esc to leave</div>`;
    } else if (P.type === 'inv') {
      h = '<h2>Inventory</h2>';
      const ids = ITEM_ORDER.filter((id) => r.inventory[id]);
      if (!ids.length) h += '<div class="dim">Your pockets are empty.</div>';
      ids.forEach((id, i) => {
        h += `<div class="item"><span><span class="k">[${i + 1}]</span> ${ITEMS[id].name} <span class="dim">${ITEMS[id].desc}</span></span><span>x${r.inventory[id]}</span></div>`;
      });
      h += `<h3>Collection</h3><div>Golden gnomes: ${r.gnomes.length}/10</div><div>Treasures in your stash: ${g.stash.kinds.length}</div><div>Fish given to Mrs. Hendricks: ${r.fishGiven}</div><div>Socks sold to Sal: ${r.socksSold}</div>`;
      h += `<div class="foot">Number to use &middot; I / Esc to close</div>`;
    } else if (P.type === 'char') {
      h = `<h2>${CATS[r.cat] ? CATS[r.cat].name : 'Character'}</h2>
        <div class="item"><span>Level</span><span>${r.level}</span></div>
        <div class="item"><span>XP</span><span>${r.xp} / ${r.xpNext}</span></div>
        <div class="item"><span>Health</span><span>${Math.ceil(r.hp)} / ${r.maxHp}</span></div>
        <div class="item"><span>Money</span><span>$${r.money}</span></div>
        <div class="item"><span>Neighborhood rep</span><span>${r.rep}</span></div>
        <h3>Skills &mdash; ${r.skillPoints} point${r.skillPoints === 1 ? '' : 's'} to spend</h3>`;
      Object.entries(SKILLS).forEach(([k, s], i) => {
        const lv = r.skills[k];
        const pips = '&#9632;'.repeat(lv) + '<span class="dim">' + '&#9632;'.repeat(SKILL_MAX - lv) + '</span>';
        h += `<div class="item"><span><span class="k">[${i + 1}]</span> ${s.name} <span class="dim">${s.desc}</span></span><span>${pips}</span></div>`;
      });
      h += `<div class="foot">Number to spend a point &middot; C / Esc to close</div>`;
    } else if (P.type === 'log') {
      const act = g.quests.active();
      h = '<h2>Quest Log</h2><h3>Active</h3>';
      if (!act.length) h += '<div class="dim">None</div>';
      act.forEach((id, i) => {
        const o = g.quests.stageOf(id);
        h += `<div class="item"><span><span class="k">[${i + 1}]</span> ${esc(QUESTS[id].title)}${g.quests.tracked === id ? ' <span class="k">&#9733;</span>' : ''}<br><span class="dim">${esc(o.text)}</span></span></div>`;
      });
      h += '<h3>Available</h3>';
      for (const [id, q] of Object.entries(QUESTS)) {
        const s = g.quests.state[id];
        if (s.status !== 'available') continue;
        const lock = r.level < q.level ? ` <span class="dim">(level ${q.level})</span>` : '';
        h += `<div class="item"><span>${esc(q.title)}${lock}</span><span class="dim">${esc(NPC_DEFS[q.giver].name)}</span></div>`;
      }
      const done = Object.keys(QUESTS).filter((id) => g.quests.state[id].count > 0);
      if (done.length) {
        h += '<h3>Completed</h3>';
        for (const id of done) h += `<div class="item dim"><span>${esc(QUESTS[id].title)}</span><span>x${g.quests.state[id].count}</span></div>`;
      }
      h += `<div class="foot">Number to track a quest &middot; Tab / Esc to close</div>`;
    } else if (P.type === 'map') {
      h = '<h2>Maple Heights</h2><canvas id="bigmap" width="720" height="720"></canvas><div class="foot">M / Esc to close &middot; yellow = objective, ! = quest, squares = shops</div>';
    }
    this.set('panel', this.el.panel, h);
    if (P.type === 'map') this.drawBigMap();
  }

  drawBigMap() {
    const g = this.game, c = $('bigmap'), x = c.getContext('2d'), W = c.width;
    const E = HALF + 40, k = W / (E * 2);
    const to = (wx, wz) => [(wx + E) * k, (wz + E) * k];
    x.imageSmoothingEnabled = false;
    const src = (MAP_EXT - E) * MAP_PX;
    x.drawImage(g.world.mapCanvas, src, src, E * 2 * MAP_PX, E * 2 * MAP_PX, 0, 0, W, W);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    const label = (text, lx, ly, size = 11, color = '#fff') => {
      x.font = `bold ${size}px monospace`;
      x.lineWidth = 3;
      x.strokeStyle = '#000';
      x.strokeText(text, lx, ly);
      x.fillStyle = color;
      x.fillText(text, lx, ly);
    };
    // Shops sit on both sides of Main Street, so label each one on its own side.
    for (const poi of Object.values(g.world.pois)) {
      const [mx, my] = to(poi.door.x, poi.door.z);
      x.fillStyle = '#000';
      x.fillRect(mx - 5, my - 5, 10, 10);
      x.fillStyle = poi.color;
      x.fillRect(mx - 4, my - 4, 8, 8);
      const west = poi.door.x < 0;
      x.textAlign = west ? 'right' : 'left';
      label(poi.name, mx + (west ? -9 : 9), my);
    }
    x.textAlign = 'center';
    {
      const [hx, hy] = to(g.stash.pos.x, g.stash.pos.z);
      houseIcon(x, hx, hy);
      x.textAlign = 'right';
      label('YOUR STASH', hx - 9, hy + 12, 11, '#e8c890');
      x.textAlign = 'center';
    }
    const park = g.world.parks.prospect.lake;
    label('MAPLE PARK', to(park.x, park.z - 130)[0], to(park.x, park.z - 130)[1], 12, '#cfe8b0');
    x.save();
    const [rx, ry] = to(-HALF - 22, 0);
    x.translate(rx, ry);
    x.rotate(-Math.PI / 2);
    label('EAST RIVER', 0, 0, 12, '#bfe0ff');
    x.restore();
    const [sx, sy] = to(0, HALF - 120);
    x.save();
    x.translate(sx, sy);
    x.rotate(-Math.PI / 2);
    label('MAIN ST', 0, 0, 12, '#ffd34d');
    x.restore();
    for (const n of g.npcs.list) {
      const m = g.npcMarker(n);
      if (!m) continue;
      const [mx, my] = to(n.pos.x, n.pos.z);
      x.font = 'bold 16px monospace';
      x.strokeText(m === 'turnin' ? '?' : '!', mx, my);
      x.fillStyle = m === 'locked' ? '#8a8a8a' : '#ffd34d';
      x.fillText(m === 'turnin' ? '?' : '!', mx, my);
    }
    const id = g.quests.tracked, t = id && g.quests.target(id);
    if (t) {
      const [mx, my] = to(t.x, t.z);
      x.fillStyle = '#ffd34d';
      x.beginPath();
      x.arc(mx, my, 6, 0, Math.PI * 2);
      x.fill();
    }
    const [px, py] = to(g.player.pos.x, g.player.pos.z);
    x.fillStyle = '#fff';
    x.strokeStyle = '#000';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(px, py, 5, 0, Math.PI * 2);
    x.fill();
    x.stroke();
  }

  panelInput(inp) {
    const g = this.game, P = this.panel, n = inp.digit();
    const closeKey = { shop: 'KeyT', inv: 'KeyI', char: 'KeyC', log: 'Tab', map: 'KeyM' }[P.type];
    if (inp.pressed(closeKey) || inp.pressed('Escape') || inp.pressed('Backspace')) return this.closePanel();
    if (!n) return;
    if (P.type === 'shop') g.buy(P.arg, n - 1);
    else if (P.type === 'inv') {
      const ids = ITEM_ORDER.filter((id) => g.rpg.inventory[id]);
      if (ids[n - 1]) g.rpg.useItem(ids[n - 1]);
    } else if (P.type === 'char') {
      const key = Object.keys(SKILLS)[n - 1];
      if (key && g.rpg.spendSkill(key)) g.sfx.play('buy');
    } else if (P.type === 'log') {
      const act = g.quests.active();
      if (act[n - 1]) g.quests.tracked = act[n - 1];
    }
    if (this.panel) this.renderPanel();
  }

  showDead(on) {
    this.el.dead.style.display = on ? 'flex' : 'none';
  }
}
