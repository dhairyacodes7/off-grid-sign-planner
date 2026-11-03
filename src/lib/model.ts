// @ts-nocheck
// Physics model, copied from ../Sign_Planner/model/model.js (tested there with node test_*.js).
// Keep both in step: change the model there first, run the tests, then run python3 to_ts.py.
/* eslint-disable */
// Illuminators off-grid sign model.
// Pure functions: the same file runs in the planner page and in Node tests (test_model.js).
// Units: energy Wh, power W, sun kWh/m2/day, money Rs before GST (GST is added at the end).
// Every number below is tagged in P / PRICE; the page's "Every number we used" table lists the same values.
const DEG = Math.PI / 180;
const M: any = {};

// ---------- physics and design parameters ----------
M.P = {
  site: { minTilt: 10, albedo: 0.2 },   // tilt is chosen per place (best worst month); 10 deg minimum so rain cleans the panel
  pv: { gamma: -0.0035, noct: 45, tAmbOffset: -2, mismatchWiring: 0.03, mppt: 0.97,
        degrade: 0.055,                     // 0.55 %/year, sized for year 10 (end of design life)
        soilDry: 0.05, soilWet: 0.01,       // Oct-May dusty, Jun-Sep rain washes panels
        lowLightLoss: 0.05, lowLightRef: 300 },
  bat: { etaC: 0.97, etaD: 0.97, dod: 0.9, eol: 0.8,     // LiFePO4; sized so it still works at 80% capacity
         heatBelow: 0, heatTo: 5, heatUA: [0.3, 0.25] },    // LiFePO4 must not CHARGE below 0 C: while charging on cold days a heater
                                                            // keeps the insulated box at 5 C; loss UA = 0.3 + 0.25 x kWh^(2/3) W/K
  ctrlW: 2,                                // ESP32 + GSM + sensors + MPPT self use, all day
  bufferH: 2,                              // smallest battery: 2 hours of the evening load (1.5 x the night average)
  dcEff: 0.92,                             // battery -> 5 V LED supply
  inv: { eff: 0.92, idleFrac: 0.01 },      // 230 V inverter for LCD and concert wall
  night: { limitSmall: 600, limitBig: 300, bigM2: 10, late: 0.5, duskDelayH: 0.2 },
  day: { sunL: 5000, avgFactor: 0.64, floorL: 800 },     // auto-brightness follows daylight
  flood: { luxCity: 450, luxOpen: 300, efficacy: 120, uf: 0.6, mf: 0.8, luxEpaper: 150 },
  // backlit lightbox, made as bright as the floodlit white print (lux x 0.7 / pi): light must pass the translucent flex
  // (Heytex backlit flex about 32%), and only part of the LED light reaches the face inside a white box (assumed)
  backlit: { tau: [0.32, 0.25], box: [0.8, 0.6], efficacy: [130, 120], white: 0.7 },
  mod: { m2: 0.0512, w: 0.32, h: 0.16 },  // every outdoor LED module here is 320 x 160 mm
  // full-colour outdoor modules by pitch (gap between dots, mm): dots per module, max cd/m2, W at full white,
  // W with a black screen (assumed: scaled with the number of driver chips; measure first)
  pitches: {
    4:  { px: [80, 40], Lmax: 5000, max: [38, 46], idle: [0.75, 2.5] },
    5:  { px: [64, 32], Lmax: 5500, max: [40, 46], idle: [0.6, 2.0] },
    8:  { px: [40, 20], Lmax: 5000, max: [35, 44], idle: [0.4, 1.25] },
    10: { px: [32, 16], Lmax: 5600, max: [27, 30], idle: [0.3, 1.0] },
  },
  saver: [0.7, 0.8],       // common-cathode "energy-saving" modules: makers claim 20-30% less power at the same light
  view: { mmPerM: 1, smooth: 3 },   // rule of thumb: dots blend from 1 m per mm of pitch, look smooth from ~3 m per mm
  // what plays the pictures: an ESP32 for small screens, else an LED media player (NovaStar TB40: 12 W typical)
  // + receiving cards (A5s Plus: 3 W, up to 512 x 384 dots); one card per 18-module cabinet in the high case
  video: { espPx: 8192, playerW: [12, 15], cardPx: 196608, cardW: 3, cabMods: 18, wallCabPx: 16384 },
  // backup that does not need the sun. Diesel: HOMER fuel curve L/h = 0.08145 x rated kW + 0.246 x output kW
  // (gives 1.06 L/h at 3 kW from a 5 kVA set; Indian 5 kVA sheets say 1.0-1.6 L/h at 75%, so x1.0-1.5)
  gen: {
    dg: { name: "Diesel generator 5 kVA", unitW: 4000, maxUnits: 6, f0: 0.08145, f1: 0.246, mult: [1.0, 1.5], charger: 0.92, serviceH: 250 },
    fc: { name: "Methanol fuel cell (EFOY Pro 2800)", unitW: 125, maxUnits: 4, lPerKWh: 0.9, charger: 1.0 },
    chargeC: 0.5,          // LiFePO4 takes at most 0.5 C while charging (assumed)
    bioMult: 1.08,         // biodiesel B100 has about 8% less energy per litre than diesel (assumed)
  },
  // stream turbine (pico-hydro): PowerSpout rule of thumb W = 5 x head (m) x flow (L/s), up to 1.2 kW per unit
  hydro: { wPerMLs: 5, maxW: 1200, monsoon: [6, 7, 8, 9, 10] },
  apl: { bright: 0.65, dark: 0.086, zone: [0.09, 0.20], video: [0.25, 0.37] },
  wall: { cab: 0.5, Lmax: 5500, maxWm2: 800, idleWm2: [25, 60] },
  lcd: { w: 1.21, h: 0.68, P0: 30, Pmax: [220, 390], Lmax: [2500, 4000] },
  epaper: { refreshWh: 10 },
  wind: { area: 2.16, cp: 0.18, rho: 1.16, cutIn: 3, rated: 12, brake: 18 },
  modes: { save: 0.6, survival: 0.25, reserveNormal: 0.3, reserveSave: 0.1 },
  sites: {
    city:    { sun: () => 0.9, wind: 0.5, lux: "luxCity", name: "city street" },
    highway: { sun: () => 1.0, wind: 0.8, lux: "luxOpen", name: "open highway" },
    ghat:    { sun: (m, fog) => (fog.has(m) ? 0.7 : 1.0), wind: 1.1, lux: "luxOpen", name: "ghat or hill road" },   // fog in the 4 cloudiest months
  },
};

