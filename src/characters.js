import * as THREE from 'three';
import { SmoothBuilder } from './smooth.js';

// Soft, slightly satin material shared by every character.
export const charMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });

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

// Rounded humanoid: merged torso+head, plus four limbs pivoting at hip/shoulder.
export function makeHumanoid({ skin, hair, shirt, pants, shoes = '#222222', hat = null, bandana = null }) {
  const group = new THREE.Group();
  const b = new SmoothBuilder();
  b.capsule([0, 1.13, 0], 0.17, 0.32, shirt, [0, 0, 0], 10, [1.12, 1, 0.74]);
  b.sphere([0, 0.86, 0], [0.2, 0.11, 0.135], pants, 10);
  b.cylinder([0, 1.47, 0], 0.055, 0.065, 0.12, skin, [0, 0, 0], 10);
  b.sphere([0, 1.63, 0], [0.145, 0.165, 0.15], skin, 10);
  b.sphere([0, 1.62, 0.145], [0.022, 0.03, 0.025], skin, 8);
  for (const sx of [-1, 1]) {
    b.sphere([sx * 0.055, 1.655, 0.128], [0.02, 0.024, 0.012], '#1a1a1a', 8);
    b.sphere([sx * 0.15, 1.63, 0], [0.025, 0.04, 0.025], skin, 8);
  }
  // Hair: a cap over the top and back of the head.
  b.add(new THREE.SphereGeometry(0.162, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, [0, 1.64, -0.015], [-0.55, 0, 0], [1.02, 1.08, 1.06]);
  if (hat) {
    b.add(new THREE.SphereGeometry(0.168, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), hat, [0, 1.69, 0]);
    b.cylinder([0, 1.71, 0.12], 0.13, 0.13, 0.02, hat, [0, 0, 0], 16);
  }
  if (bandana) b.sphere([0, 1.57, 0.03], [0.152, 0.07, 0.15], bandana, 10);
  const body = new THREE.Mesh(b.build(), charMat);

  const lb = new SmoothBuilder();
  lb.capsule([0, -0.38, 0], 0.075, 0.6, pants, [0, 0, 0], 8);
  lb.sphere([0, -0.77, 0.045], [0.075, 0.05, 0.13], shoes, 10);
  const legG = lb.build();
  const ab = new SmoothBuilder();
  ab.capsule([0, -0.28, 0], 0.058, 0.42, (x, y) => (y > -0.24 ? shirt : skin), [0, 0, 0], 8);
  ab.sphere([0, -0.6, 0], [0.055, 0.065, 0.05], skin, 10);
  const armG = ab.build();

  const legL = new THREE.Mesh(legG, charMat), legR = new THREE.Mesh(legG, charMat);
  const armL = new THREE.Mesh(armG, charMat), armR = new THREE.Mesh(armG, charMat);
  legL.position.set(-0.1, 0.84, 0);
  legR.position.set(0.1, 0.84, 0);
  armL.position.set(-0.25, 1.4, 0);
  armR.position.set(0.25, 1.4, 0);
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
  h.armL.rotation.z = -0.1;
  h.armR.rotation.z = 0.1;
  if (punch > 0) {
    const p = Math.sin(punch * Math.PI);
    h.armR.rotation.x = -1.55 * p;
    h.armL.rotation.x = -0.5;
  }
}
