import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export const lerpColor = (a, b, t) => new THREE.Color(a).lerp(_c.set(b), Math.min(1, Math.max(0, t)));
export const smooth01 = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Builds one smooth-shaded, vertex-colored geometry out of rounded primitives.
// A part's color can be a fixed color or a function of each vertex's position and
// normal (x, y, z, nx, ny, nz), which is how stripes, patches and shading are painted.
export class SmoothBuilder {
  constructor() {
    this.parts = [];
  }

  add(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
    // Rounded boxes come out non-indexed, so every part is made non-indexed to merge cleanly.
    if (geo.index) geo = geo.toNonIndexed();
    _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scale));
    geo.applyMatrix4(_m);
    const p = geo.attributes.position, n = geo.attributes.normal, cols = new Float32Array(p.count * 3);
    const paint = typeof color === 'function';
    if (!paint) _c.set(color);
    for (let i = 0; i < p.count; i++) {
      if (paint) _c.set(color(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)));
      cols[i * 3] = _c.r;
      cols[i * 3 + 1] = _c.g;
      cols[i * 3 + 2] = _c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.parts.push(geo);
    return this;
  }

  // Ellipsoid with radii r = [rx, ry, rz].
  sphere(pos, r, color, seg = 12, rot = [0, 0, 0]) {
    return this.add(new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.75))), color, pos, rot, r);
  }

  capsule(pos, radius, length, color, rot = [0, 0, 0], seg = 10, scale = [1, 1, 1]) {
    return this.add(new THREE.CapsuleGeometry(radius, length, 4, seg), color, pos, rot, scale);
  }

  cylinder(pos, rTop, rBot, h, color, rot = [0, 0, 0], seg = 12) {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, pos, rot);
  }

  cone(pos, r, h, color, rot = [0, 0, 0], seg = 10, scale = [1, 1, 1]) {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, pos, rot, scale);
  }

  rbox(pos, size, radius, color, rot = [0, 0, 0]) {
    return this.add(new RoundedBoxGeometry(size[0], size[1], size[2], 2, radius), color, pos, rot);
  }

  tube(points, radius, color, seg = 16, radial = 8) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return this.add(new THREE.TubeGeometry(curve, seg, radius, radial, false), color);
  }

  build() {
    const g = mergeGeometries(this.parts, false);
    g.computeBoundingSphere();
    return g;
  }
}

export { RoundedBoxGeometry };
