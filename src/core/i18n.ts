export type Lang = 'en' | 'es';
type Dict = Record<string, [string, string]>;

const D: Dict = {
  // menu
  continue: ['Continue', 'Continuar'], towers: ['Towers', 'Torres'], gallery: ['Gallery', 'Galería'], settings: ['Settings', 'Ajustes'], back: ['Back', 'Volver'],
  tagline: ['Restore the network. One antenna at a time.', 'Restaura la red. Una antena a la vez.'],
  credits: ['Credits', 'Créditos'], language: ['Language', 'Idioma'], invertY: ['Invert look Y', 'Invertir eje Y'], sound: ['Sound', 'Sonido'], on: ['On', 'Sí'], off: ['Off', 'No'],
  fov: ['Field of view', 'Campo de visión'], reduceMotion: ['Reduce motion', 'Reducir movimiento'], leftHanded: ['Left-handed touch layout', 'Controles táctiles para zurdos'],
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
  // radio
  whoDispatch: ['DISPATCH', 'CENTRAL'], whoYou: ['YOU', 'TÚ'], whoUnknown: ['?????', '?????'],
  // settings
  quality: ['Graphics quality', 'Calidad gráfica'], qAuto: ['Auto', 'Auto'], qLow: ['Low', 'Baja'], qMedium: ['Medium', 'Media'], qHigh: ['High', 'Alta'],
  gripMode: ['Grip control', 'Control de agarre'], gripHold: ['Hold to grip', 'Mantener para agarrar'], gripTap: ['Tap to move a hand', 'Tocar para mover la mano'],
  // resume
  resumeClimb: ['Resume climb', 'Reanudar subida'], platformAt: ['platform at', 'plataforma a'],
  // protection
  arrester: ['CABLE GRAB', 'ANTICAÍDAS'], noCable: ['NO CABLE — cable grab useless here', 'SIN CABLE — el anticaídas no sirve aquí'], arresterOn: ['The cable grab rides with you', 'El anticaídas te sigue por el cable'],
  ice: ['Ice on the rungs', 'Hielo en los peldaños'],
  // work points
  wPage: ['Read the logbook page', 'Leer la página de bitácora'], wFragment: ['Capture the signal fragment', 'Capturar el fragmento de señal'], wInspect: ['Inspect', 'Inspeccionar'],
  needAnalyzer: ['A stray signal here. You need the analyzer.', 'Aquí hay una señal extraña. Necesitas el analizador.'],
  missingGear: ['Missing required gear', 'Falta equipo necesario'],
  // tutorial (keyboard / touch variants)
  tutWalkK: ['Walk to the foot of the ladder: WASD, mouse to look', 'Camina hasta el pie de la escalera: WASD, ratón para mirar'],
  tutWalkT: ['Walk to the foot of the ladder with the left stick. Drag to look.', 'Camina hasta el pie de la escalera con el joystick. Arrastra para mirar.'],
  tutHoldK: ['Hold both mouse buttons: each one is a hand on a rung', 'Mantén los dos botones del ratón: cada uno es una mano en un peldaño'],
  tutHoldT: ['Hold L and R: each one is a hand on a rung', 'Mantén I y D: cada uno es una mano en un peldaño'],
  tutMoveK: ['Let go with one hand, look up, grab again. Then the other hand.', 'Suelta una mano, mira arriba y vuelve a agarrar. Luego la otra.'],
  tutMoveT: ['Let go of one button and press it again: that hand grabs higher. Alternate.', 'Suelta un botón y vuelve a pulsarlo: esa mano agarra más arriba. Alterna.'],
  tutTap: ['Tap a grip to move that hand up. Alternate hands.', 'Toca un agarre para subir esa mano. Alterna las manos.'],
  tutClipK: ['Clip your lanyard to the yellow cable: Space', 'Ancla tu cabo al cable amarillo: Espacio'],
  tutClipT: ['Clip your lanyard to the yellow cable: CLIP', 'Ancla tu cabo al cable amarillo: ANCLA'],
  tutRhythm: ['Climb until the lanyard goes taut, then clip the next anchor', 'Sube hasta que el cabo se tense y ancla en el siguiente punto'],
  tutPlatform: ['Platforms are safe: they restore stamina and save your progress', 'Las plataformas son seguras: recuperan aguante y guardan tu progreso'],
};

let lang: Lang = 'en';
export const setLang = (l: Lang) => { lang = l; };
export const getLang = () => lang;
export const t = (k: string): string => { const e = D[k]; if (!e) return k; return lang === 'es' ? e[1] : e[0]; };
export const pick = (en: string, es: string) => (lang === 'es' ? es : en);
