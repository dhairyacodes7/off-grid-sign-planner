// @ts-nocheck
// Planner layer (prices, GST, best pick), copied from ../Sign_Planner/model/planner.js.
/* eslint-disable */
// Planner layer: turns the physics model into products, prices (with GST) and a best pick.
// Runs in the page and in Node (test_planner.js). Needs model.js loaded first.
import M from "./model";
const PL: any = {};

PL.IDS = ["print", "zone", "led", "wall", "lcd", "epaper"];
PL.LIGHT = { front: "Front-lit (floodlights)", back: "Backlit lightbox" };
PL.CHANGES = { rare: 2, month: 12, week: 52, rotate: 365 };
PL.SQFT_M2 = 0.092903;

// IS 875 (Part 3): Pune basic wind speed 39 m/s; k1 = k3 = k4 = 1, terrain category 2 at 10 m (k2 = 1.0)
PL.WIND_LOAD = { Vb: 39, k2: 1.0, cfBoard: 1.3, cfPanel: 1.2 };

// other batteries, compared at the same usable energy as the LiFePO4 we pick
PL.CHEM = {
  lfp:   { name: "LiFePO4 (lithium iron phosphate)", usable: 0.9 * 0.8, price: [11, 18], sets: [1, 1], kg: [8, 11], life: "about 10 years", heat: "OK in a shaded, vented box", india: "Easy to buy" },
  lead:  { name: "Lead-acid tubular", usable: 0.5 * 0.8, price: [6, 9], sets: [2, 4], kg: [30, 36], life: "3–5 years in Pune heat", heat: "Life drops fast in heat", india: "Easy to buy" },
  naion: { name: "Sodium-ion", usable: 0.9 * 0.8, price: [15, 30], sets: [1, 2], kg: [10, 15], life: "5–10 years (claimed)", heat: "Good in heat and cold (claimed)", india: "Few sellers, price not confirmed" },
};

PL.VIEW = 20;   // default: closest people about 20 m away
// dots show when people stand closer than about 1 m per mm of dot gap
PL.dotty = (inp, pitch) => (inp.view ?? PL.VIEW) * M.P.view.mmPerM < pitch - 1e-9;
PL.needFit = function (id, inp, F) {
  const c = inp.change, day = inp.digital === "daynight";
  const dots = p => PL.dotty(inp, p);
  if (id === "print") return c === "rotate" ? [0, "Cannot rotate ads"] : c === "week" ? [1, "Reprint every week"] : [2, "Does the job"];
  if (id === "zone") return c === "rotate" ? [1, "Only the zone rotates"] : (!day && c !== "rare") ? [1, "Zone is dark in the day"]
    : dots(F.pitch) ? [1, "Dots show this close"] : [2, "Does the job"];
  if (id === "led") return !day ? [1, "Blank in the day"] : dots(F.pitch) ? [1, "Dots show this close"] : [2, "Does the job"];
  if (id === "wall") return !day ? [1, "Blank in the day"] : dots(3.91) ? [1, "Dots show this close"] : [2, "Does the job, full video"];
  if (id === "lcd") return !day ? [1, "Blank in the day"] : F.lcdN > 4 ? [1, "Thick lines between screens"] : [2, "Does the job, full video"];
  return F.m2 > 2 ? [0, "Too big for e-paper"] : [2, "Does the job"];
};

PL.displayCost = function (id, F, L, c, inp) {
  const R = M.PRICE;
  const flex = sqft => sqft * R.flex[c];
  const flood = W => Math.max(W * R.floodPerW[c], R.floodMin[c]);
  const saver = inp && inp.ledType === "saver" ? R.saverPrice[c] : 1;
  const leds = n => n * (R.mods[F.pitch] || R.mods[10])[c] * saver * R.ledExtra[c];
  const back = inp && inp.printLight === "back";
  const printed = sqft => back ? sqft * R.lightbox[c] : flex(sqft) + flood(L.floodW);   // a lightbox includes its print and LEDs
  if (id === "print") return printed(F.sqft);
  if (id === "zone") return printed(F.printedM2 / PL.SQFT_M2) + leds(F.zone);
  if (id === "led") return leds(F.led);
  if (id === "wall") return F.wallM2 / PL.SQFT_M2 * R.wallSqft[c] * R.wallExtra[c];
  if (id === "lcd") return F.lcdN * R.lcd[c] * R.lcdMount[c];
  return F.m2 * R.epaperM2[c] * R.epaperBox[c] + flood(L.floodW);
};