M.PRICE = {
  pvBig: [18, 26], pvSmall: [30, 45], frame: [3, 7], frameMin: [1500, 3000],
  lfpBig: [11, 18], lfpSmall: [18, 30], box: [3000, 8000], boxKwh: 5,
  mpptBase: [2500, 4000], mpptPerA: [120, 250], ctrlKit: [3500, 7000],
  turbine: [40000, 120000], inverter: [8, 15],
  flex: [15, 40], floodPerW: [25, 50], floodMin: [1000, 2000],
  lightbox: [170, 300],     // backlit box with frame, backlit flex and LED modules, per sq ft (IndiaMART glow sign boards)
  backlitFlex: 1.5,          // a backlit flex reprint costs about 1.5 x a front-lit one (assumed)
  mods: { 4: [1000, 1250], 5: [1050, 1400], 8: [900, 1200], 10: [350, 750] }, ledExtra: [1.3, 1.6], saverPrice: [1.2, 1.6],
  player: [7900, 16500], playerBig: [25000, 45000], playerBigPx: 650000, card: [2500, 7800],
  dg: [200000, 330000], diesel: [98.63, 98.63], dgService: [2500, 4000],
  fc: [515000, 855000], methanol: [90, 175], biodiesel: [55, 100],
  hydro: [30000, 260000],
  wallSqft: [5000, 7500], wallExtra: [1.1, 1.3],
  lcd: [400000, 550000], lcdMount: [1.1, 1.2], epaperM2: [400000, 700000], epaperBox: [1.2, 1.4],
  fit: [0.10, 0.20], structure: [600, 2000], maint: [2000, 6000],
  gstPv: 0.05, gst: 0.18,
};

M.TARGETS = {
  full:   { darkMax: 0,     normalMin: 1.0,  dimDays: false, label: "Always full brightness" },
  smart:  { darkMax: 0,     normalMin: 0.97, dimDays: true,  label: "Never dark, dims on the worst nights" },
  budget: { darkMax: 0.003, normalMin: 0.90, dimDays: true,  label: "Budget: about 1 dark night a year allowed" },
};

// ---------- sun on a tilted panel (Duffie & Beckman; Liu-Jordan isotropic sky; Erbs 1982) ----------
function geom(n, lat, tilt) {
  const phi = lat * DEG, beta = tilt * DEG;
  const delta = 23.45 * DEG * Math.sin(2 * Math.PI * (284 + n) / 365);            // declination (Cooper)
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta)))); // sunset hour angle
  const flat = Math.cos(phi) * Math.cos(delta) * Math.sin(ws) + ws * Math.sin(phi) * Math.sin(delta);
  const H0 = 24 * 1367 / Math.PI * (1 + 0.033 * Math.cos(2 * Math.PI * n / 365)) * flat / 1000; // kWh/m2/day
  const pe = phi - Math.sign(lat || 1) * beta;                     // panel faces the equator (south in the north, north in the south)
  const wsT = Math.min(ws, Math.acos(Math.max(-1, Math.min(1, -Math.tan(pe) * Math.tan(delta)))));
  const Rb = flat > 1e-6 ? Math.max(0, (Math.cos(pe) * Math.cos(delta) * Math.sin(wsT) + wsT * Math.sin(pe) * Math.sin(delta)) / flat) : 0;
  return { H0, Rb, ws, dayLen: 2 * ws / DEG / 15 };
}
function erbsDaily(KT, wsDeg) {
  if (wsDeg <= 81.4) return KT < 0.715 ? 1 - 0.2727 * KT + 2.4495 * KT ** 2 - 11.9514 * KT ** 3 + 9.3879 * KT ** 4 : 0.143;
  return KT < 0.722 ? 1 + 0.2832 * KT - 2.5557 * KT ** 2 + 0.8448 * KT ** 3 : 0.175;
}
M.tilted = function (H, n, lat, tilt, albedo) {
  const g = geom(n, lat, tilt);
  if (g.H0 < 0.05) return { Ht: H * (1 + Math.cos(tilt * DEG)) / 2, dayLen: g.dayLen, KT: 0, H0: g.H0, fd: 1 };   // polar night
  const KT = Math.min(0.85, H / g.H0);
  const fd = Math.min(1, Math.max(0, erbsDaily(KT, g.ws / DEG)));
  const b = tilt * DEG;
  const Ht = (1 - fd) * H * g.Rb + fd * H * (1 + Math.cos(b)) / 2 + H * albedo * (1 - Math.cos(b)) / 2;
  return { Ht, dayLen: g.dayLen, KT, H0: g.H0, fd };
};

