import { GEAR, PACK_LV, gearById, gearKg, gearLevel, packCapacity, packWeight, upgradeCost, type Gear } from '../game/gear';
import { TOWERS, towerById } from '../game/towers';
import { MEDALS, RANKS, foundOn, hasMedal, milestones, rankName, rankOf, rankProgress, type LedgerLine, type MedalId } from '../game/career';
import { KINDS, contractDone, contractsFor, dailyContracts, type Contract } from '../game/contracts';
import { PHOTO_GOALS } from '../game/photos';
import { getLang, pick, t } from '../core/i18n';
import { persist, save } from '../core/save';
import { fmtTime } from '../core/math';
import { B } from '../game/balance';
import type { TowerSpec } from '../game/types';

export type Screen = 'van' | 'map' | 'loadout' | 'career' | 'logbook' | 'settings' | 'gallery' | 'debrief' | 'pause' | 'dead' | 'none';
/** A thing to go and do: restore a tower (no contract) or run a contract on a restored one. */
export interface Job { towerId: string; contract: Contract | null; }
export interface DebriefData {
  job: Job; time: number; falls: number; maxAlt: number; late: boolean;
  lines: LedgerLine[]; xpBefore: number; xpAfter: number; medals: MedalId[]; unlocks: string[];
}
export interface MenuCallbacks {
  onStart: (job: Job) => void; onResumeClimb: () => void; onSetting: () => void; onReset: () => void;
  onResume: () => void; onAbandon: () => void; onRespawn: () => void; onToVan: () => void;
}

const h = (html: string) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild as HTMLElement; };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const roman = ['I', 'II', 'III'];
export const jobName = (job: Job) => (job.contract ? pick(KINDS[job.contract.kind].en, KINDS[job.contract.kind].es) : pick('Restore the transmitter', 'Restaurar el transmisor'));
const platformHeights = (tw: TowerSpec) => [...tw.platforms, tw.height].sort((a, b) => a - b);
const forecast = (tw: TowerSpec, c: Contract | null) => {
  if (c?.kind === 'storm') return pick('storm on site', 'tormenta en el sitio'); if (c?.kind === 'night') return pick('clear night', 'noche despejada');
  const wx = tw.weather[tw.weather.length - 1].target; if (c) return pick('settled', 'estable');
  return wx.storm > 0.6 ? pick('storm front late', 'frente de tormenta al final') : wx.rain > 0.3 ? pick('rain later', 'lluvia más tarde') : pick('clear, light wind', 'despejado, viento flojo');
};

export class Menus {
  root: HTMLElement; screen: Screen = 'none';
  /** Tower highlighted on the map, and the job being prepared in the loadout. */
  sel = 'pinegrove'; job: Job = { towerId: 'pinegrove', contract: null };
  private debrief: DebriefData | null = null;
  constructor(parent: HTMLElement, private cb: MenuCallbacks) {
    this.root = document.createElement('div'); this.root.style.cssText = 'position:absolute;inset:0;pointer-events:none;'; parent.appendChild(this.root);
  }
  show(screen: Screen, data?: DebriefData) { this.screen = screen; if (data) this.debrief = data; this.render(); }
  private render() {
    const keepScroll = this.root.querySelector('.panel')?.scrollTop ?? 0;
    this.root.innerHTML = ''; const s = this.screen; if (s === 'none') return;
    const wrap = h(`<div class="screen ${s === 'van' ? 'left' : ''}"></div>`); this.root.appendChild(wrap);
    ({ van: this.renderVan, map: this.renderMap, loadout: this.renderLoadout, career: this.renderCareer, logbook: this.renderLogbook, settings: this.renderSettings,
      gallery: this.renderGallery, debrief: this.renderDebrief, pause: this.renderPause, dead: this.renderDead } as Record<string, (w: HTMLElement) => void>)[s].call(this, wrap);
    const p = this.root.querySelector('.panel'); if (p && keepScroll) p.scrollTop = keepScroll;
  }
  private btn(label: string, onClick: () => void, cls = '', hint = '') {
    const b = h(`<button class="btn ${cls}"><span>${label}</span>${hint ? `<span class="hint">${hint}</span>` : ''}</button>`);
    b.addEventListener('click', (e) => { e.stopPropagation(); if (!b.hasAttribute('disabled')) onClick(); }); return b;
  }
  private back(to: Screen = 'van') { return this.btn(t('back'), () => this.show(to), 'small'); }
  private rankBar(xp = save.xp) {
    const p = rankProgress(xp);
    return `<div class="rankline"><b>${rankName(p.rank)}</b><div class="bar xp"><i style="width:${Math.round(p.frac * 100)}%"></i></div><span class="mono">${p.span ? `${p.into} / ${p.span} XP` : `${xp} XP`}</span></div>`;
  }