PL.windChoices = inp => (inp.site === "city" || inp.power === "solar" ? [0] : inp.power === "wind" ? [1, 2] : [0, 1, 2]);
PL.BACKUP = { backup: true, fuel: false };   // power choices with a generator or fuel cell: with / without solar
// most solar that sits on a tilted frame on top of the board (2 rows, no more panel area than board area)
PL.boardMaxWp = function (F) {
  const perRow = Math.max(1, Math.floor((F.w + 0.5) / 1.16));
  const big = Math.min(2 * perRow, Math.floor(F.m2 / 2.58)) * 540;
  return Math.max(big, Math.min(400, Math.floor(F.m2 * 200 / 50) * 50));
};
// panels standing on the back of a one-sided board (only worth it if the back faces the sun)
PL.backPv = function (F) {
  const n = Math.floor(F.m2 / 2.58);
  return n >= 1 ? { Wp: n * 540, n, big: true } : { Wp: Math.min(400, Math.floor(F.m2 * 200 / 50) * 50), n: 1, big: false };
};
PL.backDays = function (days, W) {
  const a = new Float64Array(days.n);
  for (let i = 0; i < days.n; i++) a[i] = days.pvV[i] * W / 1000;
  return a;
};

// LED faces: try energy-saving and standard modules and keep the cheaper (unless the user chose one)
PL.sizeOption = function (id, inp, F, days) {
  const mid = r => (r.fail ? Infinity : (r.ten || r.total)[0] + (r.ten || r.total)[1]);
  // panels on the back of the board are allowed, not forced: keep them only if they make the sign cheaper
  const one = i => {
    if (!i.back) return PL.sizeOne(id, i, F, days);
    const a = PL.sizeOne(id, i, F, days), b = PL.sizeOne(id, { ...i, back: false }, F, days);
    const r = mid(b) <= mid(a) ? b : a;
    if (a.fail && b.fail) r.why = a.why || b.why;
    return r;
  };
  const lights = i => {
    if (!(id === "print" || id === "zone") || (i.printLight && i.printLight !== "auto")) return one(i);
    const a = one({ ...i, printLight: "front" }), b = one({ ...i, printLight: "back" });
    const [win, other] = mid(a) <= mid(b) ? [a, b] : [b, a];
    if (a.fail && b.fail) win.why = a.why || b.why;
    win.lightAlt = other.fail ? null : { light: other.light, total: other.total, ten: other.ten, avgAll: other.c[1].o.avgAll, cap: other.c[1].b.cap, pv: other.c[1].b.pv };
    return win;
  };
  if ((id === "zone" || id === "led") && (inp.ledType || "auto") === "auto") {
    const a = lights({ ...inp, ledType: "saver" }), b = lights({ ...inp, ledType: "standard" });
    const [win, other] = mid(a) <= mid(b) ? [a, b] : [b, a];
    if (a.fail && b.fail) win.why = a.why || b.why;
    win.alt = other.fail ? null : { ledType: other.ledType, total: other.total, ten: other.ten,
      cap: other.c.map(x => x.b.cap), pv: other.c.map(x => x.b.pv) };
    return win;
  }
  return lights(inp);
};

