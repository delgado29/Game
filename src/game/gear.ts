import { save } from '../core/save';

export interface Gear {
  id: string; en: string; es: string; kg: number; price: number; descEn: string; descEs: string;
  /** Always worn, cannot be left in the van. */ fixed?: boolean;
  /** Rank needed before the shop sells it. */ rank?: number;
  /** Upgradeable up to level 3. `lv` describes what each level gives. */ lv?: { en: string; es: string }[];
  /** Weight per level, when upgrades make it lighter. */ kgLv?: number[];
}

export const GEAR: Gear[] = [
  { id: 'harness', en: 'Harness & lanyard', es: 'Arnés y cabo', kg: 1.2, price: 0, fixed: true, descEn: 'Your fall-arrest harness. Never leaves your body.', descEs: 'Tu arnés anticaídas. Nunca sale de tu cuerpo.' },
  { id: 'tools', en: 'Repair tools', es: 'Herramientas', kg: 2.0, price: 0, descEn: 'Fuses, crimpers, a multimeter. No tools, no repair.', descEs: 'Fusibles, crimpadora, multímetro. Sin ellas no hay reparación.',
    kgLv: [2.0, 1.6, 1.3], lv: [{ en: '2.0 kg', es: '2,0 kg' }, { en: 'Aluminium set: 1.6 kg', es: 'Juego de aluminio: 1,6 kg' }, { en: 'Titanium set: 1.3 kg', es: 'Juego de titanio: 1,3 kg' }] },
  { id: 'gloves', en: 'Climbing gloves', es: 'Guantes', kg: 0.5, price: 120, descEn: 'Grip that holds in rain and on ice. Hands tire slower.', descEs: 'Agarre que aguanta lluvia y hielo. Las manos se cansan menos.',
    lv: [{ en: '−20% fatigue', es: '−20% fatiga' }, { en: '−30% fatigue', es: '−30% fatiga' }, { en: '−40% fatigue', es: '−40% fatiga' }] },
  { id: 'carabiner', en: 'Long lanyard', es: 'Cabo largo', kg: 0.4, price: 150, descEn: 'A longer leash: climb further between anchors.', descEs: 'Un cabo más largo: sube más entre anclajes.',
    lv: [{ en: '4.6 m', es: '4,6 m' }, { en: '5.2 m', es: '5,2 m' }, { en: '5.8 m', es: '5,8 m' }] },
  { id: 'wradio', en: 'Weather radio', es: 'Radio meteo', kg: 0.8, price: 200, descEn: 'Gust warnings arrive earlier.', descEs: 'Los avisos de ráfaga llegan antes.',
    lv: [{ en: '+3 s warning', es: '+3 s de aviso' }, { en: '+4 s warning', es: '+4 s de aviso' }, { en: '+5 s warning', es: '+5 s de aviso' }] },
  { id: 'analyzer', en: 'Signal analyzer', es: 'Analizador', kg: 1.2, price: 300, descEn: 'Tunes the carrier instantly and captures stray signal fragments.', descEs: 'Ajusta la portadora al instante y captura fragmentos de señal.' },
  { id: 'camera', en: 'Camera', es: 'Cámara', kg: 0.7, price: 90, descEn: 'Press C up there. Photo assignments pay.', descEs: 'Pulsa C allá arriba. Los encargos fotográficos pagan.' },
  { id: 'battery', en: 'Battery pack', es: 'Batería', kg: 3.5, price: 250, descEn: 'Replacement cells for dead transmitters. Heavy.', descEs: 'Celdas de repuesto para transmisores muertos. Pesa.',
    kgLv: [3.5, 3.0, 2.5], lv: [{ en: '3.5 kg', es: '3,5 kg' }, { en: 'Lithium cells: 3.0 kg', es: 'Celdas de litio: 3,0 kg' }, { en: 'Dense cells: 2.5 kg', es: 'Celdas densas: 2,5 kg' }] },
  { id: 'drone', en: 'Scout drone', es: 'Dron', kg: 2.5, price: 450, descEn: 'Scouts the tower first: broken rungs and live boxes get marked.', descEs: 'Explora la torre antes: marca peldaños rotos y cajas con corriente.' },
  { id: 'rations', en: 'Water & gels', es: 'Agua y geles', kg: 0.6, price: 60, descEn: 'More stamina, faster recovery on platforms.', descEs: 'Más aguante y recuperación más rápida en plataformas.',
    lv: [{ en: '+30 stamina', es: '+30 aguante' }, { en: '+45 stamina', es: '+45 aguante' }, { en: '+60 stamina', es: '+60 aguante' }] },
  { id: 'headlamp', en: 'Headlamp', es: 'Frontal', kg: 0.3, price: 180, rank: 1, descEn: 'Light for night shifts. Required after dark.', descEs: 'Luz para turnos de noche. Obligatorio a oscuras.' },
  { id: 'arrester', en: 'Cable grab', es: 'Anticaídas deslizante', kg: 1.5, price: 700, rank: 3, descEn: 'Rides the safety cable with you: no re-clipping while the cable is intact. Useless where it is cut.', descEs: 'Te sigue por el cable de seguridad: sin reanclar mientras el cable esté intacto. Inútil donde está cortado.' },
];
/** The backpack itself is upgraded, not carried as an item. */
export const PACK_LV = [8, 9, 10];
export const PACK_PRICE = [0, 220, 480];

export const gearById = (id: string) => GEAR.find((g) => g.id === id)!;
export const gearLevel = (id: string) => Math.min(3, Math.max(1, save.gearLv[id] ?? 1));
export const gearKg = (id: string) => { const g = gearById(id); if (!g) return 0; return g.kgLv ? g.kgLv[gearLevel(id) - 1] : g.kg; };
export const packWeight = (ids: string[]) => ids.reduce((s, id) => s + gearKg(id), 0);
export const packCapacity = () => PACK_LV[gearLevel('pack') - 1];
/** Cost of taking an item from its current level to the next, or null at max / not upgradeable. */
export const upgradeCost = (id: string): number | null => {
  const lv = gearLevel(id);
  if (id === 'pack') return lv >= 3 ? null : PACK_PRICE[lv];
  const g = gearById(id); if (!g?.lv || lv >= 3) return null;
  return Math.round(Math.max(120, g.price) * 0.9 * lv);
};

/** What the loadout actually does on the tower. */
export interface Perks {
  weight: number; fatigueMul: number; gloves: boolean; leash: number; maxStamina: number; regen: number; warnLead: number;
  tools: boolean; battery: boolean; analyzer: boolean; camera: boolean; drone: boolean; headlamp: boolean; arrester: boolean;
}
export function buildPerks(loadout: string[]): Perks {
  const has = (id: string) => loadout.includes(id); const lv = (id: string) => gearLevel(id);
  return {
    weight: packWeight(loadout),
    gloves: has('gloves'), fatigueMul: has('gloves') ? [0.8, 0.7, 0.6][lv('gloves') - 1] : 1,
    leash: has('carabiner') ? [4.6, 5.2, 5.8][lv('carabiner') - 1] : 3.4,
    maxStamina: 100 + (has('rations') ? [30, 45, 60][lv('rations') - 1] : 0),
    regen: has('rations') ? [18, 21, 24][lv('rations') - 1] : 12,
    warnLead: 1.5 + (has('wradio') ? [3, 4, 5][lv('wradio') - 1] : 0),
    tools: has('tools'), battery: has('battery'), analyzer: has('analyzer'), camera: has('camera'), drone: has('drone'),
    headlamp: has('headlamp'), arrester: has('arrester'),
  };
}
