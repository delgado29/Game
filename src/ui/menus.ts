import { GEAR, PACK_CAPACITY, gearById, packWeight } from '../game/gear';
import { TOWERS, towerById } from '../game/towers';
import { getLang, pick, t } from '../core/i18n';
import { persist, save } from '../core/save';
import { fmtTime } from '../core/math';

export type Screen = 'van' | 'towers' | 'loadout' | 'settings' | 'gallery' | 'debrief' | 'pause' | 'dead' | 'lock' | 'none';
export interface DebriefData { towerId: string; success: boolean; time: number; falls: number; maxAlt: number; earned: number; photos: number; unlocked: string | null; }
export interface MenuCallbacks { onStart: (towerId: string) => void; onSetting: () => void; onReset: () => void; onResume: () => void; onAbandon: () => void; onRespawn: () => void; onToVan: () => void; onLock: () => void; onScreen: (s: Screen) => void; }

const h = (html: string) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild as HTMLElement; };

export class Menus {
  root: HTMLElement; screen: Screen = 'none'; selectedTower = 'pinegrove'; private debrief: DebriefData | null = null;
  constructor(parent: HTMLElement, private cb: MenuCallbacks) { this.root = document.createElement('div'); this.root.style.cssText = 'position:absolute;inset:0;pointer-events:none;'; parent.appendChild(this.root); }
  show(screen: Screen, data?: DebriefData) { this.screen = screen; if (data) this.debrief = data; this.render(); this.cb.onScreen(screen); }
  private render() {
    this.root.innerHTML = ''; const s = this.screen; if (s === 'none') return;
    const wrap = h(`<div class="screen ${s === 'van' ? 'left' : ''}"></div>`); this.root.appendChild(wrap);
    if (s === 'van') this.renderVan(wrap); else if (s === 'towers') this.renderTowers(wrap); else if (s === 'loadout') this.renderLoadout(wrap); else if (s === 'settings') this.renderSettings(wrap); else if (s === 'gallery') this.renderGallery(wrap); else if (s === 'debrief') this.renderDebrief(wrap); else if (s === 'pause') this.renderPause(wrap); else if (s === 'dead') this.renderDead(wrap); else if (s === 'lock') this.renderLock(wrap);
  }
  private btn(label: string, onClick: () => void, cls = '', hint = '') { const b = h(`<button class="btn ${cls}"><span>${label}</span>${hint ? `<span class="hint">${hint}</span>` : ''}</button>`); b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); }); return b; }
  private renderVan(w: HTMLElement) {
    w.appendChild(h(`<h1 class="title"><small>▲ ${pick('NETWORK RESTORATION UNIT 4', 'UNIDAD 4 DE RESTAURACIÓN DE RED')}</small>SIGNAL</h1>`));
    w.appendChild(h(`<p class="tag">${t('tagline')}</p>`));
    const m = h('<div class="menu"></div>'); w.appendChild(m);
    const next = TOWERS.find((tw) => save.unlocked.includes(tw.id) && !save.completed[tw.id]) ?? TOWERS[TOWERS.length - 1];
    m.appendChild(this.btn(t('continue'), () => { this.selectedTower = next.id; this.show('loadout'); }, 'primary', `${next.name} · ${next.height} m`));
    m.appendChild(this.btn(t('towers'), () => this.show('towers')));
    m.appendChild(this.btn(t('gallery'), () => this.show('gallery'), '', `${save.photos.length}`));
    m.appendChild(this.btn(t('settings'), () => this.show('settings')));
    m.appendChild(h(`<div class="controls mono">${t('credits')}: ${save.credits} ¢</div>`));
  }
  private renderTowers(w: HTMLElement) {
    const p = h(`<div class="panel"><h2>${t('towers')}</h2><p class="sub">${pick('Every tower you restore lights up the valley below.', 'Cada torre que restauras ilumina el valle.')}</p><div class="grid" style="grid-template-columns:1fr"></div></div>`); w.appendChild(p); const g = p.querySelector('.grid')!;
    for (const tw of TOWERS) {
      const unlocked = save.unlocked.includes(tw.id); const done = save.completed[tw.id];
      const c = h(`<div class="card tower ${unlocked ? '' : 'locked'}"><div><div class="name">${tw.name} ${done ? `<span class="ok">✓ ${t('restored')}</span>` : unlocked ? '' : `<span>🔒 ${t('locked')}</span>`}</div><div class="desc">${pick(tw.en, tw.es)}</div>${done ? `<div class="state">${t('best')}: ${fmtTime(done.best)} · ${t('falls')}: ${done.falls}</div>` : ''}${tw.sabotaged ? `<div class="warn">⚠ ${pick('Last crew reported damage', 'La última cuadrilla reportó daños')}</div>` : ''}</div><div class="h">${tw.height}<small>m</small></div></div>`);
      if (unlocked) c.addEventListener('click', () => { this.selectedTower = tw.id; this.show('loadout'); }); g.appendChild(c);
    }
    p.appendChild(this.btn(t('back'), () => this.show('van'), 'small'));
  }
  private renderLoadout(w: HTMLElement) {
    const tw = towerById(this.selectedTower); const weight = packWeight(save.loadout); const heavy = weight > PACK_CAPACITY;
    const wx = tw.weather[tw.weather.length - 1].target; const forecast = wx.storm > 0.6 ? pick('storm front late', 'frente de tormenta tarde') : wx.rain > 0.3 ? pick('rain later', 'lluvia más tarde') : pick('clear, light wind', 'despejado, viento flojo');
    const p = h(`<div class="panel"><h2>${t('loadout')}<span>${tw.name} · ${tw.height} m · ${t('forecast')}: ${forecast}</span></h2><p class="sub">${pick(tw.en, tw.es)}</p>
      <div class="weight"><div class="row"><span>${t('pack')} — ${pick('heavier means faster fatigue', 'más peso, más fatiga')}</span><span class="mono ${heavy ? 'warn' : ''}">${weight.toFixed(1)} / ${PACK_CAPACITY} kg</span></div><div class="bar ${heavy ? 'heavy' : ''}"><i style="width:${Math.min(100, (weight / PACK_CAPACITY) * 100)}%"></i></div></div>
      <div class="grid"></div><div class="row between" style="margin-top:16px"><span class="mono">${t('credits')}: ${save.credits} ¢</span><span class="foot"></span></div></div>`);
    w.appendChild(p); const g = p.querySelector('.grid')!;
    for (const gear of GEAR) {
      const owned = save.owned.includes(gear.id), on = save.loadout.includes(gear.id), req = tw.requires.includes(gear.id);
      const c = h(`<div class="card ${on ? 'on' : ''}">${req ? `<div class="req">${t('required')}</div>` : ''}<div class="name"><span>${pick(gear.en, gear.es)}</span><span class="kg">${gear.kg} kg</span></div><div class="desc">${pick(gear.descEn, gear.descEs)}</div><div class="state">${gear.fixed ? t('equipped') : owned ? (on ? t('equipped') : t('owned')) : `${t('buy')} · ${gear.price} ¢`}</div></div>`);
      c.addEventListener('click', () => {
        if (gear.fixed) return;
        if (!owned) { if (save.credits >= gear.price) { save.credits -= gear.price; save.owned.push(gear.id); save.loadout.push(gear.id); persist(); this.render(); } return; }
        if (on) save.loadout = save.loadout.filter((x) => x !== gear.id); else save.loadout.push(gear.id); persist(); this.render();
      });
      g.appendChild(c);
    }
    const foot = p.querySelector('.foot')!; const row = h('<div class="row"></div>'); foot.replaceWith(row);
    row.appendChild(this.btn(t('back'), () => this.show('van'), 'small'));
    const missing = tw.requires.filter((r) => !save.loadout.includes(r));
    const start = this.btn(heavy ? t('tooHeavy') : t('start'), () => { if (!heavy) this.cb.onStart(tw.id); }, 'primary'); if (heavy) start.setAttribute('disabled', ''); row.appendChild(start);
    if (missing.length && !heavy) row.appendChild(h(`<span class="warn">⚠ ${pick('Missing', 'Falta')}: ${missing.map((m) => pick(gearById(m).en, gearById(m).es)).join(', ')}</span>`));
  }
  private renderSettings(w: HTMLElement) {
    const p = h(`<div class="panel" style="width:min(520px,100%)"><h2>${t('settings')}</h2><div class="menu"></div></div>`); w.appendChild(p); const m = p.querySelector('.menu')!;
    const tog = (label: string, val: string, fn: () => void) => m.appendChild(this.btn(`${label}`, () => { fn(); persist(); this.cb.onSetting(); this.render(); }, 'toggle', `<b>${val}</b>`));
    tog(t('language'), getLang() === 'es' ? 'Español' : 'English', () => { save.lang = save.lang === 'es' ? 'en' : 'es'; });
    tog(t('invertY'), save.invertY ? t('on') : t('off'), () => { save.invertY = !save.invertY; });
    tog(t('sound'), save.sound ? t('on') : t('off'), () => { save.sound = !save.sound; });
    tog(pick('Look sensitivity', 'Sensibilidad'), `${save.sens.toFixed(1)}×`, () => { save.sens = save.sens >= 2 ? 0.5 : +(save.sens + 0.25).toFixed(2); });
    tog(t('fov'), `${save.fov}°`, () => { save.fov = save.fov >= 100 ? 60 : save.fov + 5; });
    tog(t('reduceMotion'), save.reduceMotion ? t('on') : t('off'), () => { save.reduceMotion = !save.reduceMotion; });
    tog(t('leftHanded'), save.leftHanded ? t('on') : t('off'), () => { save.leftHanded = !save.leftHanded; });
    m.appendChild(this.btn(t('resetSave'), () => { if (confirm(t('resetConfirm'))) { this.cb.onReset(); this.show('van'); } }, '', '⚠'));
    m.appendChild(h(`<div class="controls">${t('controls')}</div>`));
    m.appendChild(this.btn(t('back'), () => this.show('van'), 'small'));
  }
  private renderGallery(w: HTMLElement) {
    const p = h(`<div class="panel"><h2>${t('gallery')}<span>${save.photos.length}</span></h2></div>`); w.appendChild(p);
    if (!save.photos.length) p.appendChild(h(`<p class="sub">${t('noPhotos')}</p>`)); else { const g = h('<div class="photos"></div>'); for (const src of [...save.photos].reverse()) g.appendChild(h(`<img src="${src}" alt="">`)); p.appendChild(g); }
    p.appendChild(h('<div style="height:12px"></div>')); p.appendChild(this.btn(t('back'), () => this.show('van'), 'small'));
  }
  private renderDebrief(w: HTMLElement) {
    const d = this.debrief!; const tw = towerById(d.towerId);
    const p = h(`<div class="panel" style="width:min(560px,100%)"><h2>${d.success ? t('jobDone') : t('jobFailed')}<span>${tw.name}</span></h2>
      <div class="stat"><span>${t('time')}</span><b class="mono">${fmtTime(d.time)}</b><span>${t('maxAlt')}</span><b class="mono">${d.maxAlt.toFixed(0)} m</b><span>${t('falls')}</span><b class="mono">${d.falls}</b><span>${t('photos')}</span><b class="mono">${d.photos}</b><span>${t('earned')}</span><b class="mono">${d.earned} ¢</b></div>
      ${d.unlocked ? `<p class="ok" style="margin:16px 0 0">▲ ${t('newTower')}: ${towerById(d.unlocked).name}</p>` : ''}<div style="height:18px"></div></div>`);
    w.appendChild(p); p.appendChild(this.btn(t('toVan'), () => this.cb.onToVan(), 'primary'));
  }
  private renderPause(w: HTMLElement) {
    const p = h(`<div class="panel" style="width:min(420px,100%)"><h2>${t('paused')}</h2><div class="menu"></div><div class="controls">${t('controls')}</div></div>`); w.appendChild(p); const m = p.querySelector('.menu')!;
    m.appendChild(this.btn(t('resume'), () => this.cb.onResume(), 'primary')); m.appendChild(this.btn(t('quit'), () => this.cb.onAbandon()));
  }
  private renderDead(w: HTMLElement) { const d = h(`<div class="dead"><div><h1>${t('fell')}</h1></div></div>`); w.replaceWith(d); this.root.appendChild(d); d.firstElementChild!.appendChild(this.btn(t('retry'), () => this.cb.onRespawn(), 'primary')); }
  private renderLock(w: HTMLElement) { const l = h(`<div class="lock"><div>${t('clickToPlay')}<small>${t('controls')}</small></div></div>`); w.replaceWith(l); this.root.appendChild(l); l.addEventListener('click', () => this.cb.onLock()); }
}