PL.sizeOne = function (id, inp, F, days) {
  const R = M.PRICE, target = M.TARGETS[inp.target], wc = PL.windChoices(inp);
  const out = { id, F, need: PL.needFit(id, inp, F), c: [], ledType: id === "zone" || id === "led" ? inp.ledType || "standard" : null,
                light: id === "print" || id === "zone" ? (inp.printLight === "back" ? "back" : "front") : null };
  const backup = inp.power in PL.BACKUP;
  for (const c of [0, 1]) {
    const L = M.loads(id, F, inp, days, c);
    const hydro = inp.power === "hydro" ? M.hydroDays(days, inp.hydro) : null;
    if (inp.power === "hydro" && !hydro) { out.c.push({ L, fail: true }); continue; }
    // space: "board" = panels only on the sign's own frame (no extra land); back = also on the back of the board
    const maxWp = inp.space === "board" || backup ? PL.boardMaxWp(F) : undefined;
    const bp = inp.back && inp.power !== "fuel" ? PL.backPv(F) : null, back = bp ? PL.backDays(days, bp.Wp) : null;
    const o = backup ? M.optimiseBackup(days, L, c, target, PL.BACKUP[inp.power], maxWp, inp.fuel, back)
                     : M.optimise(days, L, c, target, inp.power === "hydro" ? [0] : wc, hydro, maxWp, back);
    if (!o.best) {
      // say why: would it work with land for more panels?
      if (maxWp !== undefined && !backup && c === 1 && M.optimise(days, L, c, target, inp.power === "hydro" ? [0] : wc, hydro, undefined, back).best) out.why = "space";
      out.c.push({ L, o, fail: true }); continue;
    }
    const b = o.best, pc = b.cost;
    const display = PL.displayCost(id, F, L, c, inp);
    const inverter = L.invW * R.inverter[c];
    const vk = M.videoKit(id, F, c), video = vk ? vk.cost : 0, gen = pc.gen || 0, stream = hydro ? R.hydro[c] : 0;
    // panels on the back: same panel price (5% GST) and a frame (18% GST)
    const backPanels = bp ? bp.Wp * (bp.big ? R.pvBig[c] : R.pvSmall[c]) : 0, backFrame = bp ? bp.Wp * R.frame[c] : 0;
    const other = display + inverter + video + gen + stream + backFrame + pc.frame + pc.battery + pc.box + pc.controller + pc.turbine;
    const fit = (other + pc.panels + backPanels) * R.fit[c];
    const structure = inp.structure === "new" ? F.sqft * R.structure[c] : 0;
    const gst = (pc.panels + backPanels) * R.gstPv + (other + fit + structure) * R.gst;
    const total = pc.panels + backPanels + other + fit + structure + gst;
    const perChange = (id === "print" ? F.sqft : id === "zone" ? F.printedM2 / PL.SQFT_M2 : 0) * R.flex[c] * (inp.printLight === "back" ? R.backlitFlex : 1) * (1 + R.gst);
    const times = id === "print" ? (inp.change === "rotate" ? null : PL.CHANGES[inp.change]) : id === "zone" ? Math.min(2, PL.CHANGES[inp.change]) : 0;
    const run = b.gen ? b.gen.runYr : 0;   // fuel + generator service each year
    const yearly = times === null ? null : perChange * times + R.maint[c] + run;
    out.c.push({ L, o, b, display, inverter, video, vk, gen, stream, back: bp, backCost: backPanels + backFrame, hydroW: hydro ? M.hydroW(inp.hydro) : 0, run, fit, structure, gst, total, perChange, times, yearly,
                 ten: yearly === null ? null : total + 10 * yearly });
  }
  out.fail = out.c.some(x => x.fail);
  if (!out.fail) {
    out.total = out.c.map(x => x.total);
    out.ten = out.c[0].ten === null ? null : out.c.map(x => x.ten);
    out.fit = out.total[1] <= inp.budget ? "fits" : out.total[0] <= inp.budget ? "tight" : "over";
  } else out.fit = "over";
  return out;
};

