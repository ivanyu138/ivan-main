import * as THREE from 'three';
import { makeCat, animateCat, CATS, CAT_ORDER } from './cat.js';
import { MeshBuilder } from './geo.js';

// Character select: the three cats lined up on a couch.
export class CatSelect {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#e9cfa2');
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    this.scene.add(new THREE.HemisphereLight('#fff1dc', '#8a7050', 1.1));
    const key = new THREE.DirectionalLight('#ffe2b0', 1.5);
    key.position.set(2, 4, 5);
    this.scene.add(key);

    const b = new MeshBuilder();
    b.quadH(-8, -4, 8, 6, 0, '#b48a5c');
    b.box(0, 0, -1.2, 16, 4, 0.1, '#ecd3a8');
    b.box(0, 0, 0, 3.4, 0.42, 1.1, '#b9b1ad');
    b.box(0, 0.2, -0.47, 3.4, 0.85, 0.3, '#aea6a2');
    for (const x of [-1.85, 1.85]) b.box(x, 0, 0, 0.32, 0.7, 1.1, '#aea6a2');
    this.scene.add(new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));

    this.cats = CAT_ORDER.map((id, i) => {
      const c = makeCat(id);
      c.group.position.set((i - 1) * 0.95, 0.42, 0.08);
      this.scene.add(c.group);
      return c;
    });
    this.sel = 0;
    this.spin = 0;

    this.el = document.getElementById('select');
    const cards = this.el.querySelector('.cards');
    cards.innerHTML = CAT_ORDER.map((id, i) => `<button class="card" data-i="${i}"><b><span class="k">${i + 1}</span> ${CATS[id].name}</b><span>${CATS[id].desc}</span></button>`).join('');
    cards.querySelectorAll('.card').forEach((el) => (el.onclick = () => this.choose(Number(el.dataset.i))));
    this.el.querySelector('#btn-start').onclick = () => this.confirm();
  }

  open(current, onPick) {
    this.onPick = onPick;
    this.choose(Math.max(0, CAT_ORDER.indexOf(current)));
    this.el.style.display = 'flex';
  }

  close() {
    this.el.style.display = 'none';
  }

  choose(i) {
    this.sel = (i + CAT_ORDER.length) % CAT_ORDER.length;
    this.spin = 0;
    this.el.querySelectorAll('.card').forEach((el, j) => el.classList.toggle('on', j === this.sel));
  }

  confirm() {
    this.close();
    if (this.onPick) this.onPick(CAT_ORDER[this.sel]);
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    const d = Math.max(3, (3 * 1.7) / aspect);
    this.camera.position.set(0, 1.15, d);
    this.camera.lookAt(0, 0.7, 0);
    this.camera.updateProjectionMatrix();
  }

  update(dt, inp) {
    const n = inp.digit();
    if (n >= 1 && n <= 3) this.choose(n - 1);
    if (inp.pressed('ArrowLeft') || inp.pressed('KeyA')) this.choose(this.sel - 1);
    if (inp.pressed('ArrowRight') || inp.pressed('KeyD')) this.choose(this.sel + 1);
    if (inp.pressed('Enter') || inp.pressed('Space')) return this.confirm();
    this.spin += dt;
    this.cats.forEach((c, i) => {
      const on = i === this.sel;
      c.sitBlend = (c.sitBlend ?? 1) + ((on ? 0 : 1) - (c.sitBlend ?? 1)) * Math.min(1, dt * 6);
      c.group.rotation.y = on ? Math.sin(this.spin * 1.2) * 0.6 : 0;
      animateCat(c, dt, 0, 0, 0, c.sitBlend);
    });
  }
}