  // ---------- van ----------
  private renderVan(w: HTMLElement) {
    w.appendChild(h(`<h1 class="title"><small>▲ ${pick('NETWORK RESTORATION UNIT 4', 'UNIDAD 4 DE RESTAURACIÓN DE RED')}</small>SIGNAL</h1>`));
    w.appendChild(h(`<p class="tag">${t('tagline')}</p>`));
    w.appendChild(h(`<div class="vanstat">${this.rankBar()}<span class="mono credits">${save.credits} ¢</span></div>`));
    const m = h('<div class="menu"></div>'); w.appendChild(m);
    const cp = save.checkpoint; const cpTower = cp ? TOWERS.find((tw) => tw.id === cp.towerId) : undefined;
    if (cp && cpTower) m.appendChild(this.btn(t('resumeClimb'), () => this.cb.onResumeClimb(), 'primary', `${cpTower.name} · ${t('platformAt')} ${platformHeights(cpTower)[cp.platform] ?? 0} m`));
    const next = TOWERS.find((tw) => save.unlocked.includes(tw.id) && !save.completed[tw.id]);
    const open = dailyContracts().filter((c) => !contractDone(c)).length;
    if (next) m.appendChild(this.btn(t('continue'), () => { this.sel = next.id; this.job = { towerId: next.id, contract: null }; this.show('loadout'); }, cp && cpTower ? '' : 'primary', `${next.name} · ${next.height} m`));
    m.appendChild(this.btn(pick('Network & contracts', 'Red y contratos'), () => this.show('map'), !next && !(cp && cpTower) ? 'primary' : '', open ? pick(`${open} today`, `${open} hoy`) : ''));
    m.appendChild(this.btn(pick('Career', 'Carrera'), () => this.show('career')));
    m.appendChild(this.btn(pick('Logbook', 'Bitácora'), () => this.show('logbook'), '', `${save.pages.length + save.fragments.length}`));
    m.appendChild(this.btn(t('gallery'), () => this.show('gallery'), '', `${save.photoGoals.length}/${PHOTO_GOALS.length}`));
    m.appendChild(this.btn(t('settings'), () => this.show('settings')));
  }

