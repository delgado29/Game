export type Lang = 'en' | 'es';
type Dict = Record<string, [string, string]>;

const D: Dict = {
  // menu
  continue: ['Continue', 'Continuar'], towers: ['Towers', 'Torres'], gallery: ['Gallery', 'Galería'], settings: ['Settings', 'Ajustes'], back: ['Back', 'Volver'],
  tagline: ['Restore the network. One antenna at a time.', 'Restaura la red. Una antena a la vez.'],
  credits: ['Credits', 'Créditos'], language: ['Language', 'Idioma'], invertY: ['Invert look Y', 'Invertir eje Y'], sound: ['Sound', 'Sonido'], on: ['On', 'Sí'], off: ['Off', 'No'],
  resetSave: ['Reset progress', 'Borrar progreso'], resetConfirm: ['Erase all progress and photos?', '¿Borrar todo el progreso y las fotos?'],
  noPhotos: ['No photos yet. Bring the camera and press C on the tower.', 'Aún no hay fotos. Lleva la cámara y pulsa C en la torre.'],
  locked: ['Locked', 'Bloqueada'], restored: ['Restored', 'Restaurada'], climb: ['Climb', 'Escalar'], height: ['Height', 'Altura'], best: ['Best time', 'Mejor tiempo'],
  // loadout
  loadout: ['Loadout', 'Equipo'], pack: ['Pack', 'Mochila'], tooHeavy: ['Too heavy. Leave something in the van.', 'Demasiado peso. Deja algo en la furgoneta.'],
  buy: ['Buy', 'Comprar'], owned: ['Owned', 'Tuyo'], equipped: ['Equipped', 'Puesto'], start: ['Start the climb', 'Empezar la subida'], forecast: ['Forecast', 'Pronóstico'],
  required: ['Required for this job', 'Necesario para este trabajo'],
  // hud
  altitude: ['ALT', 'ALT'], stamina: ['Stamina', 'Aguante'], wind: ['Wind', 'Viento'], clipped: ['Clipped', 'Anclado'], unclipped: ['UNCLIPPED', 'SIN ANCLAR'],
  brace: ['GUST — HOLD ON!', '¡RÁFAGA — AGÁRRATE!'], noAnchor: ['No anchor in reach — cable cut', 'Sin anclaje al alcance — cable cortado'],
  reclip: ['Leash taut — re-clip', 'Cabo tenso — vuelve a anclar'], clipHint: ['Clip to anchor', 'Anclar mosquetón'],
  grabLadder: ['Grab the ladder', 'Agarra la escalera'], stepOff: ['Step onto the platform', 'Pasa a la plataforma'], stepDown: ['Step down', 'Bajar'],
  rest: ['Rest and look around', 'Descansar y mirar'], stopRest: ['Any key to continue', 'Cualquier tecla para seguir'],
  repair: ['Repair the transmitter', 'Reparar el transmisor'], hold: ['Hold', 'Mantén'],
  rOpen: ['Opening the panel', 'Abriendo el panel'], rFuse: ['Replacing the fuse', 'Cambiando el fusible'], rBattery: ['Installing the battery pack', 'Instalando la batería'],
  rFeed: ['Reconnecting the feed line', 'Reconectando la línea'], rTune: ['Tuning the carrier', 'Ajustando la portadora'], rDone: ['TRANSMITTER ONLINE', 'TRANSMISOR EN LÍNEA'],
  needBattery: ['Dead cells. You need a battery pack for this one.', 'Celdas muertas. Necesitas una batería para esta.'],
  needTools: ['You left the repair tools in the van.', 'Dejaste las herramientas en la furgoneta.'],
  fell: ['You fell.', 'Caíste.'], caught: ['The harness caught you.', 'El arnés te sujetó.'], shocked: ['SHOCK', 'DESCARGA'], rungSnap: ['The rung snapped!', '¡El peldaño se rompió!'],
  slipping: ['Hands slipping', 'Se resbalan las manos'], stumble: ['You stumbled.', 'Tropezaste.'],
  twoHands: ['BOTH HANDS!', '¡LAS DOS MANOS!'], arcWarn: ['LIVE BOX — wait for the arc', 'CAJA CON CORRIENTE — espera el arco'], arcNow: ['ARCING', 'ARCO'], retry: ['Back to the last platform', 'Volver a la última plataforma'],
  photoSaved: ['Photo saved', 'Foto guardada'], descend: ['Get back down to the van', 'Vuelve a bajar a la furgoneta'],
  objTop: ['Reach the transmitter', 'Llega al transmisor'], objVan: ['Return to the van', 'Vuelve a la furgoneta'],
  // debrief
  jobDone: ['Job done', 'Trabajo hecho'], jobFailed: ['Job unfinished', 'Trabajo sin terminar'], time: ['Time', 'Tiempo'], falls: ['Falls', 'Caídas'], maxAlt: ['Max altitude', 'Altura máxima'],
  earned: ['Earned', 'Ganado'], photos: ['Photos', 'Fotos'], toVan: ['Back to the van', 'A la furgoneta'], newTower: ['New tower unlocked', 'Nueva torre desbloqueada'],
  // touch
  tL: ['L', 'I'], tR: ['R', 'D'], tClip: ['CLIP', 'ANCLA'], tAct: ['ACT', 'USAR'], tRest: ['REST', 'DESC.'], tPhoto: ['PHOTO', 'FOTO'],
  clickToPlay: ['Click to take the controls', 'Haz clic para tomar los controles'],
  controls: ['Mouse: look · WASD: walk · Hold LMB/RMB (or Q/E): left/right hand · Space: clip · F: use · V: rest · C: photo · Esc: menu', 'Ratón: mirar · WASD: andar · Mantén clic izq/der (o Q/E): mano izq/der · Espacio: anclar · F: usar · V: descansar · C: foto · Esc: menú'],
  quit: ['Abandon climb', 'Abandonar'], resume: ['Resume', 'Seguir'], paused: ['Paused', 'Pausa'],
};

let lang: Lang = 'en';
export const setLang = (l: Lang) => { lang = l; };
export const getLang = () => lang;
export const t = (k: string): string => { const e = D[k]; if (!e) return k; return lang === 'es' ? e[1] : e[0]; };
export const pick = (en: string, es: string) => (lang === 'es' ? es : en);
