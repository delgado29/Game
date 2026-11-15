import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Quality } from '../core/quality';

export interface LensFx { rain: number; aberration: number; time: number; }

/** Lens pass: rain on the glass, chromatic fringing on impacts, vignette, a gentle grade and grain. Runs in linear HDR before tone mapping. */
const LensShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, uRain: { value: 0 }, uAberr: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1.6 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uRain, uAberr, uTime, uAspect; varying vec2 vUv;
    float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    // one layer of droplets sliding down the glass: xy = refraction offset in uv, z = coverage
    vec3 drops(vec2 uv, float scale, float t){
      vec2 g = uv * vec2(uAspect, 1.0) * scale;
      g.y += t * (0.05 + 0.12 * h21(vec2(floor(g.x), 3.1)));
      vec2 id = floor(g); vec2 f = fract(g) - 0.5;
      if (h21(id + 7.7) > uRain * 0.28) return vec3(0.0);
      vec2 c = (vec2(h21(id + 1.3), h21(id + 2.9)) - 0.5) * 0.6; float r = 0.05 + 0.08 * h21(id + 4.1);
      vec2 d = f - c; d.y *= 0.75; float l = length(d);
      float m = smoothstep(r, r * 0.35, l);
      return vec3(-d * m * 1.3 / (scale * vec2(uAspect, 1.0)), m);
    }
    void main(){
      vec2 uv = vUv; vec3 dr = vec3(0.0);
      if (uRain > 0.05) { dr = drops(uv, 11.0, uTime) + drops(uv + 0.37, 19.0, uTime * 1.3); uv += dr.xy; }
      vec2 c = uv - 0.5; float r2 = dot(c, c);
      vec3 col;
      if (uAberr > 0.001) { vec2 o = c * r2 * uAberr * 0.06; col = vec3(texture2D(tDiffuse, uv + o).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - o).b); }
      else col = texture2D(tDiffuse, uv).rgb;
      col = col * (1.0 - dr.z * 0.08) + dr.z * 0.02;
      // grade: a little more saturation, cool shadows, warm highlights
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.10);
      col *= mix(vec3(0.96, 1.0, 1.05), vec3(1.04, 1.0, 0.95), smoothstep(0.05, 0.9, l));
      // vignette and grain
      col *= 1.0 - smoothstep(0.18, 0.85, r2) * 0.42;
      col += (h21(vUv * 913.0 + fract(uTime) * 71.0) - 0.5) * 0.018 * sqrt(l + 0.02);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

/** Owns the render path: direct on low quality, composer (MSAA + bloom + lens + output) otherwise. */
export class Post {
  private composer: EffectComposer | null = null; private renderPass: RenderPass | null = null;
  private bloom: UnrealBloomPass | null = null; private lens: ShaderPass | null = null;
  private w = 1; private h = 1; private dpr = 1;
  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private q: Quality) { this.build(); }
  private build() {
    this.composer?.dispose(); this.composer = null;
    if (!this.q.composer) return;
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: this.q.msaa });
    const c = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, new THREE.PerspectiveCamera()); c.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 1.0); c.addPass(this.bloom);
    this.lens = new ShaderPass(LensShader); c.addPass(this.lens);
    c.addPass(new OutputPass());
    this.composer = c; this.applySize();
  }
  setQuality(q: Quality) { this.q = q; this.build(); }
  setSize(w: number, h: number, dpr: number) { this.w = w; this.h = h; this.dpr = dpr; this.applySize(); }
  private applySize() {
    this.renderer.setPixelRatio(this.dpr); this.renderer.setSize(this.w, this.h, false);
    if (this.composer) { this.composer.setPixelRatio(this.dpr); this.composer.setSize(this.w, this.h); }
    if (this.lens) this.lens.uniforms.uAspect.value = this.w / Math.max(1, this.h);
  }
  render(camera: THREE.Camera, fx: LensFx) {
    if (!this.composer || !this.renderPass || !this.lens) { this.renderer.render(this.scene, camera); return; }
    this.renderPass.camera = camera;
    const u = this.lens.uniforms; u.uRain.value = fx.rain; u.uAberr.value = fx.aberration; u.uTime.value = fx.time;
    this.composer.render();
  }
}