  // ---------- network map ----------
  private renderMap(w: HTMLElement) {
    if (!TOWERS.some((tw) => tw.id === this.sel)) this.sel = TOWERS[0].id;
    const done = TOWERS.filter((tw) => save.completed[tw.id]).length;
    const p = h(`<div class="panel wide"><h2>${pick('Network', 'Red')}<span>${Math.round((done / TOWERS.length) * 100)}% ${pick('restored', 'restaurada')}</span></h2><div class="mapgrid"><div class="mapwrap"></div><div class="side"></div></div></div>`);
    w.appendChild(p);
    p.querySelector('.mapwrap')!.appendChild(this.mapSvg());
    p.querySelectorAll<SVGGElement>('[data-tower]').forEach((g) => g.addEventListener('click', () => { this.sel = g.dataset.tower!; this.render(); }));
    this.renderTowerSide(p.querySelector('.side')!);
    p.appendChild(this.back());
  }
  private mapSvg() {
    const lit = (id: string) => !!save.completed[id]; const dailies = dailyContracts();
    let s = `<svg viewBox="0 0 600 380" class="map" role="img" aria-label="${pick('Network map', 'Mapa de la red')}">`;
    s += `<defs><radialGradient id="glow"><stop offset="0" stop-color="#7fe3ff" stop-opacity=".55"/><stop offset="1" stop-color="#7fe3ff" stop-opacity="0"/></radialGradient></defs>`;
    s += `<rect width="600" height="380" rx="14" fill="#0a111c"/>`;
    // contour lines and a river: flavour only
    for (let i = 0; i < 7; i++) s += `<path d="M-20 ${70 + i * 42} C 120 ${30 + i * 44}, 260 ${120 + i * 38}, 380 ${60 + i * 46} S 560 ${90 + i * 40}, 640 ${50 + i * 44}" fill="none" stroke="#1b2a3d" stroke-width="1"/>`;
    s += `<path d="M40 380 C 90 330, 150 340, 210 300 S 330 290, 420 250 S 540 240, 620 200" fill="none" stroke="#17324a" stroke-width="7" stroke-linecap="round"/>`;
    // settlements light up with their tower
    const town = (x: number, y: number, n: number, on: boolean, label: string) => {
      let o = ''; for (let i = 0; i < n; i++) { const a = i * 2.4, r = 6 + (i % 4) * 5; o += `<rect x="${(x + Math.cos(a) * r).toFixed(1)}" y="${(y + Math.sin(a) * r * 0.6).toFixed(1)}" width="4" height="4" fill="${on ? '#ffc86a' : '#263447'}"/>`; }
      return `${on ? `<circle cx="${x}" cy="${y}" r="34" fill="#ffc86a" opacity=".08"/>` : ''}${o}<text x="${x}" y="${y + 30}" class="mlabel dim">${label}</text>`;
    };
    s += town(110, 322, 14, lit('pinegrove'), pick('Valley town', 'Pueblo del valle'));
    s += town(420, 262, 9, lit('blackridge'), pick('Rail yard', 'Apartadero'));
    // links between consecutive towers
    for (let i = 0; i < TOWERS.length - 1; i++) {
      const a = TOWERS[i], b = TOWERS[i + 1]; const on = lit(a.id) && lit(b.id); const known = save.unlocked.includes(b.id);
      s += `<line x1="${a.map.x}" y1="${a.map.y}" x2="${b.map.x}" y2="${b.map.y}" stroke="${on ? '#7fe3ff' : '#2a3b52'}" stroke-width="${on ? 2.5 : 1.5}" ${on ? '' : 'stroke-dasharray="5 6"'} opacity="${known ? 1 : 0.4}"/>`;
    }
    for (const tw of TOWERS) {
      const unlocked = save.unlocked.includes(tw.id), on = lit(tw.id), sel = this.sel === tw.id; const { x, y } = tw.map; const hgt = 16 + tw.height / 9;
      const col = on ? '#7fe3ff' : unlocked ? '#ff7a2a' : '#42546b'; const n = dailies.filter((c) => c.towerId === tw.id && !contractDone(c)).length;
      s += `<g data-tower="${tw.id}" class="mnode">`;
      if (on) s += `<circle cx="${x}" cy="${y - hgt}" r="30" fill="url(#glow)"/>`;
      if (sel) s += `<circle cx="${x}" cy="${y - hgt / 2}" r="${hgt / 2 + 16}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-dasharray="3 5"/>`;
      s += `<path d="M${x - 7} ${y} L${x - 1.5} ${y - hgt} L${x + 1.5} ${y - hgt} L${x + 7} ${y} M${x - 5.5} ${y - hgt * 0.28} L${x + 5.5} ${y - hgt * 0.28} M${x - 4} ${y - hgt * 0.55} L${x + 4} ${y - hgt * 0.55} M${x - 2.6} ${y - hgt * 0.8} L${x + 2.6} ${y - hgt * 0.8}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linejoin="round"/>`;
      s += `<circle cx="${x}" cy="${y - hgt - 3}" r="2.6" fill="${on ? '#ff5040' : col}"/>`;
      s += `<rect x="${x - 26}" y="${y - hgt - 12}" width="52" height="${hgt + 30}" fill="transparent"/>`;
      s += `<text x="${x}" y="${y + 16}" class="mlabel" fill="${unlocked ? '#e8edf3' : '#5d7088'}">${unlocked ? esc(tw.name) : '? ? ?'}</text>`;
      if (unlocked) s += `<text x="${x}" y="${y + 29}" class="mlabel dim">${tw.height} m</text>`;
      if (n) s += `<circle cx="${x + 15}" cy="${y - hgt - 2}" r="7" fill="#ff7a2a"/><text x="${x + 15}" y="${y - hgt + 1.5}" class="mbadge">${n}</text>`;
      s += `</g>`;
    }
    return h(s + '</svg>');
  }
  private medalPills(tw: TowerSpec) { return `<div class="pills">${MEDALS.map((m) => `<span class="pill ${hasMedal(tw.id, m.id) ? 'on' : ''}" title="${pick(m.hintEn, m.hintEs)}">${pick(m.en, m.es)}</span>`).join('')}</div>`; }
  private renderTowerSide(side: Element) {
    const tw = towerById(this.sel); const unlocked = save.unlocked.includes(tw.id); const done = save.completed[tw.id];
    if (!unlocked) {
      const need = tw.id === 'relay71' ? pick('Something north of Black Ridge is transmitting. Capture all four signal fragments to find it.', 'Algo al norte de Black Ridge está transmitiendo. Captura los cuatro fragmentos de señal para encontrarlo.')
        : pick('Restore the previous tower to reach this one.', 'Restaura la torre anterior para llegar a esta.');
      side.appendChild(h(`<div><h3>? ? ?</h3><p class="sub">${need}</p><div class="mono dim">${pick('Signal fragments', 'Fragmentos de señal')}: ${save.fragments.length} / 4</div></div>`)); return;
    }
    const f = foundOn(tw.id);
    side.appendChild(h(`<div><h3>${esc(tw.name)} <span class="mono">${tw.height} m</span></h3><p class="sub">${pick(tw.en, tw.es)}</p>${this.medalPills(tw)}
      <div class="facts mono"><span>${pick('Par', 'Par')} ${fmtTime(tw.par)}</span>${done ? `<span>${t('best')} ${fmtTime(done.best)}</span>` : ''}<span>${pick('Pages', 'Páginas')} ${f.pages}/${f.pagesTotal}</span><span>${pick('Fragments', 'Fragmentos')} ${f.fragments}/${f.fragmentsTotal}</span></div></div>`));
    const jobs = h('<div class="jobs"></div>'); side.appendChild(jobs);
    const card = (job: Job, title: string, desc: string, pay: string, state: 'open' | 'done') => {
      const c = h(`<div class="job ${state}"><div><b>${title}</b><span class="pay mono">${pay}</span></div><p>${desc}</p></div>`);
      if (state === 'open') c.appendChild(this.btn(pick('Prepare gear', 'Preparar equipo'), () => { this.job = job; this.show('loadout'); }, 'small primary'));
      else c.appendChild(h(`<span class="ok">✓ ${pick('Done today', 'Hecho hoy')}</span>`));
      jobs.appendChild(c);
    };
    if (!done) card({ towerId: tw.id, contract: null }, jobName({ towerId: tw.id, contract: null }), `${t('forecast')}: ${forecast(tw, null)}${tw.sabotaged ? ` · ⚠ ${pick('damage reported', 'daños reportados')}` : ''}`, `${tw.reward} ¢ · ${B.xp.restore} XP`, 'open');
    else {
      const list = contractsFor(tw.id);
      for (const c of list) {
        const k = KINDS[c.kind]; const extra = c.timeLimit ? ` ${pick('Limit', 'Límite')} ${fmtTime(c.timeLimit)}.` : '';
        card({ towerId: tw.id, contract: c }, `${pick(k.en, k.es)}${c.daily ? ` <i class="tagd">${pick('today', 'hoy')}</i>` : ''}`, `${pick(k.descEn, k.descEs)}${extra}`, `${c.reward} ¢ · ${c.xp} XP`, contractDone(c) ? 'done' : 'open');
      }
      const lockedKinds = (Object.keys(KINDS) as (keyof typeof KINDS)[]).filter((k) => KINDS[k].rank > rankOf());
      if (lockedKinds.length) jobs.appendChild(h(`<p class="dim small">${pick('Higher ranks unlock', 'Con más rango se desbloquean')}: ${lockedKinds.map((k) => pick(KINDS[k].en, KINDS[k].es)).join(', ')}.</p>`));
    }
  }