// ---------- PV energy per kWp for one day ----------
M.pvPerKWp = function (Ht, Tmax, dayLen, month) {
  const p = M.P.pv;
  if (dayLen < 0.5 || Ht <= 0) return 0;
  const Gw = Math.min(1000, 1.234 * Ht * 1000 / dayLen);        // energy-weighted irradiance of a sine-shaped day
  const Tcell = Tmax + p.tAmbOffset + (p.noct - 20) / 800 * Gw;  // NOCT cell-temperature model
  const temp = 1 + p.gamma * (Tcell - 25);
  const low = Gw < p.lowLightRef ? 1 - p.lowLightLoss * (p.lowLightRef - Gw) / p.lowLightRef : 1;
  const soil = month >= 6 && month <= 9 ? p.soilWet : p.soilDry;
  return Ht * 1000 * temp * low * (1 - soil) * (1 - p.mismatchWiring) * p.mppt * (1 - p.degrade); // Wh per kWp
};

// ---------- small wind turbine: Rayleigh wind speeds around the daily mean ----------
function turbineW(u) {
  const w = M.P.wind;
  if (u < w.cutIn || u > w.brake) return 0;                      // storm brake above 18 m/s
  const v = Math.min(u, w.rated);
  return 0.5 * w.rho * w.area * w.cp * v * v * v;
}
M.windDayWh = function (vMean) {
  if (vMean < 0.3) return 0;
  let e = 0;
  for (let u = 0.25; u < 30; u += 0.5) {
    const f = (Math.PI / 2) * (u / (vMean * vMean)) * Math.exp(-(Math.PI / 4) * (u / vMean) ** 2);
    e += f * 0.5 * turbineW(u);
  }
  return e * 24;
};

// ---------- 10 years of days for one place ----------
function dates(raw) {
  const t0 = Date.UTC(+raw.start.slice(0, 4), +raw.start.slice(4, 6) - 1, +raw.start.slice(6, 8));
  return raw.H.map((_, i) => {
    const dt = new Date(t0 + i * 864e5), y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1;
    return { y, m, d: dt.getUTCDate(), doy: Math.round((Date.UTC(y, m - 1, dt.getUTCDate()) - Date.UTC(y, 0, 0)) / 864e5) };
  });
}
M.dates = dates;
// cloudiest months at this place (lowest sun / clear-sky sun): where fog and monsoon bite
M.fogMonths = function (raw, D) {
  const s = Array.from({ length: 13 }, () => [0, 0]);
  raw.H.forEach((h, i) => { if (raw.Hc[i] > 0.3) { s[D[i].m][0] += h / raw.Hc[i]; s[D[i].m][1]++; } });
  return new Set(s.map((x, m) => [m, x[1] ? x[0] / x[1] : 1]).slice(1).sort((a, b) => a[1] - b[1]).slice(0, 4).map(x => x[0]));
};
// tilt that gives the most energy in the worst 30 days (an off-grid sign must survive its darkest month)
M.bestTilt = function (raw, D, sunF) {
  const lat = raw.lat, lo = M.P.site.minTilt, hi = Math.min(75, Math.abs(lat) + 30);
  let best = lo, bestVal = -1;
  for (let t = lo; t <= hi; t += 5) {
    const e = raw.H.map((h, i) => { const H = h * sunF(i), g = M.tilted(H, D[i].doy, lat, t, M.P.site.albedo); return M.pvPerKWp(g.Ht, raw.Tx[i], g.dayLen, D[i].m); });
    let run = 0, worst = Infinity;
    for (let i = 0; i < e.length; i++) { run += e[i]; if (i >= 30) run -= e[i - 30]; if (i >= 29) worst = Math.min(worst, run); }
    if (worst > bestVal * 1.005) { bestVal = worst; best = t; }
  }
  return best;
};
M.prepare = function (raw, siteKey) {
  const P = M.P, s = P.sites[siteKey], N = raw.H.length, D = dates(raw), fog = M.fogMonths(raw, D);
  const sunF = i => s.sun(D[i].m, fog);
  const tilt = M.bestTilt(raw, D, sunF);
  const d = { n: N, lat: raw.lat, tilt, fog, pv: new Float64Array(N), dayLen: new Float64Array(N), eveH: new Float64Array(N),
              lateH: new Float64Array(N), cloud: new Float64Array(N), wind: new Float64Array(N), tm: new Float64Array(N),
              pvV: new Float64Array(N),   // Wh per kWp for panels standing upright on the back of the board, facing the equator
              month: new Uint8Array(N), year: new Uint16Array(N), dom: new Uint8Array(N) };
  for (let i = 0; i < N; i++) {
    const m = D[i].m, H = raw.H[i] * sunF(i);
    const t = M.tilted(H, D[i].doy, raw.lat, tilt, P.site.albedo);
    d.pv[i] = M.pvPerKWp(t.Ht, raw.Tx[i], t.dayLen, m);
    const tv = M.tilted(H, D[i].doy, raw.lat, 90, P.site.albedo);
    d.pvV[i] = M.pvPerKWp(tv.Ht, raw.Tx[i], tv.dayLen, m);
    d.dayLen[i] = t.dayLen;
    const nightHalf = Math.max(0, (24 - t.dayLen) / 2 - P.night.duskDelayH);   // solar time: midnight halfway through the night
    d.eveH[i] = nightHalf; d.lateH[i] = nightHalf;
    d.cloud[i] = raw.Hc[i] > 0 ? Math.min(1, H / raw.Hc[i]) : 1;
    d.wind[i] = M.windDayWh(raw.W10[i] * s.wind);
    d.tm[i] = raw.Tm ? raw.Tm[i] : 20;
    d.month[i] = m; d.year[i] = D[i].y; d.dom[i] = D[i].d;
  }
  return d;
};

