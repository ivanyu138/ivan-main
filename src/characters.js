import * as THREE from 'three';
import { MeshBuilder } from './geo.js';

export const charMat = new THREE.MeshLambertMaterial({ vertexColors: true });

const SKINS = ['#f1c9a5', '#e0ac85', '#c68b5e', '#8d5a3b', '#5e3b26', '#f3d7c0'];
const HAIRS = ['#2a1d14', '#4a3020', '#8a5a2b', '#d8b060', '#1a1a1a', '#9a9a9a', '#a33a22'];
const SHIRTS = ['#c94a4a', '#3b6fd8', '#3f9a5a', '#e0c040', '#8a4ac9', '#e8e8e8', '#2a2a2a', '#e07a30', '#4ac9c0', '#c94a9a'];
const PANTS = ['#2a3448', '#3a3a3a', '#5a4a3a', '#2f4a6a', '#6a6a70', '#1f1f24'];

export function randomLook(rng) {
  return {
    skin: rng.pick(SKINS), hair: rng.pick(HAIRS), shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS),
    hat: rng.chance(0.15) ? rng.pick(SHIRTS) : null,
  };
}

// Blocky humanoid: merged body+head, plus four limbs pivoting at hip/shoulder.
export function makeHumanoid({ skin, hair, shirt, pants, shoes = '#222222', hat = null, bandana = null }) {
  const group = new THREE.Group();
  const b = new MeshBuilder();
  b.box(0, 0.8, 0, 0.56, 0.64, 0.3, shirt);
  b.box(0, 1.44, 0, 0.34, 0.34, 0.32, skin);
  b.box(0, 1.74, -0.01, 0.37, 0.1, 0.35, hair);
  b.box(0, 1.5, -0.15, 0.37, 0.26, 0.06, hair);
  b.box(-0.08, 1.6, 0.162, 0.06, 0.05, 0.01, '#111111');
  b.box(0.08, 1.6, 0.162, 0.06, 0.05, 0.01, '#111111');
  if (hat) {
    b.box(0, 1.78, 0, 0.39, 0.13, 0.37, hat);
    b.box(0, 1.78, 0.23, 0.39, 0.04, 0.16, hat);
  }
  if (bandana) b.box(0, 1.44, 0.01, 0.36, 0.13, 0.34, bandana);
  const body = new THREE.Mesh(b.build(), charMat);

  const lb = new MeshBuilder();
  lb.box(0, -0.68, 0, 0.22, 0.68, 0.24, pants);
  lb.box(0, -0.8, 0.03, 0.23, 0.12, 0.3, shoes);
  const legG = lb.build();
  const ab = new MeshBuilder();
  ab.box(0, -0.3, 0, 0.16, 0.3, 0.18, shirt);
  ab.box(0, -0.64, 0, 0.15, 0.34, 0.16, skin);
  const armG = ab.build();

  const legL = new THREE.Mesh(legG, charMat), legR = new THREE.Mesh(legG, charMat);
  const armL = new THREE.Mesh(armG, charMat), armR = new THREE.Mesh(armG, charMat);
  legL.position.set(-0.13, 0.8, 0);
  legR.position.set(0.13, 0.8, 0);
  armL.position.set(-0.37, 1.42, 0);
  armR.position.set(0.37, 1.42, 0);
  const rig = new THREE.Group();
  rig.add(body, legL, legR, armL, armR);
  group.add(rig);
  for (const m of [body, legL, legR, armL, armR]) m.castShadow = true;
  return { group, rig, body, legL, legR, armL, armR };
}

// phase: walk cycle, amt: 0..1 stride, punch: 0..1 punch progress (0 = none).
export function animateHumanoid(h, phase, amt, punch = 0, down = false) {
  if (down) {
    h.rig.rotation.x = -Math.PI / 2;
    h.rig.position.y = 0.18;
    h.legL.rotation.x = h.legR.rotation.x = 0;
    h.armL.rotation.x = h.armR.rotation.x = -2.6;
    return;
  }
  h.rig.rotation.x = 0;
  h.rig.position.y = 0;
  const s = Math.sin(phase) * 0.75 * amt;
  h.legL.rotation.x = s;
  h.legR.rotation.x = -s;
  h.armL.rotation.x = -s * 0.8;
  h.armR.rotation.x = s * 0.8;
  h.armL.rotation.z = -0.06;
  h.armR.rotation.z = 0.06;
  if (punch > 0) {
    const p = Math.sin(punch * Math.PI);
    h.armR.rotation.x = -1.55 * p;
    h.armL.rotation.x = -0.5;
  }
}
