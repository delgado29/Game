export interface Gear { id: string; en: string; es: string; kg: number; price: number; descEn: string; descEs: string; fixed?: boolean; }

export const PACK_CAPACITY = 8;

export const GEAR: Gear[] = [
  { id: 'harness', en: 'Harness & lanyard', es: 'Arnés y cabo', kg: 1.2, price: 0, fixed: true, descEn: 'Your fall-arrest harness. Never leaves your body.', descEs: 'Tu arnés anticaídas. Nunca sale de tu cuerpo.' },
  { id: 'tools', en: 'Repair tools', es: 'Herramientas', kg: 2.0, price: 0, descEn: 'Fuses, crimpers, a multimeter. No tools, no repair.', descEs: 'Fusibles, crimpadora, multímetro. Sin ellas no hay reparación.' },
  { id: 'gloves', en: 'Climbing gloves', es: 'Guantes', kg: 0.5, price: 120, descEn: 'Grip that holds in the rain. Hands tire 20% slower.', descEs: 'Agarre que aguanta la lluvia. Las manos se cansan un 20% menos.' },
  { id: 'carabiner', en: 'Long lanyard', es: 'Cabo largo', kg: 0.4, price: 150, descEn: 'A longer leash: climb further between anchors.', descEs: 'Un cabo más largo: sube más entre anclajes.' },
  { id: 'wradio', en: 'Weather radio', es: 'Radio meteo', kg: 0.8, price: 200, descEn: 'Gust warnings arrive three seconds earlier.', descEs: 'Los avisos de ráfaga llegan tres segundos antes.' },
  { id: 'analyzer', en: 'Signal analyzer', es: 'Analizador', kg: 1.2, price: 300, descEn: 'Tunes the carrier instantly at the transmitter.', descEs: 'Ajusta la portadora al instante en el transmisor.' },
  { id: 'camera', en: 'Camera', es: 'Cámara', kg: 0.7, price: 90, descEn: 'Press C up there. Build a collection nobody will believe.', descEs: 'Pulsa C allá arriba. Una colección que nadie creerá.' },
  { id: 'battery', en: 'Battery pack', es: 'Batería', kg: 3.5, price: 250, descEn: 'Replacement cells for dead transmitters. Heavy.', descEs: 'Celdas de repuesto para transmisores muertos. Pesa.' },
  { id: 'drone', en: 'Scout drone', es: 'Dron', kg: 2.5, price: 450, descEn: 'Scouts the tower first: broken rungs and live boxes get marked.', descEs: 'Explora la torre antes: marca peldaños rotos y cajas con corriente.' },
  { id: 'rations', en: 'Water & gels', es: 'Agua y geles', kg: 0.6, price: 60, descEn: '+30 stamina, recovers faster on platforms.', descEs: '+30 aguante y recuperas más rápido en plataformas.' },
];
export const gearById = (id: string) => GEAR.find((g) => g.id === id)!;
export const packWeight = (ids: string[]) => ids.reduce((s, id) => s + (gearById(id)?.kg ?? 0), 0);