// stream turbine energy, Wh per day; hy = { flow: L/s, head: m, season: "monsoon" | "all" }
M.hydroW = hy => (hy && hy.flow > 0 && hy.head > 0 ? Math.min(M.P.hydro.maxW, M.P.hydro.wPerMLs * hy.head * hy.flow) : 0);
M.hydroDays = function (days, hy) {
  const W = M.hydroW(hy), a = new Float64Array(days.n);
  if (W <= 0) return null;
  for (let i = 0; i < days.n; i++) a[i] = hy.season === "all" || M.P.hydro.monsoon.includes(days.month[i]) ? W * 24 : 0;
  return a;
};

// ---------- the sign faces ----------
M.pitchFor = function (view) {        // biggest dot gap that still looks solid from this distance
  let p = 4;
  for (const q of Object.keys(M.P.pitches).map(Number).sort((a, b) => a - b)) if (q <= view * M.P.view.mmPerM + 1e-9) p = q;
  return p;
};
M.faces = function (wFt, hFt, zoneShare, pitch) {
  const P = M.P, w = wFt * 0.3048, h = hFt * 0.3048, m2 = w * h;
  pitch = P.pitches[pitch] ? pitch : 10;
  const pm = P.pitches[pitch];
  const ledC = Math.ceil(w / P.mod.w - 1e-9), ledR = Math.ceil(h / P.mod.h - 1e-9);
  const zone = Math.max(4, Math.round(zoneShare * m2 / P.mod.m2));
  const cabC = Math.max(1, Math.round(w / P.wall.cab)), cabR = Math.max(1, Math.round(h / P.wall.cab));
  const lcdC = Math.max(1, Math.round(w / P.lcd.w)), lcdR = Math.max(1, Math.round(h / P.lcd.h));
  return { wFt, hFt, w, h, m2, sqft: wFt * hFt, ledC, ledR, led: ledC * ledR, zone,
           zoneM2: zone * P.mod.m2, printedM2: Math.max(0, m2 - zone * P.mod.m2),
           cabC, cabR, cab: cabC * cabR, wallM2: cabC * cabR * P.wall.cab ** 2, lcdC, lcdR, lcdN: lcdC * lcdR,
           pitch, pxW: ledC * pm.px[0], pxH: ledR * pm.px[1], zonePx: zone * pm.px[0] * pm.px[1],
           wallPx: cabC * cabR * P.video.wallCabPx };
};

// the box that plays the pictures, and its power (W) while the screen is on
M.videoKit = function (id, F, c) {
  const v = M.P.video, R = M.PRICE;
  if (id === "wall") return { esp: false, px: F.wallPx, cards: 0, W: v.playerW[c], cost: 0 };   // cards sit in the cabinets; processor is in the wall price
  if (id !== "zone" && id !== "led") return null;
  const px = id === "zone" ? F.zonePx : F.pxW * F.pxH, mods = id === "zone" ? F.zone : F.led;
  if (px <= v.espPx) return { esp: true, px, cards: 0, W: 0, cost: 0 };
  const cards = Math.max(Math.ceil(px / v.cardPx), c === 1 ? Math.ceil(mods / v.cabMods) : 0);
  return { esp: false, px, cards, W: v.playerW[c] + cards * v.cardW,
           cost: (px > R.playerBigPx ? R.playerBig[c] : R.player[c]) + cards * R.card[c] };
};