  // ---------- loadout ----------
  private renderLoadout(w: HTMLElement) {
    const job = this.job; const tw = towerById(job.towerId); const c = job.contract; const requires = c ? (c.kind === 'night' ? ['tools', 'headlamp'] : c.kind === 'inspect' ? [] : ['tools']) : tw.requires;
    const weight = packWeight(save.loadout); const cap = packCapacity(); const heavy = weight > cap + 1e-6; const rank = rankOf();
    const p = h(`<div class="panel"><h2>${t('loadout')}<span>${esc(tw.name)} · ${jobName(job)} · ${t('forecast')}: ${forecast(tw, c)}</span></h2>
      <div class="weight"><div class="row"><span>${t('pack')} — ${pick('heavier means faster fatigue', 'más peso, más fatiga')}</span><span class="mono ${heavy ? 'warn' : ''}">${weight.toFixed(1)} / ${cap} kg</span></div><div class="bar ${heavy ? 'heavy' : ''}"><i style="width:${Math.min(100, (weight / cap) * 100)}%"></i></div></div>
      <div class="grid"></div><div class="row between foot"><span class="mono">${save.credits} ¢</span><div class="row acts"></div></div></div>`);
    w.appendChild(p); const g = p.querySelector('.grid')!;
    // the pack itself
    const packCost = upgradeCost('pack'); const pl = gearLevel('pack');
    const pk = h(`<div class="card fixed"><div class="name"><span>${pick('Backpack', 'Mochila')} <i class="lv">${roman[pl - 1]}</i></span><span class="kg">${PACK_LV[pl - 1]} kg</span></div><div class="desc">${pick('How much you can carry up the tower.', 'Cuánto puedes subir a la torre.')}</div></div>`);
    if (packCost !== null) pk.appendChild(this.upgradeBtn('pack', packCost, `${PACK_LV[pl]} kg`));
    g.appendChild(pk);
    for (const gear of GEAR) {
      const owned = save.owned.includes(gear.id), on = save.loadout.includes(gear.id), req = requires.includes(gear.id); const locked = !owned && (gear.rank ?? 0) > rank;
      const lv = gearLevel(gear.id); const lvText = gear.lv && !gear.kgLv ? pick(gear.lv[lv - 1].en, gear.lv[lv - 1].es) : ''; // weight upgrades already show in the kg figure
      const state = gear.fixed ? t('equipped') : locked ? `🔒 ${pick(RANKS[gear.rank!].en, RANKS[gear.rank!].es)}` : owned ? (on ? t('equipped') : t('owned')) : `${t('buy')} · ${gear.price} ¢`;
      const card = h(`<div class="card ${on ? 'on' : ''} ${locked ? 'locked' : ''} ${gear.fixed ? 'fixed' : ''}" data-gear="${gear.id}">${req ? `<div class="req">${t('required')}</div>` : ''}
        <div class="name"><span>${pick(gear.en, gear.es)}${gear.lv && owned ? ` <i class="lv">${roman[lv - 1]}</i>` : ''}</span><span class="kg">${gearKg(gear.id)} kg</span></div>
        <div class="desc">${pick(gear.descEn, gear.descEs)}${lvText && owned ? ` <b>${lvText}.</b>` : ''}</div><div class="state">${state}</div></div>`);
      card.addEventListener('click', () => this.toggleGear(gear, owned, on, locked));
      const cost = owned ? upgradeCost(gear.id) : null;
      if (cost !== null && gear.lv) card.appendChild(this.upgradeBtn(gear.id, cost, pick(gear.lv[lv].en, gear.lv[lv].es)));
      g.appendChild(card);
    }
    const acts = p.querySelector('.acts')!; acts.appendChild(this.back(Object.keys(save.completed).length ? 'map' : 'van'));
    const missing = requires.filter((r) => !save.loadout.includes(r)); const light = c?.minKg !== undefined && weight < c.minKg;
    const blocked = heavy || missing.length > 0 || light;
    const label = heavy ? t('tooHeavy') : missing.length ? t('missingGear') : light ? pick(`Carry at least ${c!.minKg} kg`, `Lleva al menos ${c!.minKg} kg`) : t('start');
    const start = this.btn(label, () => this.cb.onStart(job), 'primary start'); if (blocked) start.setAttribute('disabled', ''); acts.appendChild(start);
    if (missing.length && !heavy) p.querySelector('.foot')!.after(h(`<p class="warn small">⚠ ${pick('Missing', 'Falta')}: ${missing.map((m) => pick(gearById(m).en, gearById(m).es)).join(', ')}</p>`));
  }
  private toggleGear(gear: Gear, owned: boolean, on: boolean, locked: boolean) {
    if (gear.fixed || locked) return;
    if (!owned) { if (save.credits < gear.price) return; save.credits -= gear.price; save.owned.push(gear.id); save.loadout.push(gear.id); }
    else if (on) save.loadout = save.loadout.filter((x) => x !== gear.id); else save.loadout.push(gear.id);
    persist(); this.render();
  }
  private upgradeBtn(id: string, cost: number, next: string) {
    const b = this.btn(`▲ ${pick('Upgrade', 'Mejorar')} · ${cost} ¢`, () => { if (save.credits < cost) return; save.credits -= cost; save.gearLv[id] = gearLevel(id) + 1; persist(); this.render(); }, 'small up', next);
    if (save.credits < cost) b.setAttribute('disabled', ''); return b;
  }

