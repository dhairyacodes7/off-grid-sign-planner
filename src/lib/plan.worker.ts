// Runs the 10-year simulation away from the page, so typing and sliders never freeze.
// The model is untyped JavaScript, so its results are read as `any` here and shaped into typed results below.
/* eslint-disable @typescript-eslint/no-explicit-any */
import M from "./model";
import PL from "./planner";
import PA from "./parts";
import type { Inputs, PlaceData, PlanResult, OptionResult, CaseResult, DayProfile, CompareRow } from "./types";

let builtIn: PlaceData[] | null = null;
const custom = new Map<string, PlaceData>();
const prepared = new Map<string, unknown>();

async function places(): Promise<PlaceData[]> {
  if (!builtIn) builtIn = await (await fetch("/data/world_daily.json")).json();
  return builtIn!;
}

async function findPlace(key: string): Promise<PlaceData> {
  if (custom.has(key)) return custom.get(key)!;
  const all = await places();
  return all.find(p => p.key === key) || all[0];
}

function caseSummary(c: any): CaseResult {
  const b = c.b, s = b.stats, pc = b.cost;
  const solo = c.o.byT[0], wind = c.o.byT[1] || c.o.byT[2];
  return {
    avgAll: c.o.avgAll, avgNight: c.o.avgNight, pv: b.pv, cap: b.cap, nT: b.nT,
    V: M.batteryV(b.cap), amps: pc.amps, invW: c.L.invW,
    stats: { N: s.N, normal: s.normal, save: s.save, survival: s.survival, dark: s.dark, dimDays: s.dimDays,
             heatDays: s.heatDays, spilled: s.spilled, gen: s.gen },
    cost: { display: c.display, panels: pc.panels, frame: pc.frame, battery: pc.battery, box: pc.box,
            controller: pc.controller, turbine: pc.turbine, inverter: c.inverter, fit: c.fit,
            structure: c.structure, gst: c.gst, total: c.total, video: c.video, gen: c.gen, stream: c.stream, back: c.backCost || 0 },
    kit: c.vk ? { esp: c.vk.esp, px: c.vk.px, cards: c.vk.cards, W: c.vk.W, cost: c.vk.cost } : null,
    gen: b.gen ? { kind: b.gen.kind, name: b.gen.name, fuel: b.gen.fuel, units: b.gen.units, W: b.gen.W,
                   fuelYr: b.gen.fuelYr, genHYr: b.gen.genHYr, runYr: b.gen.runYr, genDays: b.gen.genDays } : null,
    hydroW: c.hydroW || 0, run: c.run || 0, back: c.back || null,
    perChange: c.perChange, times: c.times, yearly: c.yearly,
    solo: solo ? { cost: solo.cost.sum, pv: solo.pv, cap: solo.cap } : null,
    withWind: wind ? { cost: wind.cost.sum } : null,
  };
}

// average day of month m for the chosen kit
function monthDay(days: any, L: any, b: any, soc: Float32Array, m: number, extra: Float64Array | null, genRec: Float32Array | null, back: Float64Array | null): DayProfile {
  const a = { pv: 0, wind: 0, windEach: 0, hydro: 0, gen: 0, dayUse: 0, dayShape: 0, nightLoad: 0, fixNight: 0, dayLen: 0, eveH: 0, lateH: 0, socDawn: 0 };
  let n = 0;
  for (let i = 0; i < days.n; i++) {
    if (days.month[i] !== m) continue;
    n++;
    a.pv += days.pv[i] * b.pv.Wp / 1000 + (back ? back[i] : 0); a.windEach += days.wind[i]; a.wind += b.nT * days.wind[i];
    a.hydro += extra ? extra[i] : 0; a.gen += genRec ? genRec[i] : 0;
    a.dayUse += L.day[i] + L.fixDay[i]; a.dayShape += L.dayShape[i]; a.nightLoad += L.night[i]; a.fixNight += L.fixNight[i];
    a.dayLen += days.dayLen[i]; a.eveH += days.eveH[i]; a.lateH += days.lateH[i];
    a.socDawn += i > 0 ? soc[i - 1] : 1;   // battery after the night before = level at sunrise
  }
  const avg = (x: number) => (n ? x / n : 0);
  return { month: m, pv: avg(a.pv), wind: avg(a.wind), windEach: avg(a.windEach), hydro: avg(a.hydro), gen: avg(a.gen), dayUse: avg(a.dayUse), dayShape: avg(a.dayShape),
           nightUse: avg(a.nightLoad + a.fixNight), nightLoad: avg(a.nightLoad), fixNight: avg(a.fixNight),
           dayLen: avg(a.dayLen), eveH: avg(a.eveH), lateH: avg(a.lateH), socDawn: avg(a.socDawn) };
}