// Daily loads at full service (Wh). day/night parts can be dimmed; fixDay/fixNight cannot.
M.loads = function (id, F, inp, days, c) {
  const P = M.P, N = days.n, s = P.sites[inp.site];
  const L = { day: new Float64Array(N), dayShape: new Float64Array(N), night: new Float64Array(N), fixDay: new Float64Array(N), fixNight: new Float64Array(N),
              invW: 0, floodW: 0, peakW: 0 };
  const dayOn = inp.digital === "daynight";
  const lux = P.flood[s.lux];
  const back = inp.printLight === "back", bl = P.backlit;
  const floodWm2 = l => back ? l * bl.white / (bl.tau[c] * bl.box[c] * bl.efficacy[c]) : l / (P.flood.efficacy * P.flood.uf * P.flood.mf);
  const nightLimit = m2 => (m2 > P.night.bigM2 ? P.night.limitBig : P.night.limitSmall);
  const dayL = i => Math.max(P.day.floorL, P.day.sunL * P.day.avgFactor * days.cloud[i]);
  const pm = P.pitches[F.pitch] || P.pitches[10], sv = inp.ledType === "saver" ? P.saver[c] : 1;
  const mods = (n, apl, b) => n * (pm.max[c] * sv * apl * b + pm.idle[c]) / P.dcEff;   // W
  const vk = M.videoKit(id, F, c), kitW = vk ? vk.W : 0;
  L.kitW = kitW;
  let floodW = 0;
  if (id === "print") floodW = F.m2 * floodWm2(lux);
  if (id === "epaper") floodW = F.m2 * P.flood.luxEpaper / (P.flood.efficacy * P.flood.uf * P.flood.mf);   // e-paper keeps its front light
  if (id === "zone") floodW = F.printedM2 * floodWm2(lux);
  L.floodW = floodW;
  if (id === "wall" || id === "lcd") {
    L.peakW = id === "lcd" ? F.lcdN * P.lcd.Pmax[c] : F.wallM2 * P.wall.maxWm2 * 0.6;
    L.invW = L.peakW * 1.25;
  }
  for (let i = 0; i < N; i++) {
    const dl = days.dayLen[i], eve = days.eveH[i], late = days.lateH[i];
    let day = 0, shape = 0, night = floodW * (eve + late * P.night.late);
    const share = Math.max(0, 1 - P.day.floorL / dayL(i));   // above the night-time floor, brightness follows the sun
    if (id === "epaper") day += P.epaper.refreshWh;
    if (id === "zone" || id === "led") {
      const n = id === "zone" ? F.zone : F.led, m2 = n * P.mod.m2;
      const aplN = id === "zone" ? P.apl.zone[c] : P.apl.dark, aplD = id === "zone" ? P.apl.zone[c] : P.apl.bright;
      const bN = nightLimit(m2) / pm.Lmax;
      night += eve * mods(n, aplN, bN) + late * mods(n, aplN, bN * P.night.late);
      if (dayOn) { const b = Math.min(1, dayL(i) / pm.Lmax); day += dl * mods(n, aplD, b); shape += dl * n * pm.max[c] * sv * aplD * b / P.dcEff * share; }
    }
    if (id === "wall") {
      const A = F.wallM2, v = P.apl.video[c], W = b => A * (P.wall.maxWm2 * v * b + P.wall.idleWm2[c]) / P.inv.eff;
      const bN = nightLimit(A) / P.wall.Lmax;
      night += eve * W(bN) + late * W(bN * P.night.late);
      if (dayOn) { const b = Math.min(1, dayL(i) / P.wall.Lmax); day += dl * W(b); shape += dl * A * P.wall.maxWm2 * v * b / P.inv.eff * share; }
    }
    if (id === "lcd") {
      const n = F.lcdN, Lm = P.lcd.Lmax[c], W = Lv => n * (P.lcd.P0 + (P.lcd.Pmax[c] - P.lcd.P0) * Math.min(1, Lv / Lm)) / P.inv.eff;
      const Ln = nightLimit(F.lcdN * P.lcd.w * P.lcd.h);
      night += eve * W(Ln) + late * W(Ln * P.night.late);
      if (dayOn) { day += dl * W(dayL(i)); shape += dl * (W(dayL(i)) - W(0)) * share; }
    }
    const invIdle = L.invW * P.inv.idleFrac;      // inverter runs only while the screen is on
    L.day[i] = day;
    L.dayShape[i] = shape;
    L.night[i] = night;
    L.fixDay[i] = P.ctrlW * dl + (dayOn ? (invIdle + kitW) * dl : 0);
    L.fixNight[i] = P.ctrlW * (24 - dl) + (invIdle + kitW) * (eve + late);
  }
  return L;
};

