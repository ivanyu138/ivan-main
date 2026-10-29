import * as THREE from 'three';
import { angDiff, clamp } from './util.js';

// GTA-style chase camera: free orbit with the mouse, auto-recenters behind cars.
export class CameraRig {
  constructor(camera, game) {
    this.camera = camera;
    this.game = game;
    this.yaw = 0;
    this.pitch = 0.32;
    this.dist = 5;
    this.idle = 0;
    this.target = new THREE.Vector3();
    this.cur = new THREE.Vector3();
    this.first = true;
  }

  update(dt) {
    const g = this.game, inp = g.input, p = g.player;
    const lookX = inp.mouseDX * 0.0028 + ((inp.down('ArrowLeft') ? -1 : 0) + (inp.down('ArrowRight') ? 1 : 0)) * 2.2 * dt;
    const lookY = inp.mouseDY * 0.0022 + ((inp.down('ArrowUp') ? -1 : 0) + (inp.down('ArrowDown') ? 1 : 0)) * 1.4 * dt;
    if (!g.modal) {
      this.yaw -= lookX;
      this.pitch = clamp(this.pitch + lookY, -0.15, 1.25);
    }
    const looking = Math.abs(lookX) + Math.abs(lookY) > 1e-4;
    this.idle = looking ? 0 : this.idle + dt;

    const car = p.vehicle;
    const wantDist = car ? 9.5 : 3.2;
    this.dist += (wantDist - this.dist) * Math.min(1, dt * 3);
    if (car && this.idle > 1.2 && Math.abs(car.speed) > 2) {
      const behind = car.heading + (car.speed < -1 ? 0 : Math.PI);
      this.yaw += angDiff(this.yaw, behind) * Math.min(1, dt * 2.5);
      this.pitch += (0.22 - this.pitch) * Math.min(1, dt * 1.5);
    }

    this.target.set(p.pos.x, p.pos.y + (car ? 1.6 : 0.75), p.pos.z);
    if (this.first) {
      this.cur.copy(this.target);
      this.first = false;
    }
    this.cur.lerp(this.target, 1 - Math.exp(-dt * (car ? 12 : 20)));

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dx = Math.sin(this.yaw) * cp, dy = sp, dz = Math.cos(this.yaw) * cp;
    // March out from the target; stop short of walls so the camera never clips inside buildings.
    let d = 0.5;
    const col = g.world.colliders;
    while (d < this.dist) {
      const nd = Math.min(this.dist, d + 0.4);
      if (col.pointBlocked(this.cur.x + dx * nd, this.cur.y + dy * nd, this.cur.z + dz * nd, 0.25, true)) break;
      d = nd;
    }
    this.camera.position.set(this.cur.x + dx * d, Math.max(this.cur.y + dy * d, 0.4), this.cur.z + dz * d);
    this.camera.lookAt(this.cur.x, this.cur.y + 0.2, this.cur.z);
  }
}