  // ---------- career ----------
  private renderCareer(w: HTMLElement) {
    const st = save.stats; const r = rankOf(); const next = RANKS[r + 1];
    const p = h(`<div class="panel"><h2>${pick('Career', 'Carrera')}<span>${pick('Unit 4', 'Unidad 4')}</span></h2>
      ${this.rankBar()}<p class="sub">${next ? `${pick('Next rank', 'Siguiente rango')}: ${pick(next.en, next.es)} — ${B.rankXp[r + 1]} XP` : pick('Top rank reached.', 'Rango máximo alcanzado.')}</p>
      <div class="stats mono"></div><h3>${pick('Milestones', 'Hitos')}</h3><div class="miles"></div></div>`);
    w.appendChild(p);
    const cell = (label: string, v: string) => `<div><b>${v}</b><span>${label}</span></div>`;
    p.querySelector('.stats')!.innerHTML = cell(pick('metres climbed', 'metros escalados'), st.meters.toLocaleString()) + cell(pick('climbs', 'subidas'), `${st.climbs}`) + cell(pick('towers restored', 'torres restauradas'), `${Object.keys(save.completed).length}/${TOWERS.length}`)
      + cell(pick('contracts', 'contratos'), `${st.contracts}`) + cell(pick('anchors clipped', 'anclajes'), `${st.clips}`) + cell(pick('falls', 'caídas'), `${st.falls}`) + cell(pick('time on steel', 'tiempo en el acero'), fmtTime(st.seconds)) + cell(pick('photos', 'fotos'), `${st.photos}`);
    const ml = p.querySelector('.miles')!;
    for (const m of milestones()) ml.appendChild(h(`<div class="mile ${m.done ? 'on' : ''}"><span>${m.done ? '✓' : '○'} ${pick(m.en, m.es)}</span><span class="mono">${m.progress}</span></div>`));
    p.appendChild(this.back());
  }