// ---------- day-by-day battery simulation with the smart controller ----------
// gen (optional): a backup that runs when the sun is not enough: { P: max W, charger: efficiency, lPerKWh(outW) }
M.simulate = function (days, L, kWp, capWh, nTurb, record, gen, extra, solarExtra) {
  const P = M.P, b = P.bat, U = capWh * b.dod * b.eol, md = P.modes, N = days.n;
  let soc = U;
  const st = { N, normal: 0, save: 0, survival: 0, dark: 0, dimDays: 0, unserved: 0, spilled: 0, gen: 0, demand: 0, heatDays: 0,
               genWh: 0, fuel: 0, genH: 0, genDays: 0 };
  const genOn = !!(gen && gen.P > 0), genRec = record && genOn ? new Float32Array(N) : null;
  let today = 0;
  // run the backup until the battery side has G Wh more (or time runs out); returns what it gave
  const run = (G, hours, loadW) => {
    const outW = Math.min(gen.P, P.gen.chargeC * capWh + loadW);   // a small battery cannot take a big charge
    const g = Math.min(G, outW * hours * b.etaC * gen.charger);
    if (g <= 0 || outW <= 0) return 0;
    const out = g / (b.etaC * gen.charger);
    st.genWh += out; st.genH += out / outW; st.fuel += gen.lPerKWh(outW) * out / 1000;
    if (genRec) genRec[today] += out;
    return g;
  };
  const give = g => { const room = U - soc; if (g <= room) { soc += g; return 0; } soc = U; return g - room; };   // rest feeds the sign directly
  const socRec = record ? new Float32Array(N) : null, modeRec = record ? new Uint8Array(N) : null;
  const mult = [1, md.save, md.survival];
  for (let i = 0; i < N; i++) {
    today = i;
    // day: auto-dim the screen if the battery was low at sunrise
    const f0 = soc / U;
    const dm = f0 >= md.reserveNormal ? 0 : f0 >= md.reserveSave ? 1 : 2;
    if (dm > 0 && L.day[i] > 0) st.dimDays++;
    const Nh = days.dayLen[i], pvE = days.pv[i] * kWp + (solarExtra ? solarExtra[i] : 0), wE = nTurb * days.wind[i] + (extra ? extra[i] : 0);
    const windDay = wE * Nh / 24, windNight = wE - windDay;      // the turbine runs day and night
    const pvToday = pvE;
    const heat = days.tm[i] < b.heatBelow && pvToday > 0
      ? (b.heatUA[0] + b.heatUA[1] * Math.pow(capWh / 1000, 2 / 3)) * (b.heatTo - days.tm[i]) * days.dayLen[i] : 0;
    if (heat > 0) st.heatDays++;
    // screens follow the daylight (auto-brightness), so that part of the day load has the same sine shape as the sun
    const S = (L.dayShape ? L.dayShape[i] : 0) * mult[dm], dayUse = L.day[i] * mult[dm] + L.fixDay[i] + heat;
    st.gen += pvE + wE; st.demand += dayUse;
    // the sun follows a sine curve, the load is flat: in the morning and evening the battery helps,
    // around noon the surplus charges it
    const l = Nh < 0.5 ? 0 : dayUse / Nh, lf = Nh < 0.5 ? 0 : (dayUse - S) / Nh;
    const Pq = Nh < 0.5 ? 0 : (pvE - S) * Math.PI / (2 * Nh);   // sun left after the sun-shaped screen load
    let direct;
    if (Nh < 0.5) direct = 0;                                   // polar night: no sun at all
    else if (Pq <= lf) direct = pvE;                            // every bit of sun is used at once
    else {
      const t1 = (Nh / Math.PI) * Math.asin(lf / Pq);
      direct = S + 2 * ((Pq * Nh / Math.PI) * (1 - Math.cos(Math.PI * t1 / Nh)) + lf * (Nh / 2 - t1));
    }
    const surplus = pvE - direct + windDay;
    let deficit = Math.max(0, dayUse - direct), usedGen = false;
    if (genOn && deficit > 0) {
      // the backup keeps the battery above the low reserve through the day
      const lo = md.reserveSave * U, half = deficit / (2 * b.etaD);
      const need = Math.max(half - (soc - lo), deficit / b.etaD - Math.min(surplus * b.etaC, U - soc + half) - (soc - lo));
      if (need > 0) { const g = run(need, Nh, l); deficit = Math.max(0, deficit - give(g) * b.etaD); usedGen = g > 0; }
    }
    const draw = e => { const need = e / b.etaD; if (need > soc) { st.unserved += (need - soc) * b.etaD; soc = 0; } else soc -= need; };
    draw(deficit / 2);
    const add = surplus * b.etaC, room = U - soc;
    if (add > room) { st.spilled += (add - room) / b.etaC; soc = U; } else soc += add;
    draw(deficit / 2);
    // night: pick the brightest mode that keeps a reserve until sunrise
    const nN = L.night[i], fx = Math.max(0, L.fixNight[i] - windNight);
    let wLeft = Math.max(0, windNight - L.fixNight[i]), cover = 0;
    // a stream flows steadily, so the controller can count on it tonight (wind it cannot: gusts come and go)
    if (extra && extra[i] > 0) cover = Math.min(wLeft, extra[i] * (24 - Nh) / 24);
    if (genOn) {
      // in the evening the backup fills the battery for a full-light night plus the normal reserve
      const nh = Math.max(1, 24 - Nh), G = (nN + fx - wLeft) / b.etaD + md.reserveNormal * U - soc;
      if (G > 0) { const g = run(G, nh, (nN + fx) / nh); const gc = give(g) * b.etaD; cover += gc; wLeft += gc; usedGen = usedGen || g > 0; }
    }
    if (usedGen) st.genDays++;
    let m = 2;
    if (soc - Math.max(0, nN + fx - cover) / b.etaD >= md.reserveNormal * U - 1e-6) m = 0;
    else if (soc - Math.max(0, nN * md.save + fx - cover) / b.etaD >= md.reserveSave * U - 1e-6) m = 1;
    const nightUse = Math.max(0, nN * mult[m] + fx - wLeft);
    st.demand += nN * mult[m] + L.fixNight[i];
    const need = nightUse / b.etaD;
    if (need > soc + 1e-9) { st.unserved += (need - soc) * b.etaD; soc = 0; st.dark++; if (modeRec) modeRec[i] = 3; }
    else { soc -= need; st[["normal", "save", "survival"][m]]++; if (modeRec) modeRec[i] = m; }
    if (socRec) socRec[i] = soc / U;
  }
  st.U = U;
  if (record) { st.soc = socRec; st.mode = modeRec; st.genRec = genRec; }
  return st;
};

