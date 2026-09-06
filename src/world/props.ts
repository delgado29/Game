import * as THREE from 'three';
import { gloveTexture } from './textures';

/** The work van: the game's home. Parked at the tower base facing it. */
export function makeVan(): THREE.Group {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.45, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.5, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.15, metalness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.55, 4.0), paint); body.position.set(0, 1.35, -0.55); g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 1.5), paint); cab.position.set(0, 1.1, 2.15); g.add(cab);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 1.4), paint); hood.position.set(0, 0.85, 2.2); g.add(hood);
  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.1), glass); wind.position.set(0, 1.7, 1.42); wind.rotation.x = -0.35; g.add(wind);
  for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 1.0), glass); sw.position.set(s * 1.0, 1.65, 1.9); g.add(sw); }
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.22, 4.02), new THREE.MeshStandardMaterial({ color: 0xd9661f, roughness: 0.5 })); stripe.position.set(0, 1.25, -0.55); g.add(stripe);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 0.2), dark); bumper.position.set(0, 0.5, 2.95); g.add(bumper);
  for (const [x, z] of [[-0.95, 1.6], [0.95, 1.6], [-0.95, -1.5], [0.95, -1.5]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 14), dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.4, z); g.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.8, roughness: 0.3 })); hub.rotation.z = Math.PI / 2; hub.position.set(x, 0.4, z); g.add(hub); }
  // roof rack + ladder
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 3.2), dark); rack.position.set(0, 2.2, -0.5); g.add(rack);
  for (const x of [-0.25, 0.25]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 3.0), new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.7, roughness: 0.4 })); r.position.set(x, 2.3, -0.5); g.add(r); }
  for (let i = 0; i < 9; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.7, roughness: 0.4 })); r.position.set(0, 2.3, -1.9 + i * 0.35); g.add(r); }
  // headlights (emissive + spots), tail lights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff1c0 });
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), hl); l.position.set(s * 0.65, 0.95, 2.96); g.add(l); const sp = new THREE.SpotLight(0xffe9b8, 40, 40, 0.5, 0.5, 1.2); sp.position.set(s * 0.65, 0.95, 2.9); sp.target.position.set(s * 0.8, 0.2, 14); g.add(sp, sp.target); const tl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.06), new THREE.MeshBasicMaterial({ color: 0xff3020 })); tl.position.set(s * 0.8, 1.2, -2.58); g.add(tl); }
  // open sliding door on the right side with warm interior light, tool shelves
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 1.3), paint); door.position.set(1.06, 1.35, -1.9); g.add(door);
  const interior = new THREE.PointLight(0xffc98a, 8, 6, 1.5); interior.position.set(0.6, 1.9, 0.0); g.add(interior);
  for (let i = 0; i < 3; i++) { const sh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 1.6), dark); sh.position.set(-0.7, 0.9 + i * 0.45, -0.6); g.add(sh); }
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0xd9661f, roughness: 0.8 })); crate.position.set(0.2, 0.75, -1.3); g.add(crate);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6), dark); antenna.position.set(-0.8, 2.9, 0.6); g.add(antenna);
  return g;
}

/** A low-poly gloved hand: palm + fingers + thumb, used as the first-person hands. */
export function makeHand(left: boolean): THREE.Group {
  const g = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ map: gloveTexture(), roughness: 0.9 }); const s = left ? -1 : 1;
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.03, 0.09), mat); g.add(palm);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.06), mat); f.position.set(-0.03 + i * 0.02, -0.02, 0.06); f.rotation.x = -1.3; g.add(f); }
  const th = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.05), mat); th.position.set(s * 0.05, -0.015, 0.02); th.rotation.x = -1.0; th.rotation.z = s * 0.6; g.add(th);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0xd9661f, roughness: 0.9 })); cuff.rotation.x = Math.PI / 2; cuff.position.set(0, 0.01, -0.09); g.add(cuff);
  return g;
}

/** Seated climber figure shown in rest/look-down mode. */
export function makeClimberFigure(): THREE.Group {
  const g = new THREE.Group(); const jacket = new THREE.MeshStandardMaterial({ color: 0xd9661f, roughness: 0.85 }); const pants = new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.9 }); const skin = new THREE.MeshStandardMaterial({ color: 0xc89070, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.35, 4, 8), jacket); torso.position.set(0, 0.62, 0); g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skin); head.position.set(0, 1.0, 0.02); g.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2e53a, roughness: 0.5 })); helmet.position.copy(head.position); g.add(helmet);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), pants); leg.position.set(s * 0.11, 0.3, 0.25); leg.rotation.x = Math.PI / 2 - 0.15; g.add(leg); const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.4, 4, 8), pants); shin.position.set(s * 0.11, 0.05, 0.45); g.add(shin); const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.4, 4, 8), jacket); arm.position.set(s * 0.25, 0.55, 0.12); arm.rotation.x = 0.7; arm.rotation.z = s * -0.2; g.add(arm); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd9661f })); hand.position.set(s * 0.28, 0.4, 0.35); g.add(hand); }
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.18), new THREE.MeshStandardMaterial({ color: 0x3b4a5c, roughness: 0.9 })); pack.position.set(0, 0.68, -0.2); g.add(pack);
  return g;
}

/** A small flock of birds circling below the climber. */
export class Birds {
  mesh: THREE.InstancedMesh; private n = 14; private t = 0; center = new THREE.Vector3(30, 40, -60);
  constructor(scene: THREE.Scene) {
    const geo = new THREE.ConeGeometry(0.25, 0.9, 3); geo.rotateX(Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 }), this.n); this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  update(dt: number) {
    this.t += dt; const m = new THREE.Matrix4(); const p = new THREE.Vector3(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(1, 1 + Math.sin(this.t * 9) * 0.6, 1);
    for (let i = 0; i < this.n; i++) { const a = this.t * 0.25 + i * 0.45; const r = 28 + (i % 5) * 4; p.set(this.center.x + Math.cos(a) * r, this.center.y + Math.sin(this.t * 0.7 + i) * 3, this.center.z + Math.sin(a) * r); const d = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)); q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d); m.compose(p, q, s); this.mesh.setMatrixAt(i, m); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