  // ---------- logbook ----------
  private renderLogbook(w: HTMLElement) {
    const p = h(`<div class="panel"><h2>${pick('Logbook', 'Bitácora')}<span>${pick('What Unit 2 left behind', 'Lo que dejó la Unidad 2')}</span></h2></div>`); w.appendChild(p);
    const frags = TOWERS.flatMap((tw) => tw.collectibles.filter((c) => c.kind === 'fragment')); const got = frags.filter((f) => save.fragments.includes(f.id)).length;
    p.appendChild(h(`<h3>${pick('Intercepted signal', 'Señal interceptada')} <span class="mono dim">${got} / ${frags.length}</span></h3>`));
    p.appendChild(h(`<div class="signal mono">${frags.map((f) => (save.fragments.includes(f.id) ? `<span>${pick(f.en!, f.es!)}</span>` : `<span class="dim">▒▒▒▒ ▒▒▒ ▒▒▒▒▒▒ ▒▒▒▒</span>`)).join(' ')}</div>`));
    if (got < frags.length) p.appendChild(h(`<p class="sub">${pick('Carry the signal analyzer. Fragments hide near the dishes on some platforms.', 'Lleva el analizador de señal. Los fragmentos se esconden junto a las antenas de algunas plataformas.')}</p>`));
    else p.appendChild(h(`<p class="ok">▲ ${pick('Decoded. The source is a mast called Relay 71.', 'Descifrado. El origen es un mástil llamado Relé 71.')}</p>`));
    for (const tw of TOWERS) {
      const pages = tw.collectibles.filter((c) => c.kind === 'page'); if (!pages.length) continue;
      const known = save.unlocked.includes(tw.id); const heights = platformHeights(tw);
      p.appendChild(h(`<h3>${known ? esc(tw.name) : '? ? ?'}</h3>`));
      for (const pg of pages) {
        if (save.pages.includes(pg.id)) p.appendChild(h(`<div class="page"><b>${pick(pg.titleEn!, pg.titleEs!)}</b><p>${pick(pg.en!, pg.es!)}</p></div>`));
        else p.appendChild(h(`<div class="page missing"><b>${pick('Page not found', 'Página sin encontrar')}</b><p>${known ? pick(`Somewhere on the platform at ${heights[pg.platform]} m.`, `En algún punto de la plataforma a ${heights[pg.platform]} m.`) : '…'}</p></div>`));
      }
    }
    p.appendChild(this.back());
  }

