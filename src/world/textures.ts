import * as THREE from 'three';
import { rng } from '../core/math';

/** Procedural canvas textures: rusty steel, grating, gravel. */
function canvas(size: number) { const c = document.createElement('canvas'); c.width = c.height = size; return [c, c.getContext('2d')!] as const; }

export function steelTexture(seed = 1): THREE.CanvasTexture {
  const [c, g] = canvas(256); const r = rng(seed);
  g.fillStyle = '#8e949c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const v = 120 + r.int(60); g.fillStyle = `rgba(${v},${v + 4},${v + 10},${0.25 + r.next() * 0.4})`; g.fillRect(r.int(256), r.int(256), 1 + r.int(3), 1 + r.int(14)); }
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(${120 + r.int(60)},${60 + r.int(30)},${20 + r.int(20)},${0.15 + r.next() * 0.45})`; const x = r.int(256), y = r.int(256); g.beginPath(); g.ellipse(x, y, 2 + r.int(9), 2 + r.int(22), 0, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function gratingTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128); g.fillStyle = '#3a3e44'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#14161a';
  for (let y = 4; y < 128; y += 16) for (let x = 4; x < 128; x += 8) g.fillRect(x, y, 5, 11);
  g.fillStyle = 'rgba(160,110,70,0.25)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function gloveTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(64); g.fillStyle = '#d9661f'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#222'; g.fillRect(0, 40, 64, 24); g.fillStyle = 'rgba(255,255,255,0.15)'; for (let i = 0; i < 60; i++) g.fillRect(Math.random() * 64, Math.random() * 40, 2, 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function panelTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128); g.fillStyle = '#5c6670'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#2b3138'; g.fillRect(12, 12, 104, 60); g.fillStyle = '#c8cf36'; g.fillRect(16, 84, 30, 6); g.fillStyle = '#e04a3a'; g.fillRect(52, 84, 30, 6); g.fillStyle = '#ddd'; g.font = 'bold 12px monospace'; g.fillText('TX-4  ⚡', 16, 108);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
