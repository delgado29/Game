import * as THREE from 'three';
import type { TowerSpec } from '../game/types';
import { gratingTexture, panelTexture, steelTexture } from './textures';
import { clamp } from '../core/math';

export const RUNG_STEP = 0.3;
export const LADDER_OFF = 0.32;   // ladder stands this far outside the +Z face
const UP = new THREE.Vector3(0, 1, 0);

export interface Platform { y: number; hw: number; }

/** Procedural lattice tower with a ladder, safety cable, platforms, hazards and the transmitter. */
export class Tower {
  group = new THREE.Group();
  rungY: number[] = [];           // rung heights by index
  broken = new Set<number>();     // rung indices that snap
  snapped = new Set<number>();
  anchors: number[] = [];         // anchor heights
  platforms: Platform[] = [];
  topY: number;
  transmitter = new THREE.Vector3();
  electrical: { y: number; light: THREE.PointLight; arc: THREE.Mesh; phase: number }[] = [];
  beacon: THREE.Mesh; beaconLight: THREE.PointLight; statusLamp: THREE.Mesh;
  private rungMesh: THREE.InstancedMesh; private brokenMesh: THREE.InstancedMesh;
  private hazardMarks: THREE.InstancedMesh;
  repaired = false;
  private time = 0;

  constructor(public spec: TowerSpec) {
    const steel = new THREE.MeshStandardMaterial({ map: steelTexture(3), color: 0xb8bcc4, roughness: 0.65, metalness: 0.55 });
    const steelDark = new THREE.MeshStandardMaterial({ map: steelTexture(9), color: 0x6c7078, roughness: 0.7, metalness: 0.5 });
    const rust = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.95, metalness: 0.2 });
    const cable = new THREE.MeshStandardMaterial({ color: 0xd8b04a, roughness: 0.5, metalness: 0.7 });
    const grate = gratingTexture(); grate.repeat.set(6, 1);
    const grating = new THREE.MeshStandardMaterial({ map: grate, color: 0xffffff, roughness: 0.9, metalness: 0.3, side: THREE.DoubleSide });
    const H = spec.height; this.topY = H;
    const hw = (y: number) => this.hw(y);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const members: THREE.Matrix4[] = [], braces: THREE.Matrix4[] = [];
    const seg = 6; const nSeg = Math.ceil(H / seg);
    const corner = (y: number, i: number) => new THREE.Vector3([1, 1, -1, -1][i] * hw(y), y, [1, -1, -1, 1][i] * hw(y));
    for (let s = 0; s < nSeg; s++) {
      const y0 = s * seg, y1 = Math.min(H, (s + 1) * seg);
      for (let i = 0; i < 4; i++) {
        members.push(member(corner(y0, i), corner(y1, i), 0.14));
        braces.push(member(corner(y1, i), corner(y1, (i + 1) % 4), 0.07));
        const a = s % 2 === 0 ? corner(y0, i) : corner(y0, (i + 1) % 4), b = s % 2 === 0 ? corner(y1, (i + 1) % 4) : corner(y1, i);
        braces.push(member(a, b, 0.06));
        if (y1 - y0 > 3) braces.push(member(corner((y0 + y1) / 2, i), corner((y0 + y1) / 2, (i + 1) % 4), 0.05));
      }
    }
    this.group.add(instanced(box, steel, members), instanced(box, steelDark, braces));
    // ladder rails + rungs on the +Z face
    const rails: THREE.Matrix4[] = []; const rungs: THREE.Matrix4[] = []; const brokenM: THREE.Matrix4[] = [];
    const lz = (y: number) => hw(y) + LADDER_OFF;
    for (let s = 0; s < nSeg; s++) { const y0 = s * seg, y1 = Math.min(H + 1.2, (s + 1) * seg); for (const x of [-0.28, 0.28]) rails.push(member(new THREE.Vector3(x, y0, lz(y0)), new THREE.Vector3(x, y1, lz(y1)), 0.05)); }
    const rungGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.56, 8); rungGeo.rotateZ(Math.PI / 2);
    const brokenSet = new Set(spec.brokenRungs.map((h) => Math.round(h / RUNG_STEP)));
    for (let i = 1; i * RUNG_STEP <= H + 1.6; i++) {
      const y = i * RUNG_STEP; this.rungY.push(y);
      const m = new THREE.Matrix4().makeTranslation(0, y, lz(y));
      if (brokenSet.has(i)) { this.broken.add(this.rungY.length - 1); brokenM.push(new THREE.Matrix4().makeRotationZ(0.35).premultiply(m)); rungs.push(new THREE.Matrix4().makeScale(0, 0, 0)); } else rungs.push(m);
    }
    this.rungMesh = instanced(rungGeo, steel, rungs); this.brokenMesh = instanced(rungGeo, rust, brokenM); this.group.add(instanced(box, steel, rails), this.rungMesh, this.brokenMesh);
    // safety cable with anchor eyes, except in cut ranges
    const cut = (y: number) => spec.cutAnchors.some(([a, b]) => y > a && y < b);
    const cables: THREE.Matrix4[] = []; const eyes: THREE.Matrix4[] = []; const frayed: THREE.Matrix4[] = [];
    for (let y = 0; y < H; y += 1) { const y1 = Math.min(H, y + 1); if (!cut(y + 0.5)) cables.push(member(new THREE.Vector3(0, y, lz(y) - 0.12), new THREE.Vector3(0, y1, lz(y1) - 0.12), 0.025)); }
    for (let y = spec.anchorSpacing * 0.5; y < H - 0.5; y += spec.anchorSpacing) { if (cut(y)) continue; this.anchors.push(y); eyes.push(new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(0, y, lz(y) - 0.12))); }
    for (const [a, b] of spec.cutAnchors) { frayed.push(member(new THREE.Vector3(0, a, lz(a) - 0.12), new THREE.Vector3(0.25, a - 0.9, lz(a) + 0.1), 0.025)); frayed.push(member(new THREE.Vector3(0, b, lz(b) - 0.12), new THREE.Vector3(-0.15, b - 0.6, lz(b) + 0.15), 0.025)); }
    const eye = new THREE.TorusGeometry(0.09, 0.02, 6, 12);
    this.group.add(instanced(box, cable, cables), instanced(eye, cable, eyes), instanced(box, rust, frayed));
    // platforms (plus the top)
    const pys = [...spec.platforms, H].sort((a, b) => a - b);
    const platM: THREE.Matrix4[] = []; const railM: THREE.Matrix4[] = [];
    for (const y of pys) {
      const w = hw(y); const out = w + 1.1; const inn = Math.max(0.2, w - 0.15); const thick = 0.08; this.platforms.push({ y, hw: w });
      const ring = (x0: number, z0: number, x1: number, z1: number) => platM.push(new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, y, (z0 + z1) / 2), new THREE.Quaternion(), new THREE.Vector3(Math.abs(x1 - x0), thick, Math.abs(z1 - z0))));
      ring(-out, -out, out, -inn); ring(-out, inn, -0.65, out); ring(0.65, inn, out, out); ring(-out, -inn, -inn, inn); ring(inn, -inn, out, inn);
      if (y === H) ring(-inn, -inn, inn, inn); // top platform is solid
      const posts = [[-out, -out], [out, -out], [out, out], [-out, out], [0.65, out], [-0.65, out]];
      for (const [px, pz] of posts) railM.push(member(new THREE.Vector3(px, y, pz), new THREE.Vector3(px, y + 1.1, pz), 0.04));
      const rail = (a: number[], b: number[]) => { railM.push(member(new THREE.Vector3(a[0], y + 1.1, a[1]), new THREE.Vector3(b[0], y + 1.1, b[1]), 0.035)); railM.push(member(new THREE.Vector3(a[0], y + 0.55, a[1]), new THREE.Vector3(b[0], y + 0.55, b[1]), 0.03)); };
      rail([-out, -out], [out, -out]); rail([out, -out], [out, out]); rail([-out, out], [-out, -out]); rail([out, out], [0.65, out]); rail([-out, out], [-0.65, out]);
    }
    this.group.add(instanced(box, grating, platM), instanced(box, steelDark, railM));
    // mast, antennas, dishes
    const mastH = 9; const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, mastH, 8), steel); mast.position.set(0, H + mastH / 2, 0); this.group.add(mast);
    const panel = new THREE.BoxGeometry(0.3, 2.2, 0.12); for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const pm = new THREE.Mesh(panel, new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 })); pm.position.set(Math.cos(a) * 0.55, H + 6, Math.sin(a) * 0.55); pm.rotation.y = -a + Math.PI / 2; this.group.add(pm); }
    const dishGeo = new THREE.CylinderGeometry(1.1, 0.7, 0.35, 16); const dishMat = new THREE.MeshStandardMaterial({ color: 0xdadfe4, roughness: 0.5 });
    for (const dy of spec.dishes) { const d = new THREE.Mesh(dishGeo, dishMat); d.rotation.x = Math.PI / 2; d.position.set(-hw(dy) - 0.7, dy, -0.2); d.rotation.z = 0.3; this.group.add(d); const arm = new THREE.Mesh(box, steelDark); arm.position.set(-hw(dy) - 0.3, dy, -0.2); arm.scale.set(0.8, 0.1, 0.1); this.group.add(arm); }
    // beacon and obstruction lights
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3020 })); this.beacon.position.set(0, H + mastH + 0.2, 0); this.group.add(this.beacon);
    this.beaconLight = new THREE.PointLight(0xff3020, 0, 60, 1.5); this.beaconLight.position.copy(this.beacon.position); this.group.add(this.beaconLight);
    const obs = new THREE.MeshBasicMaterial({ color: 0x8a1a10 }); for (let y = 45; y < H - 5; y += 45) for (const i of [0, 2]) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), obs); const c = corner(y, i); o.position.copy(c); this.group.add(o); }
    // transmitter cabinet on the top platform, opposite the ladder
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.6), new THREE.MeshStandardMaterial({ map: panelTexture(), roughness: 0.6, metalness: 0.4 })); cab.position.set(0, H + 0.65, -hw(H) - 0.5); this.group.add(cab);
    this.transmitter.set(0, H, -hw(H) - 0.5);
    this.statusLamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); this.statusLamp.position.set(0.3, H + 1.15, -hw(H) - 0.2); this.group.add(this.statusLamp);
    // live electrical boxes beside the ladder
    for (const ey of spec.electrical) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.35), new THREE.MeshStandardMaterial({ color: 0x8a8f3a, roughness: 0.7 })); b.position.set(0.85, ey, lz(ey) - 0.05); this.group.add(b);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xffd400 })); sign.position.set(0.85, ey + 0.05, lz(ey) + 0.13); this.group.add(sign);
      const light = new THREE.PointLight(0x9ad0ff, 0, 6, 2); light.position.set(0.55, ey, lz(ey) + 0.1); this.group.add(light);
      const arc = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xcfe8ff })); arc.position.copy(light.position); arc.visible = false; this.group.add(arc);
      this.electrical.push({ y: ey, light, arc, phase: Math.random() * 4 });
    }
    // drone hazard markers (hidden until the drone scouts)
    const markGeo = new THREE.RingGeometry(0.22, 0.3, 16); const marks: THREE.Matrix4[] = [];
    for (const i of this.broken) marks.push(new THREE.Matrix4().makeTranslation(0, this.rungY[i], lz(this.rungY[i]) + 0.12));
    for (const e of this.electrical) marks.push(new THREE.Matrix4().makeTranslation(0.85, e.y, lz(e.y) + 0.16));
    this.hazardMarks = instanced(markGeo, new THREE.MeshBasicMaterial({ color: 0xff4040, side: THREE.DoubleSide }), marks); this.hazardMarks.visible = false; this.group.add(this.hazardMarks);
    // concrete footings
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), new THREE.MeshStandardMaterial({ color: 0x8c8880, roughness: 1 })); for (let i = 0; i < 4; i++) { const f = foot.clone(); f.position.copy(corner(0, i)); f.position.y = 0.2; this.group.add(f); }
  }
  hw(y: number) { const t = clamp(y / this.spec.height, 0, 1); return (this.spec.baseWidth + (this.spec.topWidth - this.spec.baseWidth) * Math.pow(t, 0.85)) / 2; }
  ladderZ(y: number) { return this.hw(y) + LADDER_OFF; }
  showHazards(v: boolean) { this.hazardMarks.visible = v; }
  /** Nearest rung index to a height. */
  rungAt(y: number) { return clamp(Math.round(y / RUNG_STEP) - 1, 0, this.rungY.length - 1); }
  snapRung(i: number) { this.snapped.add(i); this.brokenMesh.setMatrixAt([...this.broken].indexOf(i), new THREE.Matrix4().makeScale(0, 0, 0)); this.brokenMesh.instanceMatrix.needsUpdate = true; }
  /** Electrical arc state 0..1 at a box (1 = arcing now). */
  arcAt(i: number) { const e = this.electrical[i]; const t = (this.time + e.phase) % 4.5; return t < 1.1 ? 1 : 0; }
  setRepaired() { this.repaired = true; (this.statusLamp.material as THREE.MeshBasicMaterial).color.set(0x30ff60); }
  update(dt: number) {
    this.time += dt;
    const blink = this.repaired ? (Math.sin(this.time * 2) > 0 ? 1 : 0.2) : Math.sin(this.time * 1.5) > 0.6 ? 1 : 0;
    (this.beacon.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.15 * blink, 0.1 * blink).multiplyScalar(0.4 + 0.6 * blink); this.beaconLight.intensity = blink * 40;
    (this.statusLamp.material as THREE.MeshBasicMaterial).color.copy(this.repaired ? new THREE.Color(0x30ff60) : new THREE.Color(Math.sin(this.time * 6) > 0 ? 0xff2020 : 0x300000));
    this.electrical.forEach((e, i) => { const a = this.arcAt(i); const f = a * (Math.random() > 0.35 ? 1 : 0.2); e.light.intensity = f * 6; e.arc.visible = f > 0.5; });
  }
}

function member(a: THREE.Vector3, b: THREE.Vector3, thick: number) {
  const dir = b.clone().sub(a); const len = dir.length(); dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(thick, len, thick));
}
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[]) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, ms.length)); ms.forEach((m, i) => im.setMatrixAt(i, m)); im.count = ms.length; im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; return im;
}
