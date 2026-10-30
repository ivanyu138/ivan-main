import { clamp } from './util.js';

// Spatial hash of static 2D obstacles (axis-aligned boxes and circles, each with a height).
export class Colliders {
  constructor(cell = 32) {
    this.cell = cell;
    this.cells = new Map();
    this.stamp = 0;
    this.nx = 0;
    this.nz = 0;
    this._tmp = [];
  }

  _key(i, j) {
    return (i + 2048) * 4096 + (j + 2048);
  }

  _insert(o, x0, z0, x1, z1) {
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) {
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const k = this._key(i, j);
        let a = this.cells.get(k);
        if (!a) this.cells.set(k, (a = []));
        a.push(o);
      }
    }
  }

  // y0..h is the obstacle's vertical extent (y0 defaults to the ground, so it blocks from below).
  addBox(x0, z0, x1, z1, h = 10, y0 = -Infinity) {
    const b = { type: 0, x0, z0, x1, z1, h, y0, _s: 0 };
    this._insert(b, x0, z0, x1, z1);
    return b;
  }

  addCircle(x, z, r, h = 3) {
    const o = { type: 1, x, z, r, h, _s: 0 };
    this._insert(o, x - r, z - r, x + r, z + r);
    return o;
  }

  query(x0, z0, x1, z1, out = []) {
    out.length = 0;
    const s = ++this.stamp, c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) {
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const a = this.cells.get(this._key(i, j));
        if (!a) continue;
        for (const o of a) {
          if (o._s !== s) {
            o._s = s;
            out.push(o);
          }
        }
      }
    }
    return out;
  }

  // Push a circle at p (has .x/.z) out of every obstacle taller than y.
  // Returns true on contact; this.nx/this.nz hold the summed push direction.
  resolveCircle(p, r, y = 0) {
    const list = this.query(p.x - r, p.z - r, p.x + r, p.z + r, this._tmp);
    let hit = false, nx = 0, nz = 0;
    for (const o of list) {
      if (y > o.h || (o.y0 !== undefined && y < o.y0)) continue;
      if (o.type === 0) {
        const cx = clamp(p.x, o.x0, o.x1), cz = clamp(p.z, o.z0, o.z1);
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = (r - d) / d;
          p.x += dx * push;
          p.z += dz * push;
          nx += dx / d;
          nz += dz / d;
        } else {
          const l = p.x - o.x0, rr = o.x1 - p.x, t = p.z - o.z0, bt = o.z1 - p.z;
          const m = Math.min(l, rr, t, bt);
          if (m === l) { p.x = o.x0 - r; nx -= 1; }
          else if (m === rr) { p.x = o.x1 + r; nx += 1; }
          else if (m === t) { p.z = o.z0 - r; nz -= 1; }
          else { p.z = o.z1 + r; nz += 1; }
        }
        hit = true;
      } else {
        const dx = p.x - o.x, dz = p.z - o.z, rr = r + o.r, d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-4;
        p.x = o.x + (dx / d) * rr;
        p.z = o.z + (dz / d) * rr;
        nx += dx / d;
        nz += dz / d;
        hit = true;
      }
    }
    const l = Math.hypot(nx, nz) || 1;
    this.nx = nx / l;
    this.nz = nz / l;
    return hit;
  }

  pointBlocked(x, y, z, m = 0, boxesOnly = false) {
    const list = this.query(x - m, z - m, x + m, z + m, this._tmp);
    for (const o of list) {
      if (y > o.h || (o.y0 !== undefined && y < o.y0)) continue;
      if (o.type === 0) {
        if (x > o.x0 - m && x < o.x1 + m && z > o.z0 - m && z < o.z1 + m) return true;
      } else if (!boxesOnly && Math.hypot(x - o.x, z - o.z) < o.r + m) return true;
    }
    return false;
  }
}