  // ---------- gallery ----------
  private renderGallery(w: HTMLElement) {
    const p = h(`<div class="panel"><h2>${t('gallery')}<span>${pick('Assignments', 'Encargos')} ${save.photoGoals.length}/${PHOTO_GOALS.length} · ${B.photoReward} ¢ ${pick('each', 'cada uno')}</span></h2><div class="goals"></div></div>`); w.appendChild(p);
    const gl = p.querySelector('.goals')!;
    for (const g of PHOTO_GOALS) { const on = save.photoGoals.includes(g.id); gl.appendChild(h(`<div class="goal ${on ? 'on' : ''}"><b>${on ? '✓' : '○'} ${pick(g.en, g.es)}</b><span>${pick(g.hintEn, g.hintEs)}</span></div>`)); }
    if (!save.photos.length) p.appendChild(h(`<p class="sub">${t('noPhotos')}</p>`));
    else { const g = h('<div class="photos"></div>'); for (const ph of [...save.photos].reverse()) g.appendChild(h(`<figure><img src="${ph.src}" alt="">${ph.tag ? `<figcaption>✓ ${esc(ph.tag)}</figcaption>` : ''}</figure>`)); p.appendChild(g); }
    p.appendChild(h('<div style="height:12px"></div>')); p.appendChild(this.back());
  }

  // ---------- settings ----------
  private renderSettings(w: HTMLElement) {
    const p = h(`<div class="panel" style="width:min(560px,100%)"><h2>${t('settings')}</h2><div class="menu"></div></div>`); w.appendChild(p); const m = p.querySelector('.menu')!;
    const tog = (label: string, val: string, fn: () => void) => m.appendChild(this.btn(label, () => { fn(); persist(); this.cb.onSetting(); this.render(); }, 'toggle', `<b>${val}</b>`));
    const onoff = (v: boolean) => (v ? t('on') : t('off'));
    tog(t('language'), getLang() === 'es' ? 'Español' : 'English', () => { save.lang = save.lang === 'es' ? 'en' : 'es'; });
    const qs = ['auto', 'low', 'medium', 'high'] as const; const qn = { auto: 'qAuto', low: 'qLow', medium: 'qMedium', high: 'qHigh' };
    tog(t('quality'), t(qn[save.quality]), () => { save.quality = qs[(qs.indexOf(save.quality) + 1) % qs.length]; });
    tog(t('gripMode'), save.tapGrip ? t('gripTap') : t('gripHold'), () => { save.tapGrip = !save.tapGrip; });
    tog(pick('Look sensitivity', 'Sensibilidad'), `${save.sens.toFixed(1)}×`, () => { save.sens = save.sens >= 2 ? 0.5 : +(save.sens + 0.25).toFixed(2); });
    tog(t('invertY'), onoff(save.invertY), () => { save.invertY = !save.invertY; });
    tog(t('fov'), `${save.fov}°`, () => { save.fov = save.fov >= 100 ? 60 : save.fov + 5; });
    tog(t('reduceMotion'), onoff(save.reduceMotion), () => { save.reduceMotion = !save.reduceMotion; });
    tog(t('leftHanded'), onoff(save.leftHanded), () => { save.leftHanded = !save.leftHanded; });
    tog(t('sound'), onoff(save.sound), () => { save.sound = !save.sound; });
    m.appendChild(this.btn(t('resetSave'), () => { if (confirm(t('resetConfirm'))) { this.cb.onReset(); this.show('van'); } }, '', '⚠'));
    m.appendChild(h(`<div class="controls">${t('controls')}</div>`));
    m.appendChild(this.back());
  }