M.meets = function (st, t) {
  return st.dark <= Math.floor(t.darkMax * st.N) && st.normal >= Math.ceil(t.normalMin * st.N - 1e-9) && (t.dimDays || st.dimDays === 0);
};

// ---------- what the market sells ----------
M.PV_OPTIONS = (() => {
  const a = [10, 20, 30, 50, 75, 100, 150, 200, 250, 300, 400].map(w => ({ Wp: w, n: 1, big: false }));
  for (let k = 1; k <= 800; k++) a.push({ Wp: 540 * k, n: k, big: true });
  return a;
})();
M.PACKS = (() => {
  const a = [77, 154, 256, 384, 640, 1280, 1920, 2560, 5120, 10240, 14336];
  for (let k = 1; k <= 80; k++) a.push(16077 * k);
  return a;
})();
M.batteryV = Wh => (Wh < 2000 ? 12.8 : Wh < 5200 ? 25.6 : 51.2);

// power-system cost before GST: panels, panel frame, battery, box, charge controller + ESP32 kit, turbines
M.powerCost = function (pv, capWh, nTurb, c) {
  const R = M.PRICE, V = M.batteryV(capWh);
  const panels = pv.Wp * (pv.big ? R.pvBig[c] : R.pvSmall[c]);
  const frame = pv.Wp > 0 ? Math.max(pv.Wp * R.frame[c], R.frameMin[c]) : 0;
  const battery = capWh * (capWh < 1000 ? R.lfpSmall[c] : R.lfpBig[c]);
  const box = R.box[c] * Math.max(1, Math.ceil(capWh / 1000 / R.boxKwh));
  const amps = pv.Wp / V * 1.25;
  const controller = R.mpptBase[c] + R.mpptPerA[c] * amps + R.ctrlKit[c];
  const turbine = nTurb * R.turbine[c];
  return { panels, frame, battery, box, controller, turbine, amps, V,
           sum: panels + frame + battery + box + controller + turbine };
};

// cheapest panel + battery (+ turbine) that meets the target over all 10 years
M.optimise = function (days, L, c, target, windChoices, extra, maxWp, solarExtra) {
  const N = days.n;
  let avgAll = 0, avgNight = 0;
  for (let i = 0; i < N; i++) { avgAll += L.day[i] + L.night[i] + L.fixDay[i] + L.fixNight[i]; avgNight += L.night[i] + L.fixNight[i]; }
  avgAll /= N; avgNight /= N;
  const usable = M.P.bat.dod * M.P.bat.eol;
  // at least ~2 hours of the evening load as a buffer (the model works in whole days, so it cannot see the evening peak)
  const buffer = M.P.bufferH * 1.5 * avgNight / 12;
  const minU = extra ? Math.min(0.5 * avgNight, buffer) : 0.5 * avgNight;   // a steady stream lets the battery be just a buffer
  const packs = M.PACKS.filter(w => w * usable >= minU && w * usable <= 120 * avgAll);   // up to ~4 months: polar nights
  let best = null, sims = 0;
  const byT = {};
  for (const nT of windChoices) {
    let bestT = null;
    for (const cap of packs) {
      if (bestT && M.powerCost(M.PV_OPTIONS[0], cap, nT, c).sum >= bestT.cost.sum) break;
      const ok = k => { sims++; return M.meets(M.simulate(days, L, M.PV_OPTIONS[k].Wp / 1000, cap, nT, false, null, extra, solarExtra), target); };
      let lo = 0, hi = M.PV_OPTIONS.length - 1;
      while (maxWp !== undefined && hi > 0 && M.PV_OPTIONS[hi].Wp > maxWp) hi--;     // no more panels than fit on the board
      if (!ok(hi)) continue;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (ok(mid)) hi = mid; else lo = mid + 1; }
      const pv = M.PV_OPTIONS[lo], cost = M.powerCost(pv, cap, nT, c);
      if (!bestT || cost.sum < bestT.cost.sum) bestT = { pv, cap, nT, cost };
    }
    if (bestT) {
      bestT.stats = M.simulate(days, L, bestT.pv.Wp / 1000, bestT.cap, bestT.nT, false, null, extra, solarExtra);
      byT[nT] = bestT;
      if (!best || bestT.cost.sum < best.cost.sum) best = bestT;
    }
  }
  return { best, byT, avgAll, avgNight, sims };
};

