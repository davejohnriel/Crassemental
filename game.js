/*
 * Grass Cutter — a tiny incremental lawn game.
 * Vanilla JS, no dependencies, no build step. Works straight from GitHub Pages.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------- utils */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc'];

  function fmt(n) {
    if (n === Infinity) return '∞';
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n);
    if (n === 0) return '0';
    if (n < 1) return String(Math.round(n * 1000) / 1000);
    if (n < 10) return String(Math.round(n * 10) / 10);
    if (n < 1000) return String(Math.floor(n));
    const tier = Math.floor(Math.log10(n) / 3);
    if (tier >= SUFFIXES.length) return n.toExponential(2).replace('+', '');
    const scaled = n / Math.pow(1000, tier);
    const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
    return scaled.toFixed(digits) + SUFFIXES[tier];
  }

  function fmtTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + (s % 60) + 's';
    return s + 's';
  }

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  /* ------------------------------------------------------------- data */
  const GENS = [
    { id: 'shears', name: 'Hand Shears', icon: '✂️', baseCost: 15, cps: 0.2 },
    { id: 'push', name: 'Push Mower', icon: '🌿', baseCost: 120, cps: 1.2 },
    { id: 'rideon', name: 'Ride-On Mower', icon: '🚜', baseCost: 1300, cps: 8 },
    { id: 'tractor', name: 'Lawn Tractor', icon: '🚛', baseCost: 14000, cps: 47 },
    { id: 'robot', name: 'Robot Mower', icon: '🤖', baseCost: 200000, cps: 260 },
    { id: 'goats', name: 'Goat Herd', icon: '🐐', baseCost: 3300000, cps: 1400 },
    { id: 'crew', name: 'Mowing Crew', icon: '🧑‍🌾', baseCost: 51000000, cps: 7800 },
    { id: 'shredder', name: 'Turf Shredder', icon: '🏭', baseCost: 1100000000, cps: 44000 }
  ];

  const GEN_GROWTH = 1.15;

  const MILESTONES = [
    { at: 10, costMult: 25, mult: 2, title: 'Improved' },
    { at: 25, costMult: 150, mult: 2, title: 'Professional' },
    { at: 50, costMult: 1200, mult: 3, title: 'Industrial' },
    { at: 100, costMult: 12000, mult: 3, title: 'Mythic' }
  ];

  const UPGRADES = [];

  GENS.forEach((gen, index) => {
    MILESTONES.forEach((m) => {
      UPGRADES.push({
        id: 'gen-' + index + '-' + m.at,
        name: m.title + ' ' + gen.name,
        icon: gen.icon,
        cost: Math.round(gen.baseCost * m.costMult),
        desc: (m.mult === 2 ? 'Double' : 'Triple') + ' ' + gen.name + ' output.',
        gen: index,
        mult: m.mult,
        req: (s) => (s.gens[index] || 0) >= m.at
      });
    });
  });

  [
    {
      id: 'manual',
      name: 'Mowing Manual',
      icon: '📗',
      cost: 8000,
      desc: 'All production ×1.25',
      globalMult: 1.25,
      req: (s) => s.lifetime >= 3000
    },
    {
      id: 'permit',
      name: 'Commercial Permit',
      icon: '📜',
      cost: 2500000,
      desc: 'All production ×2',
      globalMult: 2,
      req: (s) => s.lifetime >= 800000
    },
    {
      id: 'turf',
      name: 'Turf Science',
      icon: '🧪',
      cost: 400000000,
      desc: 'All production ×3',
      globalMult: 3,
      req: (s) => s.lifetime >= 150000000
    }
  ].forEach((u) => UPGRADES.push(u));

  [
    { id: 'sharp', name: 'Sharper Blades', icon: '✂️', cost: 150, desc: '+2 base cut power.', clickFlat: 2, req: (s) => s.clicks >= 10 },
    { id: 'whetstone', name: 'Whetstone', icon: '🪨', cost: 2500, desc: '+5 base cut power.', clickFlat: 5, req: (s) => s.clicks >= 40 },
    { id: 'diamond', name: 'Diamond Edge', icon: '💎', cost: 40000, desc: '+15 base cut power.', clickFlat: 15, req: (s) => s.clicks >= 100 },
    { id: 'laser', name: 'Laser Trim', icon: '🔦', cost: 900000, desc: '+60 base cut power.', clickFlat: 60, req: (s) => s.clicks >= 250 },
    { id: 'plasma', name: 'Plasma Cutter', icon: '⚡', cost: 20000000, desc: '+250 base cut power.', clickFlat: 250, req: (s) => s.clicks >= 500 },
    { id: 'muscle1', name: 'Muscle Memory', icon: '💪', cost: 5000, desc: 'Cuts also earn +1% of your grass/sec.', clickCps: 0.01, req: (s) => s.clicks >= 60 },
    { id: 'muscle2', name: 'Second Nature', icon: '🫱', cost: 120000, desc: 'Cuts also earn +3% of your grass/sec.', clickCps: 0.03, req: (s) => s.clicks >= 150 },
    { id: 'muscle3', name: 'Mower’s Trance', icon: '🌀', cost: 5000000, desc: 'Cuts also earn +8% of your grass/sec.', clickCps: 0.08, req: (s) => s.clicks >= 300 }
  ].forEach((u) => UPGRADES.push(u));

  const UPGRADE_MAP = new Map(UPGRADES.map((u) => [u.id, u]));

  const PRESTIGE_UPGRADES = [
    { id: 'soil', name: 'Rich Soil', icon: '🪴', desc: '+15% production per level.', baseCost: 1, growth: 1.6, max: 40 },
    { id: 'fingers', name: 'Sharpened Fingers', icon: '🖐️', desc: '+3 base cut power per level.', baseCost: 2, growth: 1.8, max: 25 },
    { id: 'start', name: 'Head Start', icon: '🏁', desc: 'Begin each run with 5 Hand Shears per level.', baseCost: 3, growth: 2.2, max: 10 },
    { id: 'discount', name: 'Bulk Discount', icon: '🏷️', desc: 'Cutters cost 2% less per level (50% max).', baseCost: 5, growth: 2, max: 25 },
    { id: 'offline', name: 'Lawn Care Routine', icon: '🌙', desc: '+10% offline production per level (100% max).', baseCost: 4, growth: 2, max: 5 },
    { id: 'luck', name: 'Lucky Clover', icon: '🍀', desc: 'Golden grass arrives sooner, lasts longer and boosts harder.', baseCost: 6, growth: 2.5, max: 6 }
  ];

  const ACHIEVEMENTS = [
    { id: 'first', name: 'First Cut', desc: 'Cut a single blade of grass.', icon: '🌱', check: (s) => s.clicks >= 1 },
    { id: 'clicks100', name: 'Green Thumb', desc: 'Cut grass 100 times.', icon: '👍', check: (s) => s.clicks >= 100 },
    { id: 'clicks1000', name: 'Blisteringly Fast', desc: 'Cut grass 1,000 times.', icon: '🔥', check: (s) => s.clicks >= 1000 },
    { id: 'k10', name: 'Freshly Mowed', desc: 'Earn 10K grass all time.', icon: '✂️', check: (s) => s.lifetime >= 10000 },
    { id: 'm1', name: 'One Million Blades', desc: 'Earn 1M grass all time.', icon: '🌿', check: (s) => s.lifetime >= 1000000 },
    { id: 'b1', name: 'A Billion Blades', desc: 'Earn 1B grass all time.', icon: '👑', check: (s) => s.lifetime >= 1000000000 },
    { id: 't1', name: 'Trillion Turf', desc: 'Earn 1T grass all time.', icon: '🌟', check: (s) => s.lifetime >= 1e12 },
    { id: 'fullshed', name: 'Full Shed', desc: 'Own at least one of every cutter.', icon: '🏚️', check: (s) => s.gens.every((n) => n > 0) },
    { id: 'shears100', name: 'Shear Madness', desc: 'Own 100 Hand Shears.', icon: '🔪', check: (s) => s.gens[0] >= 100 },
    { id: 'reset1', name: 'Regrowth', desc: 'Reseed the lawn once.', icon: '🧪', check: (s) => s.resets >= 1 },
    { id: 'fert100', name: 'Soil Scientist', desc: 'Earn 100 fertilizer all time.', icon: '🔬', check: (s) => s.fertEarned >= 100 },
    { id: 'golden', name: 'Golden Hour', desc: 'Catch golden grass.', icon: '🍀', check: (s) => s.goldenClicked >= 1 },
    { id: 'upg25', name: 'Tinkerer', desc: 'Buy 25 upgrades in one run.', icon: '🔧', check: (s) => Object.keys(s.upgrades).filter((k) => s.upgrades[k]).length >= 25 }
  ];

  const ACH_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

  const SAVE_KEY = 'grass-cutter-save-v1';
  const OFFLINE_CAP = 12 * 3600;

  /* ------------------------------------------------------------- state */
  function defaultState() {
    return {
      version: 1,
      grass: 0,
      runEarned: 0,
      lifetime: 0,
      clicks: 0,
      gens: GENS.map(() => 0),
      upgrades: {},
      fertilizer: 0,
      fertEarned: 0,
      pres: {},
      achievements: {},
      resets: 0,
      bestRun: 0,
      goldenClicked: 0,
      goldenSpawnAt: 0,
      boostUntil: 0,
      boostMult: 1,
      lastTick: Date.now(),
      totalPlaytime: 0,
      buyAmount: 1,
      tab: 'cutters'
    };
  }

  function mergeState(data) {
    const fresh = defaultState();
    if (!data || typeof data !== 'object') return fresh;

    Object.keys(fresh).forEach((key) => {
      const value = data[key];
      if (value === undefined || value === null) return;

      if (key === 'buyAmount') {
        fresh.buyAmount = value === 'max' || (typeof value === 'number' && value > 0) ? value : 1;
        return;
      }
      if (Array.isArray(fresh[key])) {
        if (Array.isArray(value)) {
          fresh[key] = fresh[key].map((_, i) => {
            const n = Number(value[i]);
            return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
          });
        }
        return;
      }
      if (fresh[key] && typeof fresh[key] === 'object') {
        if (typeof value === 'object' && !Array.isArray(value)) {
          fresh[key] = Object.assign({}, fresh[key], value);
        }
        return;
      }
      if (typeof value === typeof fresh[key]) {
        if (typeof value === 'number' && !Number.isFinite(value)) return;
        fresh[key] = value;
      }
    });

    if (!Array.isArray(fresh.gens) || fresh.gens.length !== GENS.length) {
      fresh.gens = GENS.map((_, i) => (fresh.gens && fresh.gens[i]) || 0);
    }
    if (!['cutters', 'upgrades', 'prestige', 'stats'].includes(fresh.tab)) fresh.tab = 'cutters';
    fresh.grass = Math.max(0, fresh.grass);
    fresh.runEarned = Math.max(0, fresh.runEarned);
    fresh.lifetime = Math.max(fresh.runEarned, fresh.lifetime);
    fresh.fertilizer = Math.max(0, Math.floor(fresh.fertilizer));
    fresh.fertEarned = Math.max(fresh.fertilizer, Math.floor(fresh.fertEarned));
    fresh.clicks = Math.max(0, Math.floor(fresh.clicks));
    fresh.resets = Math.max(0, Math.floor(fresh.resets));

    PRESTIGE_UPGRADES.forEach((p) => {
      const level = Number(fresh.pres[p.id]);
      fresh.pres[p.id] = Number.isFinite(level) ? clamp(Math.floor(level), 0, p.max) : 0;
    });

    return fresh;
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultState();
      return mergeState(JSON.parse(raw));
    } catch (err) {
      return defaultState();
    }
  }

  let state = load();

  /* ------------------------------------------------------------- economy */
  function pres(id) {
    const level = state.pres[id];
    return Number.isFinite(level) ? level : 0;
  }

  function presCost(def) {
    return Math.ceil(def.baseCost * Math.pow(def.growth, pres(def.id)));
  }

  function achievedCount() {
    let n = 0;
    ACHIEVEMENTS.forEach((a) => {
      if (state.achievements[a.id]) n += 1;
    });
    return n;
  }

  function costDiscount() {
    return Math.max(0.5, 1 - 0.02 * pres('discount'));
  }

  function genCost(i, owned) {
    return GENS[i].baseCost * Math.pow(GEN_GROWTH, owned) * costDiscount();
  }

  function genBulkCost(i, owned, count) {
    const base = genCost(i, owned);
    if (count <= 0) return 0;
    return (base * (Math.pow(GEN_GROWTH, count) - 1)) / (GEN_GROWTH - 1);
  }

  function maxAffordable(i) {
    const base = genCost(i, state.gens[i]);
    if (state.grass < base) return 0;
    const raw = Math.log((state.grass * (GEN_GROWTH - 1)) / base + 1) / Math.log(GEN_GROWTH);
    let n = Math.max(0, Math.min(100000, Math.floor(raw)));
    while (n > 0 && genBulkCost(i, state.gens[i], n) > state.grass) n -= 1;
    return n;
  }

  function prestigeGain() {
    return Math.floor(Math.sqrt(Math.max(0, state.runEarned) / 250000));
  }

  function computed() {
    const genMult = GENS.map(() => 1);
    let global = 1;
    let clickFlat = 0;
    let clickCps = 0;

    Object.keys(state.upgrades).forEach((id) => {
      if (!state.upgrades[id]) return;
      const u = UPGRADE_MAP.get(id);
      if (!u) return;
      if (u.gen !== undefined) genMult[u.gen] *= u.mult;
      if (u.globalMult) global *= u.globalMult;
      if (u.clickFlat) clickFlat += u.clickFlat;
      if (u.clickCps) clickCps += u.clickCps;
    });

    global *= 1 + 0.15 * pres('soil');
    global *= 1 + 0.02 * state.fertilizer;
    global *= 1 + 0.01 * achievedCount();

    const boosted = state.boostUntil > Date.now();
    if (boosted) global *= state.boostMult;

    clickFlat += 3 * pres('fingers');

    let cps = 0;
    for (let i = 0; i < GENS.length; i += 1) {
      if (state.gens[i] > 0) cps += state.gens[i] * GENS[i].cps * genMult[i];
    }
    cps *= global;

    const clickPower = (1 + clickFlat) * global + cps * clickCps;

    return { cps, clickPower, genMult, global, boosted, clickCps };
  }

  /* ------------------------------------------------------------- dom refs */
  const el = {
    grass: null,
    rate: null,
    click: null,
    fertPill: null,
    fertAmount: null,
    pane: null,
    tabs: null,
    upgBadge: null,
    presBadge: null,
    lawn: null,
    golden: null,
    boost: null,
    boostMult: null,
    boostTime: null,
    floaters: null,
    saveNote: null,
    toasts: null,
    modal: null,
    modalTitle: null,
    modalBody: null,
    modalOk: null,
    modalCancel: null
  };

  function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
  }

  /* ------------------------------------------------------------- rendering */
  function genCard(gen, i, c) {
    const owned = state.gens[i];
    const amount = state.buyAmount === 'max' ? Math.max(1, maxAffordable(i)) : state.buyAmount;
    const cost = Math.ceil(genBulkCost(i, owned, amount));
    const each = gen.cps * c.genMult[i] * c.global;
    const fill = clamp((state.grass / cost) * 100, 0, 100);

    return (
      '<button type="button" class="card gen' + (state.grass >= cost ? ' can-afford' : '') + '" data-buy="' + i + '">' +
        '<span class="card-ico" aria-hidden="true">' + gen.icon + '</span>' +
        '<span class="card-main">' +
          '<span class="card-title">' + gen.name + (owned ? ' <em>×' + fmt(owned) + '</em>' : '') + '</span>' +
          '<span class="card-sub">' + fmt(each) + '/sec each' +
            (owned ? ' · ' + fmt(each * owned) + '/sec total' : '') +
          '</span>' +
        '</span>' +
        '<span class="card-price"><b>' + fmt(cost) + '</b><small>' + (amount > 1 ? '×' + fmt(amount) : 'grass') + '</small></span>' +
        '<span class="card-bar"><i style="width:' + fill.toFixed(1) + '%"></i></span>' +
      '</button>'
    );
  }

  function cuttersHTML() {
    const c = computed();
    const amounts = [1, 10, 100, 'max'];

    let html = '<div class="toolbar"><span class="toolbar-label">Buy</span><div class="chips">';
    amounts.forEach((a) => {
      html += '<button type="button" class="chip' + (state.buyAmount === a ? ' is-active' : '') + '" data-amount="' + a + '">' +
        (a === 'max' ? 'Max' : '×' + a) + '</button>';
    });
    html += '</div><span class="toolbar-note">' + fmt(c.cps) + ' grass/sec</span></div>';
    html += '<div class="list">';
    GENS.forEach((gen, i) => {
      html += genCard(gen, i, c);
    });
    html += '</div>';
    return html;
  }

  function upgradeCard(u) {
    return (
      '<button type="button" class="card upg' + (state.grass >= u.cost ? ' can-afford' : '') + '" data-upgrade="' + u.id + '">' +
        '<span class="card-ico" aria-hidden="true">' + u.icon + '</span>' +
        '<span class="card-main">' +
          '<span class="card-title">' + u.name + '</span>' +
          '<span class="card-sub">' + u.desc + '</span>' +
        '</span>' +
        '<span class="card-price"><b>' + fmt(u.cost) + '</b><small>grass</small></span>' +
      '</button>'
    );
  }

  function upgradesHTML() {
    const open = UPGRADES.filter((u) => !state.upgrades[u.id] && u.req(state)).sort((a, b) => a.cost - b.cost);
    const bought = Object.keys(state.upgrades).filter((k) => state.upgrades[k]).length;
    const head = '<p class="pane-note">' + bought + ' of ' + UPGRADES.length + ' upgrades bought this run. New ones appear as you grow.</p>';

    if (!open.length) {
      return head +
        '<div class="empty"><span aria-hidden="true">🧢</span>' +
        '<p>Nothing on the shelf right now.</p>' +
        '<small>Buy cutters to unlock more upgrades.</small></div>';
    }
    return head + '<div class="list">' + open.map(upgradeCard).join('') + '</div>';
  }

  function prestigeCard(p) {
    const level = pres(p.id);
    const maxed = level >= p.max;
    const cost = presCost(p);
    const afford = !maxed && state.fertilizer >= cost;

    return (
      '<button type="button" class="card pres' + (afford ? ' can-afford' : '') + (maxed ? ' is-maxed' : '') + '" data-pres="' + p.id + '"' + (maxed ? ' disabled' : '') + '>' +
        '<span class="card-ico" aria-hidden="true">' + p.icon + '</span>' +
        '<span class="card-main">' +
          '<span class="card-title">' + p.name + ' <em class="lvl">Lv ' + level + '/' + p.max + '</em></span>' +
          '<span class="card-sub">' + p.desc + '</span>' +
        '</span>' +
        '<span class="card-price"><b>' + (maxed ? 'MAX' : fmt(cost)) + '</b><small>' + (maxed ? '' : 'fertilizer') + '</small></span>' +
      '</button>'
    );
  }

  function prestigeHTML() {
    const gain = prestigeGain();
    let html =
      '<div class="hero">' +
        '<div class="hero-top"><span class="hero-icon" aria-hidden="true">🧪</span>' +
          '<div><b>' + fmt(state.fertilizer) + '</b><small>fertilizer</small></div></div>' +
        '<p>Fertilizer is permanent. Reseeding wipes your grass, cutters and upgrades — but the soil remembers: every fertilizer gives <b>+2% production forever</b>.</p>' +
        '<p>This run grew <b>' + fmt(state.runEarned) + '</b> grass, which is worth <b class="gold">+' + fmt(gain) + '</b> fertilizer.</p>' +
        (gain < 1 ? '<p class="hero-need">Grow at least 250K grass in a single run to earn the first fertilizer.</p>' : '') +
        '<button type="button" class="btn primary wide" id="reseed"' + (gain < 1 ? ' disabled' : '') + '>' + (gain < 1 ? 'Keep mowing' : 'Reseed the lawn') + '</button>' +
        '<p class="fine">Gain = ⌊√(run grass ÷ 250K)⌋ · ' + state.resets + ' reseed' + (state.resets === 1 ? '' : 's') + ' so far</p>' +
      '</div>' +
      '<h2 class="section-title">Permanent upgrades</h2><div class="list">';

    PRESTIGE_UPGRADES.forEach((p) => {
      html += prestigeCard(p);
    });
    return html + '</div>';
  }

  function statsHTML() {
    const c = computed();
    const rows = [
      ['Grass this run', fmt(state.runEarned)],
      ['Grass all time', fmt(state.lifetime)],
      ['Grass per second', fmt(c.cps)],
      ['Grass per cut', fmt(c.clickPower)],
      ['Cuts made', fmt(state.clicks)],
      ['Upgrades bought', String(Object.keys(state.upgrades).filter((k) => state.upgrades[k]).length)],
      ['Golden grass found', String(state.goldenClicked)],
      ['Reseeds', String(state.resets)],
      ['Best run', fmt(state.bestRun)],
      ['Time played', fmtTime(state.totalPlaytime)]
    ];

    let html = '<div class="stat-grid">';
    rows.forEach((row) => {
      html += '<div class="stat"><span>' + row[0] + '</span><b>' + row[1] + '</b></div>';
    });
    html += '</div>';

    html += '<h2 class="section-title">Achievements · ' + achievedCount() + '/' + ACHIEVEMENTS.length + ' (+' + achievedCount() + '% production)</h2><div class="ach-grid">';
    ACHIEVEMENTS.forEach((a) => {
      const unlocked = !!state.achievements[a.id];
      html += '<div class="ach' + (unlocked ? ' is-unlocked' : '') + '">' +
        '<span class="ach-ico" aria-hidden="true">' + a.icon + '</span>' +
        '<div><b>' + a.name + '</b><small>' + a.desc + '</small></div></div>';
    });
    html += '</div>';

    html += '<h2 class="section-title">Save</h2>' +
      '<div class="save-row">' +
        '<button type="button" class="btn" id="save-now">Save now</button>' +
        '<button type="button" class="btn" id="export-btn">Export</button>' +
        '<button type="button" class="btn" id="import-btn">Import</button>' +
      '</div>' +
      '<textarea class="save-box" id="save-box" spellcheck="false" placeholder="Press Export to get a save code, or paste one here and press Import."></textarea>' +
      '<p class="fine">Your save lives in this browser only. Export a code before switching devices or clearing site data.</p>';

    if (state.lifetime > 0) {
      html += '<div class="save-row" style="margin-top:14px"><button type="button" class="btn danger" id="reset-btn">Erase everything</button></div>';
    }
    return html;
  }

  function renderPane() {
    if (!el.pane) return;
    if (state.tab === 'upgrades') el.pane.innerHTML = upgradesHTML();
    else if (state.tab === 'prestige') el.pane.innerHTML = prestigeHTML();
    else if (state.tab === 'stats') el.pane.innerHTML = statsHTML();
    else el.pane.innerHTML = cuttersHTML();

    $$('#tabs .tab').forEach((tab) => {
      tab.classList.toggle('is-active', tab.dataset.tab === state.tab);
    });
    updateAffordability();
  }

  function updateAffordability() {
    $$('#pane [data-buy]', el.pane).forEach((node) => {
      const i = Number(node.dataset.buy);
      const amount = state.buyAmount === 'max' ? Math.max(1, maxAffordable(i)) : state.buyAmount;
      const cost = Math.ceil(genBulkCost(i, state.gens[i], amount));
      node.classList.toggle('can-afford', state.grass >= cost);

      const price = node.querySelector('.card-price b');
      if (price) setText(price, fmt(cost));
      const unit = node.querySelector('.card-price small');
      if (unit) setText(unit, amount > 1 ? '×' + fmt(amount) : 'grass');
      const bar = node.querySelector('.card-bar i');
      if (bar) bar.style.width = clamp((state.grass / cost) * 100, 0, 100).toFixed(1) + '%';
    });

    $$('#pane [data-upgrade]', el.pane).forEach((node) => {
      const u = UPGRADE_MAP.get(node.dataset.upgrade);
      if (u) node.classList.toggle('can-afford', state.grass >= u.cost);
    });

    $$('#pane [data-pres]', el.pane).forEach((node) => {
      const p = PRESTIGE_UPGRADES.find((x) => x.id === node.dataset.pres);
      if (!p) return;
      const maxed = pres(p.id) >= p.max;
      node.classList.toggle('can-afford', !maxed && state.fertilizer >= presCost(p));
    });

    const reseed = $('#reseed', el.pane);
    if (reseed) reseed.disabled = prestigeGain() < 1;

    const openUpgrades = UPGRADES.filter((u) => !state.upgrades[u.id] && u.req(state) && state.grass >= u.cost).length;
    setBadge(el.upgBadge, openUpgrades);
    setBadge(el.presBadge, prestigeGain() >= 1 ? 1 : 0, '!');
  }

  function setBadge(node, n, text) {
    if (!node) return;
    node.hidden = !n;
    setText(node, text || String(n));
  }

  function updateHud() {
    const c = computed();
    setText(el.grass, fmt(state.grass));
    setText(el.rate, fmt(c.cps) + '/sec');
    setText(el.click, fmt(c.clickPower) + ' per cut');

    if (el.fertPill) {
      const show = state.fertilizer > 0 || state.resets > 0;
      if (el.fertPill.hidden === show) el.fertPill.hidden = !show;
      setText(el.fertAmount, fmt(state.fertilizer));
    }

    const remaining = state.boostUntil - Date.now();
    if (el.boost) {
      if (remaining > 0) {
        el.boost.hidden = false;
        setText(el.boostMult, '×' + fmt(state.boostMult));
        setText(el.boostTime, Math.ceil(remaining / 1000) + 's');
      } else if (!el.boost.hidden) {
        el.boost.hidden = true;
      }
    }
  }

  /* ------------------------------------------------------------- notifications */
  function toast(title, body, icon) {
    if (!el.toasts) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML =
      '<span class="toast-ico" aria-hidden="true">' + (icon || '🌱') + '</span>' +
      '<div><b></b><small></small></div>';
    node.querySelector('b').textContent = title;
    node.querySelector('small').textContent = body || '';
    el.toasts.appendChild(node);
    while (el.toasts.children.length > 4) el.toasts.removeChild(el.toasts.firstChild);
    setTimeout(() => node.remove(), 4000);
  }

  let modalAction = null;

  function openModal(opts) {
    el.modalTitle.textContent = opts.title;
    el.modalBody.innerHTML = opts.body;
    el.modalOk.textContent = opts.confirm || 'OK';
    el.modalCancel.textContent = opts.cancel || 'Cancel';
    el.modalOk.className = 'btn ' + (opts.danger ? 'danger' : 'primary');
    modalAction = opts.onConfirm || null;
    el.modal.hidden = false;
    el.modalOk.focus();
  }

  function closeModal() {
    el.modal.hidden = true;
    modalAction = null;
  }

  /* ------------------------------------------------------------- actions */
  function cut(x, y) {
    const c = computed();
    const gain = c.clickPower;
    state.grass += gain;
    state.runEarned += gain;
    state.lifetime += gain;
    state.clicks += 1;

    floater(gain, x, y);
    if (el.lawn) {
      el.lawn.classList.add('hit');
      el.lawn.style.setProperty('--mx', (x - el.lawn.getBoundingClientRect().left) + 'px');
      el.lawn.style.setProperty('--my', (y - el.lawn.getBoundingClientRect().top) + 'px');
      clearTimeout(cut._t);
      cut._t = setTimeout(() => el.lawn.classList.remove('hit'), 90);
    }

    updateHud();
    checkAchievements();
  }

  function floater(value, x, y) {
    if (!el.floaters || !el.lawn) return;
    const rect = el.lawn.getBoundingClientRect();
    const node = document.createElement('span');
    node.className = 'floater';
    node.textContent = '+' + fmt(value);
    node.style.left = (x - rect.left + (Math.random() * 26 - 13)) + 'px';
    node.style.top = (y - rect.top - 12) + 'px';
    el.floaters.appendChild(node);
    setTimeout(() => node.remove(), 900);
  }

  function buyGen(i) {
    const amount = state.buyAmount === 'max' ? maxAffordable(i) : state.buyAmount;
    if (amount < 1) return;
    const cost = Math.ceil(genBulkCost(i, state.gens[i], amount));
    if (cost > state.grass) return;

    state.grass -= cost;
    state.gens[i] += amount;
    renderPane();
    updateHud();
  }

  function buyUpgrade(id) {
    const u = UPGRADE_MAP.get(id);
    if (!u || state.upgrades[id] || state.grass < u.cost) return;
    state.grass -= u.cost;
    state.upgrades[id] = true;
    toast('Upgrade bought', u.name + ' — ' + u.desc, u.icon);
    renderPane();
    updateHud();
  }

  function buyPrestige(id) {
    const def = PRESTIGE_UPGRADES.find((p) => p.id === id);
    if (!def) return;
    const level = pres(id);
    const cost = presCost(def);
    if (level >= def.max || state.fertilizer < cost) return;

    state.fertilizer -= cost;
    state.pres[id] = level + 1;
    toast('Fertilizer spent', def.name + ' is now level ' + (level + 1) + '.', def.icon);
    save();
    renderPane();
    updateHud();
  }

  function setBuyAmount(value) {
    state.buyAmount = value === 'max' ? 'max' : Number(value);
    renderPane();
  }

  function askPrestige() {
    const gain = prestigeGain();
    if (gain < 1) return;
    openModal({
      title: 'Reseed the lawn?',
      body:
        '<p>You keep <b>' + fmt(state.fertilizer) + '</b> fertilizer and gain <b>' + fmt(gain) + '</b> more, plus every permanent upgrade and achievement.</p>' +
        '<p>You lose this run’s grass, cutters, upgrades and progress.</p>',
      confirm: 'Reseed',
      onConfirm: () => doPrestige()
    });
  }

  function doPrestige() {
    const gain = prestigeGain();
    if (gain < 1) return;

    state.bestRun = Math.max(state.bestRun, state.runEarned);
    state.fertilizer += gain;
    state.fertEarned += gain;
    state.resets += 1;
    state.runEarned = 0;
    state.grass = 0;
    state.upgrades = {};
    state.gens = GENS.map((_, i) => (i === 0 ? 5 * pres('start') : 0));
    state.boostUntil = 0;
    state.goldenSpawnAt = 0;
    hideGolden(Date.now());

    save();
    renderPane();
    updateHud();
    toast('Fresh soil', 'You gained ' + fmt(gain) + ' fertilizer. +' + fmt(state.fertilizer) + ' total.', '🧪');
  }

  function encodeSave() {
    const bytes = new TextEncoder().encode(JSON.stringify(state));
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  function decodeSave(text) {
    const binary = atob(text.replace(/\s+/g, ''));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return mergeState(JSON.parse(new TextDecoder().decode(bytes)));
  }

  function save(manual) {
    state.lastTick = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      setText(el.saveNote, 'saved ' + new Date().toLocaleTimeString());
      if (manual) toast('Saved', 'Your lawn is safe in this browser.', '💾');
    } catch (err) {
      setText(el.saveNote, 'could not save');
    }
  }

  function checkAchievements() {
    let changed = false;
    ACHIEVEMENTS.forEach((a) => {
      if (state.achievements[a.id]) return;
      if (!a.check(state)) return;
      state.achievements[a.id] = true;
      changed = true;
      toast('Achievement: ' + a.name, a.desc + ' +1% production.', a.icon);
    });
    if (changed && state.tab === 'stats') renderPane();
    return changed;
  }

  /* ------------------------------------------------------------- golden grass */
  let goldenVisibleUntil = 0;

  function goldenDelay() {
    const luck = pres('luck');
    return Math.max(35, (80 + Math.random() * 90) * (1 - 0.07 * luck)) * 1000;
  }

  function showGolden(now) {
    if (!el.golden || !el.lawn) return;
    const w = el.lawn.clientWidth;
    const h = el.lawn.clientHeight;
    el.golden.style.left = Math.round(12 + Math.random() * Math.max(1, w - 92)) + 'px';
    el.golden.style.top = Math.round(14 + Math.random() * Math.max(1, h - 100)) + 'px';
    el.golden.hidden = false;
    goldenVisibleUntil = now + 12000 + 1000 * pres('luck');
  }

  function hideGolden(now) {
    if (el.golden) el.golden.hidden = true;
    goldenVisibleUntil = 0;
    state.goldenSpawnAt = now + goldenDelay();
  }

  function collectGolden() {
    const now = Date.now();
    const luck = pres('luck');
    state.boostMult = 7 * (1 + 0.5 * luck);
    state.boostUntil = now + 20000 + 2000 * luck;
    state.goldenClicked += 1;
    hideGolden(now);
    toast('Golden grass!', 'Production ×' + fmt(state.boostMult) + ' for ' + Math.round((state.boostUntil - now) / 1000) + 's.', '🍀');
    updateHud();
  }

  function tickGolden(now) {
    if (!el.golden) return;
    if (state.lifetime < 5000) return;

    if (!el.golden.hidden) {
      if (now > goldenVisibleUntil) hideGolden(now);
      return;
    }
    if (!state.goldenSpawnAt) {
      state.goldenSpawnAt = now + goldenDelay();
      return;
    }
    if (now >= state.goldenSpawnAt) showGolden(now);
  }

  /* ------------------------------------------------------------- offline */
  function applyOffline() {
    const now = Date.now();
    const away = (now - state.lastTick) / 1000;
    state.lastTick = now;
    if (!(away > 45)) return null;

    const c = computed();
    if (!(c.cps > 0)) return null;

    const efficiency = clamp(0.5 + 0.1 * pres('offline'), 0, 1);
    const capped = Math.min(away, OFFLINE_CAP);
    const gained = c.cps * capped * efficiency;
    if (!(gained > 0)) return null;

    state.grass += gained;
    state.runEarned += gained;
    state.lifetime += gained;

    return { away: away, capped: capped, gained: gained, efficiency: efficiency };
  }

  /* ------------------------------------------------------------- loop */
  let lastFrame = Date.now();

  function frame() {
    const now = Date.now();
    const dt = clamp((now - lastFrame) / 1000, 0, 5);
    lastFrame = now;

    if (dt > 0) {
      const c = computed();
      if (c.cps > 0) {
        const gain = c.cps * dt;
        state.grass += gain;
        state.runEarned += gain;
        state.lifetime += gain;
      }
      state.totalPlaytime += dt;
    }

    tickGolden(now);
    checkAchievements();
    updateHud();
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------- wiring */
  function buildTufts() {
    const layer = $('#tufts');
    if (!layer) return;
    let html = '';
    const count = 72;
    for (let i = 0; i < count; i += 1) {
      const left = (i / count) * 100 + (Math.random() * 1.6 - 0.8);
      const height = 16 + Math.random() * 54;
      const width = 3 + Math.random() * 4;
      const duration = 2.4 + Math.random() * 2.8;
      const delay = Math.random() * 3;
      const hue = 92 + Math.random() * 42;
      const light = 26 + Math.random() * 16;
      html += '<i style="left:' + left.toFixed(2) + '%;height:' + height.toFixed(0) + 'px;width:' + width.toFixed(1) +
        'px;animation-duration:' + duration.toFixed(1) + 's;animation-delay:-' + delay.toFixed(1) +
        's;background:hsl(' + hue.toFixed(0) + ' 60% ' + light.toFixed(0) + '%)"></i>';
    }
    layer.innerHTML = html;
  }

  function init() {
    el.grass = $('#grass-amount');
    el.rate = $('#rate-line');
    el.click = $('#click-line');
    el.fertPill = $('#fert-pill');
    el.fertAmount = $('#fert-amount');
    el.pane = $('#pane');
    el.tabs = $('#tabs');
    el.upgBadge = $('#upg-badge');
    el.presBadge = $('#pres-badge');
    el.lawn = $('#lawn');
    el.golden = $('#golden');
    el.boost = $('#boost');
    el.boostMult = $('#boost-mult');
    el.boostTime = $('#boost-time');
    el.floaters = $('#floaters');
    el.saveNote = $('#save-note');
    el.toasts = $('#toasts');
    el.modal = $('#modal');
    el.modalTitle = $('#modal-title');
    el.modalBody = $('#modal-body');
    el.modalOk = $('#modal-ok');
    el.modalCancel = $('#modal-cancel');

    buildTufts();

    const offline = applyOffline();
    renderPane();
    updateHud();

    if (offline) {
      openModal({
        title: 'Welcome back',
        body:
          '<p>The lawn kept growing for <b>' + fmtTime(offline.away) + '</b>.</p>' +
          '<p>Your cutters collected <b>' + fmt(offline.gained) + ' grass</b> while you were away (' + Math.round(offline.efficiency * 100) + '% efficiency).</p>',
        confirm: 'Keep mowing',
        cancel: 'Close'
      });
    }

    el.lawn.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#golden')) return;
      e.preventDefault();
      cut(e.clientX, e.clientY);
    });

    el.lawn.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      const rect = el.lawn.getBoundingClientRect();
      cut(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    el.golden.addEventListener('click', (e) => {
      e.stopPropagation();
      collectGolden();
    });

    el.tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      state.tab = tab.dataset.tab;
      renderPane();
    });

    el.pane.addEventListener('click', (e) => {
      const buy = e.target.closest('[data-buy]');
      if (buy) { buyGen(Number(buy.dataset.buy)); return; }

      const upgrade = e.target.closest('[data-upgrade]');
      if (upgrade) { buyUpgrade(upgrade.dataset.upgrade); return; }

      const chip = e.target.closest('[data-amount]');
      if (chip) { setBuyAmount(chip.dataset.amount); return; }

      const presUpgrade = e.target.closest('[data-pres]');
      if (presUpgrade) { buyPrestige(presUpgrade.dataset.pres); return; }

      if (e.target.closest('#reseed')) { askPrestige(); return; }
      if (e.target.closest('#save-now')) { save(true); return; }

      if (e.target.closest('#export-btn')) {
        const box = $('#save-box');
        if (!box) return;
        box.value = encodeSave();
        box.focus();
        box.select();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(box.value).catch(() => {});
        }
        toast('Save exported', 'Code copied — keep it somewhere safe.', '💾');
        return;
      }

      if (e.target.closest('#import-btn')) {
        const box = $('#save-box');
        if (!box) return;
        const text = box.value.trim();
        if (!text) {
          toast('Nothing to import', 'Paste a save code into the box first.', '⚠️');
          return;
        }
        try {
          state = decodeSave(text);
          lastFrame = Date.now();
          save();
          renderPane();
          updateHud();
          toast('Save imported', 'Welcome back to your lawn.', '📥');
        } catch (err) {
          toast('That code did not work', 'Make sure you pasted the whole code.', '⚠️');
        }
        return;
      }

      if (e.target.closest('#reset-btn')) {
        openModal({
          title: 'Erase everything?',
          body:
            '<p>This deletes your save from this browser: grass, cutters, upgrades, fertilizer and achievements.</p>' +
            '<p>There is no undo. Export a save code first if you might want it back.</p>',
          confirm: 'Erase save',
          danger: true,
          onConfirm: () => {
            try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
            state = defaultState();
            lastFrame = Date.now();
            hideGolden(Date.now());
            renderPane();
            updateHud();
            toast('Save erased', 'A fresh lawn awaits.', '🌱');
          }
        });
      }
    });

    el.modalCancel.addEventListener('click', closeModal);
    el.modalOk.addEventListener('click', () => {
      const action = modalAction;
      closeModal();
      if (action) action();
    });
    el.modal.addEventListener('click', (e) => {
      if (e.target === el.modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !el.modal.hidden) closeModal();
      if (e.key === ' ' && document.activeElement === document.body) {
        const rect = el.lawn.getBoundingClientRect();
        cut(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) save();
    });
    window.addEventListener('beforeunload', () => save());

    window.addEventListener('resize', () => {
      if (!el.golden.hidden) hideGolden(Date.now());
    });

    setInterval(() => save(), 10000);
    setInterval(updateAffordability, 250);

    lastFrame = Date.now();
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