  // ---------- debrief ----------
  private renderDebrief(w: HTMLElement) {
    const d = this.debrief!; const tw = towerById(d.job.towerId); const xp = d.xpAfter - d.xpBefore; const credits = d.lines.reduce((s, l) => s + l.credits, 0);
    const ranked = rankOf(d.xpAfter) > rankOf(d.xpBefore);
    const p = h(`<div class="panel debrief" style="width:min(640px,100%)"><h2>${t('jobDone')}<span>${esc(tw.name)} · ${jobName(d.job)}</span></h2>
      <div class="facts mono big"><span>${t('time')} <b>${fmtTime(d.time)}</b>${d.late ? ` <i class="warn">${pick('late', 'tarde')}</i>` : ''}</span><span>${t('maxAlt')} <b>${d.maxAlt.toFixed(0)} m</b></span><span>${t('falls')} <b>${d.falls}</b></span></div>
      <div class="ledger"></div>
      <div class="total mono"><span>${pick('Total', 'Total')}</span><b class="xpv">+${xp} XP</b><b class="crv">+${credits} ¢</b></div>
      ${this.rankBar(d.xpAfter)}
      <div class="unlocks"></div></div>`);
    w.appendChild(p);
    const lg = p.querySelector('.ledger')!;
    d.lines.forEach((l, i) => lg.appendChild(h(`<div class="line" style="animation-delay:${0.15 + i * 0.12}s"><span>${pick(l.en, l.es)}</span><b class="xpv mono">${l.xp ? `+${l.xp} XP` : ''}</b><b class="crv mono">${l.credits ? `+${l.credits} ¢` : ''}</b></div>`)));
    const un = p.querySelector('.unlocks')!;
    if (ranked) un.appendChild(h(`<p class="ok big">▲ ${pick('Promoted', 'Ascenso')}: ${rankName(rankOf(d.xpAfter))}</p>`));
    for (const m of d.medals) { const md = MEDALS.find((x) => x.id === m)!; un.appendChild(h(`<p class="medal">◆ ${pick('Medal', 'Medalla')}: ${pick(md.en, md.es)}</p>`)); }
    for (const u of d.unlocks) un.appendChild(h(`<p class="ok">▲ ${u}</p>`));
    p.appendChild(this.btn(t('toVan'), () => this.cb.onToVan(), 'primary'));
  }
  private renderPause(w: HTMLElement) {
    const p = h(`<div class="panel" style="width:min(420px,100%)"><h2>${t('paused')}</h2><div class="menu"></div><div class="controls">${t('controls')}</div></div>`); w.appendChild(p); const m = p.querySelector('.menu')!;
    m.appendChild(this.btn(t('resume'), () => this.cb.onResume(), 'primary')); m.appendChild(this.btn(t('quit'), () => this.cb.onAbandon(), '', save.checkpoint ? pick('progress on this job is lost', 'se pierde el avance de este trabajo') : ''));
  }
  private renderDead(w: HTMLElement) {
    const d = h(`<div class="dead"><div><h1>${t('fell')}</h1></div></div>`); w.replaceWith(d); this.root.appendChild(d);
    d.firstElementChild!.appendChild(this.btn(t('retry'), () => this.cb.onRespawn(), 'primary'));
  }
}