// the same sign with each power choice, for the comparison table
PL.POWERS = ["solar", "wind", "hydro", "backup", "fuel"];
PL.compare = function (id, inp, F, days) {
  return PL.POWERS.filter(p => !(p === "wind" && inp.site === "city") && !(p === "hydro" && !M.hydroW(inp.hydro))).map(power => {
    const r = PL.sizeOption(id, { ...inp, power }, F, days);
    if (r.fail) return { power, fail: true, why: r.why || null };
    const g = r.c.map(x => x.b.gen);
    return { power, fail: false, total: r.total, ten: r.ten, cap: r.c.map(x => x.b.cap), pv: r.c.map(x => x.b.pv), nT: r.c.map(x => x.b.nT),
             hydroW: r.c[0].hydroW || 0, back: r.c[1].back,
             gen: g[0] ? { name: g[1].name, kind: g[1].kind, fuel: g[1].fuel, units: [g[0].units, g[1].units], fuelYr: g.map(x => x.fuelYr),
                           genHYr: g.map(x => x.genHYr), runYr: g.map(x => x.runYr) } : null,
             dark: r.c[1].b.stats.dark, dim: r.c[1].b.stats.save + r.c[1].b.stats.survival };
  });
};

PL.pickBest = function (res) {
  const mid = a => (a[0] + a[1]) / 2;
  const cand = res.filter(r => !r.fail && r.need[0] > 0);
  const tier = r => (r.fit === "over" ? 0 : 1);
  cand.sort((a, b) => (tier(b) - tier(a)) || (b.need[0] - a.need[0]) || (mid(a.ten || a.total) - mid(b.ten || b.total)));
  return cand[0] || res.find(r => !r.fail) || res[0];
};

// wind force on the board and on the panel field (IS 875-3, simple static check)
PL.windLoad = function (F, pv) {
  const w = PL.WIND_LOAD, Vz = w.Vb * w.k2, pz = 0.6 * Vz * Vz;     // N/m2
  const panelM2 = pv.big ? pv.n * 2.58 : pv.Wp / 209;
  return { pz, board: w.cfBoard * F.m2 * pz / 1000, panels: w.cfPanel * panelM2 * pz / 1000, panelM2 };
};

PL.chemistry = function (capWh, c) {
  const U = capWh * PL.CHEM.lfp.usable;
  return Object.entries(PL.CHEM).map(([k, b]) => {
    const nominal = U / b.usable, upfront = nominal * b.price[c] * (1 + M.PRICE.gst);
    return { k, b, nominal, upfront, ten: upfront * b.sets[c], kg: nominal / 1000 * b.kg[c] };
  });
};

// per-month averages (PV made vs sign use) for the table view of the chart
// extra: stream Wh per day (or null); genRec: generator Wh per day from a recorded simulation (or null)
PL.monthly = function (days, L, b, extra, genRec, back) {
  const sum = Array.from({ length: 12 }, () => ({ pv: 0, use: 0, gen: 0, n: 0, sun: 0 }));
  for (let i = 0; i < days.n; i++) {
    const m = days.month[i] - 1, s = sum[m];
    s.pv += days.pv[i] * b.pv.Wp / 1000 + b.nT * days.wind[i] + (extra ? extra[i] : 0) + (back ? back[i] : 0);
    s.gen += genRec ? genRec[i] : 0;
    s.use += L.day[i] + L.night[i] + L.fixDay[i] + L.fixNight[i];
    s.n++;
  }
  return sum.map(s => ({ pv: s.pv / s.n, use: s.use / s.n, gen: s.gen / s.n }));
};
// re-run the chosen kit day by day, keeping the battery level, the mode and the generator output
PL.record = function (inp, days, cs) {
  const b = cs.b, extra = inp.power === "hydro" ? M.hydroDays(days, inp.hydro) : null;
  const gen = b.gen ? M.genUnit(b.gen.kind, b.gen.units, 1) : null;
  const back = cs.back ? PL.backDays(days, cs.back.Wp) : null;
  return { run: M.simulate(days, cs.L, b.pv.Wp / 1000, b.cap, b.nT, true, gen, extra, back), extra, back };
};

export default PL;
