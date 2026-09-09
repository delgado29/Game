import * as THREE from 'three';
import { clamp, makeNoise, rng, smoothstep } from '../core/math';

export const TOWN = new THREE.Vector3(90, 0, -760);
export const TOWN_R = 260;

/** Forest biome: heightfield ridge with the tower on a saddle, pine forest, dirt track and a valley town whose lights can come on. */
export class Terrain {
  group = new THREE.Group();
  heightAt: (x: number, z: number) => number;
  windows!: THREE.InstancedMesh; private windowN = 0; private windowOrder: number[] = [];
  private streetLights: THREE.InstancedMesh | null = null;
  lit = 0; // fraction of the town that is lit
  private litApplied = -1;
  private warm = new THREE.Color(); private dark = new THREE.Color(0x0a0c10);

  constructor(scene: THREE.Scene, seed = 7) {
    const noise = makeNoise(seed); const r = rng(seed * 13 + 1);
    const h = (x: number, z: number) => {
      const d0 = Math.hypot(x, z);
      // a broad open valley runs from the tower toward the town so the lights are visible from the platforms
      const corridor = smoothstep(420, 120, Math.abs(x - TOWN.x * smoothstep(0, TOWN.z, z))) * smoothstep(-40, -260, z);
      let y = (noise.fbm(x * 0.0016 + 3, z * 0.0016 + 7, 5) - 0.45) * 260 * (1 - 0.75 * corridor) + noise.fbm(x * 0.012, z * 0.012, 3) * 14;
      // ridge running east-west through the tower, valley toward -z where the town sits
      y += 40 * Math.exp(-(z * z) / (2 * 260 * 260)) * (1 - 0.6 * corridor) - 70 * smoothstep(-120, -600, z) * corridor;
      const dt = Math.hypot(x - TOWN.x, z - TOWN.z); const townFlat = smoothstep(TOWN_R + 120, TOWN_R - 40, dt);
      y = y * (1 - townFlat) + (-64) * townFlat;
      const lot = smoothstep(70, 18, d0); y = y * (1 - lot) + 0 * lot; // flat gravel lot around the tower
      return y;
    };
    this.heightAt = h;
    // ground mesh
    const SIZE = 3600, SEG = 180; const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute; const col = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color(0x4d6b32), cForest = new THREE.Color(0x2c4a26), cRock = new THREE.Color(0x6e6a62), cDirt = new THREE.Color(0x6b5a44), cGravel = new THREE.Color(0x77736c), cTown = new THREE.Color(0x3c3a38);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i); const y = h(x, z); pos.setY(i, y);
      const slope = Math.abs(h(x + 6, z) - y) + Math.abs(h(x, z + 6) - y);
      let c = cForest.clone().lerp(cGrass, noise.n2(x * 0.02, z * 0.02) * 0.6).lerp(cRock, smoothstep(14, 26, slope) * 0.9 + smoothstep(120, 200, y) * 0.6);
      const dTown = Math.hypot(x - TOWN.x, z - TOWN.z); c.lerp(cTown, smoothstep(TOWN_R + 30, TOWN_R - 60, dTown));
      const road = Math.abs(x - TOWN.x * smoothstep(0, -700, z) + 20 * Math.sin(z * 0.01)); c.lerp(cDirt, smoothstep(9, 3, road) * smoothstep(-TOWN.z + 100, -TOWN.z - 300, -z) * (z < 10 ? 1 : 0));
      c.lerp(cGravel, smoothstep(40, 16, Math.hypot(x, z)));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })); ground.receiveShadow = false; this.group.add(ground);
    // trees: instanced two-cone pines with a trunk
    const treeGeo = new THREE.ConeGeometry(2.2, 7, 6); treeGeo.translate(0, 5.5, 0);
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 5); trunkGeo.translate(0, 1.2, 0);
    const N = 5200; const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ color: 0x24512c, roughness: 1 }), N); const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 }), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(); const tint = new THREE.Color(); let n = 0;
    for (let i = 0; i < N * 4 && n < N; i++) {
      const x = (r.next() - 0.5) * 3000, z = (r.next() - 0.5) * 3000; const y = h(x, z);
      if (Math.hypot(x, z) < 26 || Math.hypot(x - TOWN.x, z - TOWN.z) < TOWN_R + 20 || y > 150 || noise.n2(x * 0.004, z * 0.004) < 0.42) continue;
      const road = Math.abs(x - TOWN.x * smoothstep(0, -700, z) + 20 * Math.sin(z * 0.01)); if (road < 9 && z < 10 && z > TOWN.z) continue;
      const sc = 0.7 + r.next() * 0.9; p.set(x, y - 0.3, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.next() * 6.28); s.set(sc, sc * (0.9 + r.next() * 0.5), sc);
      m.compose(p, q, s); trees.setMatrixAt(n, m); trunks.setMatrixAt(n, m); tint.setHSL(0.32 + r.next() * 0.06, 0.35 + r.next() * 0.2, 0.18 + r.next() * 0.12); trees.setColorAt(n, tint); n++;
    }
    trees.count = n; trunks.count = n; trees.instanceMatrix.needsUpdate = true; this.group.add(trees, trunks);
    this.buildTown(r);
    scene.add(this.group);
  }
  private buildTown(r: ReturnType<typeof rng>) {
    const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
    const NB = 220; const buildings = new THREE.InstancedMesh(bGeo, new THREE.MeshStandardMaterial({ color: 0x6a6660, roughness: 0.9 }), NB);
    const wGeo = new THREE.PlaneGeometry(2.0, 2.4); const NW = 2600; this.windows = new THREE.InstancedMesh(wGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false, toneMapped: false }), NW);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(); let nb = 0, nw = 0; const col = new THREE.Color();
    const wm = new THREE.Matrix4();
    for (let i = 0; i < NB * 3 && nb < NB; i++) {
      const a = r.next() * 6.28, d = Math.sqrt(r.next()) * (TOWN_R - 30); const x = TOWN.x + Math.cos(a) * d, z = TOWN.z + Math.sin(a) * d; const y = this.heightAt(x, z);
      const w = 8 + r.next() * 14, dep = 8 + r.next() * 14, hgt = 6 + r.next() * (d < 80 ? 26 : 10);
      p.set(x, y - 0.5, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.int(4) * Math.PI / 2 + (r.next() - 0.5) * 0.2); s.set(w, hgt, dep); m.compose(p, q, s); buildings.setMatrixAt(nb, m);
      col.setHSL(0.08 + r.next() * 0.05, 0.1 + r.next() * 0.15, 0.3 + r.next() * 0.25); buildings.setColorAt(nb, col); nb++;
      // windows on two facades
      const floors = Math.floor(hgt / 3.2); const cols = Math.floor(w / 3);
      for (let f = 0; f < floors && nw < NW; f++) for (let c = 0; c < cols && nw < NW; c++) {
        if (r.next() < 0.35) continue;
        const lx = -w / 2 + 1.5 + c * 3, ly = 1.6 + f * 3.2; const side = r.next() < 0.5 ? 1 : -1;
        const local = new THREE.Vector3(lx, ly, side * (dep / 2 + 0.05)); local.applyQuaternion(q); local.add(new THREE.Vector3(x, y - 0.5, z));
        wm.compose(local, q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side > 0 ? 0 : Math.PI)), s.set(1, 1, 1)); this.windows.setMatrixAt(nw, wm); this.windows.setColorAt(nw, this.dark); nw++;
      }
    }
    buildings.count = nb; this.windows.count = nw; this.windowN = nw; this.windowOrder = Array.from({ length: nw }, (_, i) => i);
    for (let i = nw - 1; i > 0; i--) { const j = r.int(i + 1); [this.windowOrder[i], this.windowOrder[j]] = [this.windowOrder[j], this.windowOrder[i]]; }
    // street lights: small emissive discs on the ground grid
    const NS = 160; const sGeo = new THREE.SphereGeometry(2.2, 6, 4); this.streetLights = new THREE.InstancedMesh(sGeo, new THREE.MeshBasicMaterial({ color: 0x0a0a0a, fog: false, toneMapped: false }), NS);
    for (let i = 0; i < NS; i++) { const a = r.next() * 6.28, d = Math.sqrt(r.next()) * TOWN_R; const x = TOWN.x + Math.cos(a) * d, z = TOWN.z + Math.sin(a) * d; m.compose(p.set(x, this.heightAt(x, z) + 6, z), q.identity(), s.set(1, 1, 1)); this.streetLights.setMatrixAt(i, m); this.streetLights.setColorAt(i, this.dark); }
    this.group.add(buildings, this.windows, this.streetLights);
    this.applyLit(0);
  }
  /** Set fraction (0..1) of town lights on. */
  applyLit(f: number) {
    f = clamp(f, 0, 1); if (Math.abs(f - this.litApplied) < 0.002 && f !== 0 && f !== 1) return; this.litApplied = f;
    const nOn = Math.floor(f * this.windowN);
    for (let i = 0; i < this.windowN; i++) { const idx = this.windowOrder[i]; if (i < nOn) { this.warm.setHSL(0.09 + ((idx * 37) % 13) * 0.006, 0.7, 0.55 + ((idx * 11) % 7) * 0.04); this.windows.setColorAt(idx, this.warm); } else this.windows.setColorAt(idx, this.dark); }
    if (this.windows.instanceColor) this.windows.instanceColor.needsUpdate = true;
    if (this.streetLights) { const ns = Math.floor(f * this.streetLights.count); for (let i = 0; i < this.streetLights.count; i++) this.streetLights.setColorAt(i, i < ns ? this.warm.setRGB(1.0, 0.75, 0.4) : this.dark); if (this.streetLights.instanceColor) this.streetLights.instanceColor.needsUpdate = true; }
  }
}
