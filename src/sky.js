import * as THREE from 'three';
import { smoothstep } from './util.js';

const NIGHT = new THREE.Color('#0b1230'), DUSK = new THREE.Color('#e88a5a'), DAY = new THREE.Color('#9cc8f0');
const DAY_LENGTH = 16 * 60; // real seconds per in-game day

export class DayNight {
  constructor(game) {
    this.game = game;
    const s = game.scene;
    this.color = new THREE.Color();
    s.background = this.color;
    s.fog = new THREE.Fog(this.color, 110, 400);
    this.hemi = new THREE.HemisphereLight('#cfe4ff', '#5a6a40', 0.8);
    this.sun = new THREE.DirectionalLight('#fff3dd', 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const c = this.sun.shadow.camera;
    c.left = c.bottom = -70;
    c.right = c.top = 70;
    c.near = 1;
    c.far = 500;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.04;
    s.add(this.hemi, this.sun, this.sun.target);
    this.time = 9; // hours
  }

  get clock() {
    const h = Math.floor(this.time), m = Math.floor((this.time - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  update(dt, focus) {
    this.time = (this.time + (dt * 24) / DAY_LENGTH) % 24;
    const a = ((this.time - 6) / 12) * Math.PI; // 0 at sunrise, PI at sunset
    const elev = Math.sin(a);
    const day = smoothstep(-0.12, 0.3, elev);
    const dusk = Math.max(0, 1 - Math.abs(elev) * 4) * (elev > -0.3 ? 1 : 0);
    this.color.copy(NIGHT).lerp(DAY, day).lerp(DUSK, dusk * 0.45);
    this.game.scene.fog.color.copy(this.color);

    // The sun (or moon, at night) orbits east to west.
    const up = elev > -0.05 ? 1 : -1;
    const dir = new THREE.Vector3(Math.cos(a) * up, Math.max(0.25, Math.abs(elev)), 0.45).normalize();
    // Snap the shadow camera to texels so shadows don't shimmer as you move.
    const step = 140 / 1024;
    const fx = Math.round(focus.x / step) * step, fz = Math.round(focus.z / step) * step;
    this.sun.position.set(fx + dir.x * 200, dir.y * 200, fz + dir.z * 200);
    this.sun.target.position.set(fx, 0, fz);
    this.sun.intensity = 0.25 + 1.55 * day;
    this.sun.color.set(day > 0.5 ? '#fff3dd' : dusk > 0.3 ? '#ffb27a' : '#9fb4ff');
    this.hemi.intensity = 0.5 + 0.75 * day;
    this.hemi.color.set(day > 0.3 ? '#cfe4ff' : '#7a8ad0');
    this.night = 1 - day;
    this.game.world.setNight(smoothstep(0.35, 0.8, this.night));
  }
}
