import * as THREE from 'three';

/** Everything a photo assignment may look at when the shutter fires. */
export interface PhotoCtx {
  alt: number; towerHeight: number; sunElev: number; fwd: THREE.Vector3; sunDir: THREE.Vector3;
  toTown: THREE.Vector3; townLit: number; toVan: THREE.Vector3; toBirds: THREE.Vector3; birdsBelow: boolean;
  flash: number; resting: boolean; inCut: boolean; aboveClouds: boolean;
}
export interface PhotoGoal { id: string; en: string; es: string; hintEn: string; hintEs: string; test: (c: PhotoCtx) => boolean; }

export const PHOTO_GOALS: PhotoGoal[] = [
  { id: 'sunset', en: 'Golden hour', es: 'Hora dorada', hintEn: 'The low sun from above 60 m', hintEs: 'El sol bajo desde más de 60 m', test: (c) => c.alt >= 60 && c.sunElev > -0.06 && c.sunElev < 0.3 && c.fwd.dot(c.sunDir) > 0.55 },
  { id: 'town', en: 'Lights on', es: 'Luces encendidas', hintEn: 'The town, lit, from the tower', hintEs: 'El pueblo iluminado desde la torre', test: (c) => c.alt >= 20 && c.townLit > 0.8 && c.fwd.dot(c.toTown) > 0.85 },
  { id: 'lightning', en: 'Strike', es: 'Rayo', hintEn: 'Catch a lightning flash', hintEs: 'Captura el destello de un rayo', test: (c) => c.flash > 0.2 },
  { id: 'birds', en: 'Above the birds', es: 'Por encima de las aves', hintEn: 'The flock, from above', hintEs: 'La bandada, vista desde arriba', test: (c) => c.birdsBelow && c.fwd.dot(c.toBirds) > 0.8 },
  { id: 'van', en: 'Tiny van', es: 'Furgoneta diminuta', hintEn: 'Your van from the top platform', hintEs: 'Tu furgoneta desde la plataforma superior', test: (c) => c.alt >= c.towerHeight - 1.5 && c.fwd.dot(c.toVan) > 0.9 },
  { id: 'clouds', en: 'Sea of clouds', es: 'Mar de nubes', hintEn: 'From above the cloud deck', hintEs: 'Desde encima del banco de nubes', test: (c) => c.aboveClouds },
  { id: 'cut', en: 'Evidence', es: 'Prueba', hintEn: 'A cut safety cable, up close', hintEs: 'Un cable de seguridad cortado, de cerca', test: (c) => c.inCut },
  { id: 'selfie', en: 'Break time', es: 'Hora del descanso', hintEn: 'Yourself, resting on a platform', hintEs: 'Tú, descansando en una plataforma', test: (c) => c.resting },
];
/** First assignment this shot satisfies that is not already done. */
export const matchGoal = (c: PhotoCtx, done: string[]) => PHOTO_GOALS.find((g) => !done.includes(g.id) && g.test(c)) ?? null;