async function plan(inp: Inputs): Promise<PlanResult> {
  const place = await findPlace(inp.place);
  const pkey = place.key + "|" + inp.site;
  if (!prepared.has(pkey)) prepared.set(pkey, M.prepare(place, inp.site));
  const days: any = prepared.get(pkey);
  const F = M.faces(inp.w, inp.h, inp.zone, M.pitchFor(inp.view));
  const res = PL.IDS.map((id: string) => PL.sizeOption(id, inp, F, days));
  const best = PL.pickBest(res);

  const options: OptionResult[] = res.map((r: any) => {
    if (r.fail) return { id: r.id, fail: true, need: r.need, fit: "over", total: null, ten: null, cases: null,
                         windLoad: null, chem: [], monthly: [], soc: null, mode: null, profiles: null, ledType: r.ledType, alt: null, why: r.why || null, parts: [], light: r.light, lightAlt: null };
    const c1 = r.c[1], b1 = c1.b;
    const { run, extra, back } = PL.record(inp, days, c1);
    const monthly = PL.monthly(days, c1.L, b1, extra, run.genRec, back);
    // best and worst month: by energy made, or with no panels at all, by energy used
    const months = monthly.map((x: any, k: number) => [k + 1, b1.pv.Wp > 0 ? x.pv : -x.use] as [number, number]);
    const goodM = months.reduce((p: [number, number], q: [number, number]) => (q[1] > p[1] ? q : p))[0];
    const badM = months.reduce((p: [number, number], q: [number, number]) => (q[1] < p[1] ? q : p))[0];
    return {
      id: r.id, fail: false, need: r.need, fit: r.fit, total: r.total, ten: r.ten,
      cases: [caseSummary(r.c[0]), caseSummary(c1)],
      windLoad: PL.windLoad(F, b1.pv),
      chem: PL.chemistry(b1.cap, 1).map((x: any) => ({ k: x.k, name: x.b.name, nominal: x.nominal, upfront: x.upfront,
        ten: x.ten, kg: x.kg, life: x.b.life, heat: x.b.heat, india: x.b.india })),
      monthly, ledType: r.ledType, alt: r.alt || null, why: null, parts: PA.list(r.id, inp, F, r),
      light: r.light, lightAlt: r.lightAlt ? { light: r.lightAlt.light, total: r.lightAlt.total, ten: r.lightAlt.ten, avgAll: r.lightAlt.avgAll, cap: r.lightAlt.cap } : null,
      soc: run.soc, mode: run.mode,
      profiles: { good: monthDay(days, c1.L, b1, run.soc, goodM, extra, run.genRec, back), bad: monthDay(days, c1.L, b1, run.soc, badM, extra, run.genRec, back),
                  usable: b1.cap * M.P.bat.dod * M.P.bat.eol },
    };
  });

  let july = 0, n = 0;
  for (let i = 0; i < days.n; i++) if (days.month[i] === 7) { july += days.wind[i]; n++; }
  const wm = Array.from({ length: 12 }, () => [0, 0]);
  for (let i = 0; i < days.n; i++) { wm[days.month[i] - 1][0] += days.wind[i]; wm[days.month[i] - 1][1]++; }
  return {
    inputs: inp,
    place: { key: place.key, name: place.name, lat: place.lat, lon: place.lon, tilt: days.tilt, days: days.n },
    faces: F, bestId: best.id, options, passive: PA.passive(F, F.h < 1.5 ? 2.2 : 3.0), julyWind: n ? july / n : 0, windMonthly: wm.map(([s, k]) => (k ? s / k : 0)),
    year: days.year, month: days.month, dom: days.dom, sun: Float32Array.from(place.H),
  };
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === "place") {
    custom.set(msg.place.key, msg.place);
    for (const k of [...prepared.keys()]) if (k.startsWith(msg.place.key + "|")) prepared.delete(k);
    return;
  }
  if (msg.type === "compare") {
    try {
      const inp: Inputs = msg.inputs, place = await findPlace(inp.place), pkey = place.key + "|" + inp.site;
      if (!prepared.has(pkey)) prepared.set(pkey, M.prepare(place, inp.site));
      const F = M.faces(inp.w, inp.h, inp.zone, M.pitchFor(inp.view));
      const rows: CompareRow[] = PL.compare(msg.option, inp, F, prepared.get(pkey));
      (self as unknown as Worker).postMessage({ id: msg.id, compare: rows });
    } catch (err) {
      (self as unknown as Worker).postMessage({ id: msg.id, error: String(err) });
    }
    return;
  }
  if (msg.type === "plan") {
    try {
      const result = await plan(msg.inputs);
      (self as unknown as Worker).postMessage({ id: msg.id, result });
    } catch (err) {
      (self as unknown as Worker).postMessage({ id: msg.id, error: String(err) });
    }
  }
};