// ---------- backup that does not need the sun: diesel generator or methanol fuel cell ----------
M.genUnit = function (kind, units, c) {
  const g = M.P.gen[kind];
  const lPerKWh = kind === "dg"
    ? outW => g.mult[c] * (g.f0 * Math.ceil(outW / g.unitW - 1e-9) * g.unitW / 1000 + g.f1 * outW / 1000) / (outW / 1000)
    : () => g.lPerKWh;
  return { kind, units, P: units * g.unitW, charger: g.charger || 1, lPerKWh };
};
// cheapest over 10 years (buy + fuel + service) that meets the target; solar = also try panels
M.optimiseGen = function (days, L, c, target, kind, solar, maxWp, fuel, solarExtra) {
  const N = days.n, R = M.PRICE, g = M.P.gen[kind], yrs = N / 365.25;
  let avgAll = 0, avgNight = 0, peakW = 0;
  for (let i = 0; i < N; i++) {
    const dl = Math.max(0.5, days.dayLen[i]);
    avgAll += L.day[i] + L.night[i] + L.fixDay[i] + L.fixNight[i]; avgNight += L.night[i] + L.fixNight[i];
    peakW = Math.max(peakW, (L.day[i] + L.fixDay[i]) / dl, (L.night[i] + L.fixNight[i]) / Math.max(1, 24 - dl));
  }
  avgAll /= N; avgNight /= N;
  const usable = M.P.bat.dod * M.P.bat.eol;
  // a generator must carry the biggest hour; a fuel cell only has to make the day's energy over 24 h
  const units = kind === "dg" ? Math.max(1, Math.ceil(peakW * 1.1 / g.unitW)) : Math.max(1, Math.ceil(avgAll * 1.25 / (g.unitW * 24 * 0.9)));
  if (units > g.maxUnits) return { best: null, byT: {}, avgAll, avgNight, sims: 0, kind };
  const gen = M.genUnit(kind, units, c);
  const packsAll = M.PACKS.filter(w => w * usable >= M.P.bufferH * 1.5 * avgNight / 12 && w * usable <= 2.5 * avgAll);
  const step = Math.max(1, Math.ceil(packsAll.length / 10));
  const packs = packsAll.filter((_, k) => k % step === 0);
  const kMax = Math.ceil(avgAll / 540 / 2.0);
  const pvs = [{ Wp: 0, n: 0, big: false }];
  if (solar) {
    const lim = maxWp === undefined ? Infinity : maxWp;
    for (const w of [50, 100, 200, 400]) if (w <= kMax * 540 && w <= lim) pvs.push({ Wp: w, n: 1, big: false });
    for (const k of [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 22, 27, 33, 40, 50, 60, 75, 90, 110, 135, 165, 200]) if (k <= kMax && 540 * k <= lim) pvs.push({ Wp: 540 * k, n: k, big: true });
  }
  const buy = units * R[kind][c];
  let best = null, sims = 0;
  for (const pv of pvs) for (const cap of packs) {
    sims++;
    const st = M.simulate(days, L, pv.Wp / 1000, cap, 0, false, gen, null, solarExtra);
    if (!M.meets(st, target)) continue;
    const pc = M.powerCost(pv, cap, 0, c);
    const bio = kind === "dg" && fuel === "biodiesel";
    const fuelYr = st.fuel / yrs * (bio ? M.P.gen.bioMult : 1), genHYr = st.genH / yrs;
    const runYr = fuelYr * R[kind === "dg" ? (bio ? "biodiesel" : "diesel") : "methanol"][c] + (kind === "dg" ? genHYr / g.serviceH * R.dgService[c] : 0);
    const life = pc.sum + buy + 10 * runYr;
    if (!best || life < best.life) best = { pv, cap, nT: 0, life, st,
      cost: { ...pc, gen: buy, sum: pc.sum + buy },
      gen: { kind, name: g.name, fuel: kind === "dg" ? (bio ? "biodiesel" : "diesel") : "methanol", units, W: gen.P, fuelYr, genHYr, runYr, genDays: st.genDays / yrs } };
  }
  if (best) best.stats = best.st;
  return { best, byT: {}, avgAll, avgNight, sims, kind };
};
M.optimiseBackup = function (days, L, c, target, solar, maxWp, fuel, solarExtra) {
  const a = M.optimiseGen(days, L, c, target, "dg", solar, maxWp, fuel, solarExtra), b = M.optimiseGen(days, L, c, target, "fc", solar, maxWp, undefined, solarExtra);
  if (!a.best) return b;
  if (!b.best) return a;
  return a.best.life <= b.best.life ? a : b;
};

export default M;
