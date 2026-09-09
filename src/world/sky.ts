import * as THREE from 'three';
import { clamp, lerp } from '../core/math';

/** Gradient sky dome with sun, haze, stars and overcast/lightning uniforms. Also owns the scene fog. */
export class Sky {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  sun = new THREE.DirectionalLight(0xffe0b0, 2.2);
  hemi = new THREE.HemisphereLight(0x9ec4ff, 0x3a4a30, 0.7);
  fog: THREE.FogExp2;
  sunAzimuth = 0.9; sunElev = 0.45; // radians
  overcast = 0; flash = 0; night = 0;
  constructor(scene: THREE.Scene) {
    this.mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sunDir: { value: new THREE.Vector3(0, 1, 0) }, overcast: { value: 0 }, night: { value: 0 }, flash: { value: 0 }, time: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }`,
      fragmentShader: `
        uniform vec3 sunDir; uniform float overcast, night, flash, time; varying vec3 vDir;
        float hash(vec3 p){ p = fract(p*0.3183099+vec3(0.1,0.2,0.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        void main(){
          vec3 d = normalize(vDir); float e = d.y; float sunE = sunDir.y;
          float dusk = smoothstep(0.35, -0.05, sunE);
          vec3 zenithDay = vec3(0.22,0.45,0.85), horizDay = vec3(0.70,0.80,0.92);
          vec3 zenithDusk = vec3(0.12,0.10,0.30), horizDusk = vec3(0.95,0.48,0.28);
          vec3 zenithNight = vec3(0.01,0.015,0.04), horizNight = vec3(0.05,0.06,0.10);
          vec3 zen = mix(mix(zenithDay, zenithDusk, dusk), zenithNight, night);
          vec3 hor = mix(mix(horizDay, horizDusk, dusk), horizNight, night);
          float t = pow(clamp(1.0 - max(e,0.0), 0.0, 1.0), 2.5);
          vec3 col = mix(zen, hor, t);
          // ground half fades to a dark haze
          col = mix(col, hor*0.55, smoothstep(0.0, -0.25, e));
          // sun glow and disc
          float sd = max(dot(d, sunDir), 0.0);
          vec3 sunCol = mix(vec3(1.0,0.95,0.85), vec3(1.0,0.55,0.25), dusk);
          col += sunCol * pow(sd, 6.0) * 0.35 * (1.0-overcast*0.8) * (1.0-night);
          col += sunCol * smoothstep(0.9985, 0.9993, sd) * 2.0 * (1.0-overcast) * (1.0-night);
          // horizon haze band near the sun at dusk
          col += horizDusk * dusk * pow(sd,2.0) * smoothstep(0.3,-0.05,e) * 0.5 * (1.0-night);
          // overcast: flatten to grey, darker toward zenith
          vec3 grey = mix(vec3(0.55,0.58,0.62), vec3(0.28,0.30,0.34), clamp(e*1.5,0.0,1.0)) * (1.0-night*0.85) * (1.0 - dusk*0.35);
          col = mix(col, grey, overcast*0.9);
          // stars
          vec3 sp = floor(d*220.0); float s = hash(sp); float star = step(0.9965, s) * (0.6+0.4*sin(time*2.0+s*50.0));
          col += vec3(star) * clamp(night*1.4 + dusk*0.2, 0.0, 1.0) * (1.0-overcast) * smoothstep(0.0,0.15,e);
          col += vec3(0.9,0.95,1.0) * flash;
          col += (hash(d*1234.5 + time*0.01) - 0.5) * (1.0/128.0); // dither against banding
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -10;
    scene.add(this.mesh, this.sun, this.hemi);
    this.fog = new THREE.FogExp2(0xa0b0c0, 0.0012); scene.fog = this.fog;
    scene.background = null;
  }
  update(dt: number, cameraPos: THREE.Vector3, rain: number) {
    this.mesh.position.copy(cameraPos);
    const dir = new THREE.Vector3(Math.cos(this.sunAzimuth) * Math.cos(this.sunElev), Math.sin(this.sunElev), Math.sin(this.sunAzimuth) * Math.cos(this.sunElev));
    this.mat.uniforms.sunDir.value.copy(dir); this.mat.uniforms.overcast.value = this.overcast; this.mat.uniforms.flash.value = this.flash; this.mat.uniforms.time.value += dt;
    this.night = clamp(-this.sunElev / 0.25, 0, 1); this.mat.uniforms.night.value = this.night;
    this.sun.position.copy(dir).multiplyScalar(500).add(cameraPos); this.sun.target.position.copy(cameraPos); this.sun.target.updateMatrixWorld();
    const dusk = clamp((0.35 - this.sunElev) / 0.4, 0, 1);
    const sunI = clamp(this.sunElev / 0.15, 0, 1) * (1 - this.overcast * 0.75) * 2.2;
    this.sun.intensity = sunI + this.flash * 3;
    this.sun.color.setRGB(1, lerp(0.92, 0.55, dusk), lerp(0.8, 0.3, dusk));
    const hemiI = lerp(0.75, 0.12, this.night) * (1 - this.overcast * 0.35) + this.flash * 2;
    this.hemi.intensity = hemiI;
    this.hemi.color.setRGB(lerp(0.62, 0.15, this.night) * (1 - this.overcast * 0.3), lerp(0.77, 0.18, this.night) * (1 - this.overcast * 0.2), lerp(1.0, 0.3, this.night));
    // fog colour tracks the horizon
    const horizDay = new THREE.Color(0.70, 0.80, 0.92), horizDusk = new THREE.Color(0.85, 0.5, 0.35), horizNight = new THREE.Color(0.05, 0.06, 0.10), grey = new THREE.Color(0.5, 0.53, 0.57);
    const fc = horizDay.clone().lerp(horizDusk, dusk).lerp(horizNight, this.night).lerp(grey.multiplyScalar(1 - this.night * 0.85), this.overcast * 0.9);
    fc.r += this.flash * 0.5; fc.g += this.flash * 0.5; fc.b += this.flash * 0.5;
    this.fog.color.copy(fc);
    this.fog.density = 0.0008 + this.overcast * 0.0008 + rain * 0.0009;
  }
}
