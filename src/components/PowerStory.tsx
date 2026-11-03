"use client";

import { useMemo, useState } from "react";
import { Sun, Wind, BatteryCharging, Fuel, Waves } from "lucide-react";
import styles from "./planner.module.css";
import type { DayProfile, OptionResult, PlanResult } from "@/lib/types";
import { kwh, panelText } from "@/lib/format";
import { FUEL_NAME } from "@/lib/text";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const watts = (w: number) => (w >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${Math.round(w)} W`);
const clock = (h: number) => {
  const x = ((Math.round(h) % 24) + 24) % 24;
  return x === 0 ? "12 am" : x === 12 ? "12 pm" : x < 12 ? `${x} am` : `${x - 12} pm`;
};

// one average day, sunrise to sunrise, every 15 minutes: the sun follows a sine curve, a screen's brightness
// follows the daylight, lights run at full power till midnight and at half after; a generator runs after sunset
function dayCurve(p: DayProfile, usable: number, genW: number) {
  const N = p.dayLen, rise = 12 - N / 2, set = 12 + N / 2, dt = 0.25;
  const peak = N > 0.5 ? (p.pv * Math.PI) / (2 * N) : 0;
  const shapePeak = N > 0.5 ? (p.dayShape * Math.PI) / (2 * N) : 0;
  const flatW = N > 0.5 ? (p.dayUse - p.dayShape) / N : 0;
  let genLeft = p.gen, genOn = false;   // like the controller: start below 30%, stop when nearly full or the day's share is used
  const nightH = Math.max(0.01, 24 - N);
  const fixW = p.fixNight / nightH;
  const fullW = p.eveH + 0.5 * p.lateH > 0 ? p.nightLoad / (p.eveH + 0.5 * p.lateH) : 0;
  const windW = (p.wind + p.hydro) / 24;
  let soc = p.socDawn * usable;
  const pts: { t: number; solar: number; wind: number; gen: number; use: number; soc: number }[] = [];
  for (let t = rise; t <= rise + 24 + 1e-9; t += dt) {
    const c = ((t % 24) + 24) % 24;
    const light = c >= rise && c <= set;
    const solar = light && N > 0.5 ? peak * Math.sin((Math.PI * (c - rise)) / N) : 0;
    let use: number;
    if (light) use = flatW + (N > 0.5 ? shapePeak * Math.sin((Math.PI * (c - rise)) / N) : 0);
    else {
      const lit = c >= set + 0.2 || c <= rise - 0.2;
      use = fixW + (lit ? (c >= 12 ? fullW : 0.5 * fullW) : 0);
    }
    if (genW > 0 && genLeft > 0 && soc < 0.3 * usable) genOn = true;
    if (genOn && (soc >= 0.95 * usable || genLeft <= 0)) genOn = false;
    const gen = genOn ? Math.min(genW, genLeft / dt) : 0;
    genLeft -= gen * dt;
    pts.push({ t, solar, wind: windW, gen, use, soc: usable > 0 ? soc / usable : 0 });
    const net = solar + windW + gen - use;
    soc = Math.min(usable, Math.max(0, soc + (net > 0 ? net * 0.97 : net / 0.97) * dt));
  }
  return { pts, rise };
}

function DayChart({ p, usable, label, genW }: { p: DayProfile; usable: number; label: string; genW: number }) {
  const { pts, rise } = useMemo(() => dayCurve(p, usable, genW), [p, usable, genW]);
  const [hover, setHover] = useState<number | null>(null);
  const VW = 720, l = 52, r = 12, t1 = 10, h1 = 150, gap = 26, t2 = t1 + h1 + gap, h2 = 70, VH = t2 + h2 + 26;
  const maxW = Math.max(1, ...pts.map(q => Math.max(q.solar + q.wind + q.gen, q.use))) * 1.1;
  const x = (t: number) => l + ((t - rise) / 24) * (VW - l - r);
  const y1 = (w: number) => t1 + h1 - (w / maxW) * h1;
  const y2 = (s: number) => t2 + h2 - s * h2;
  const hasWind = p.wind + p.hydro > 1, steadyName = p.hydro > 1 ? "Stream" : "Wind", hasGen = p.gen > 1;
  const solarArea = `M${x(pts[0].t)},${y1(0)} ` + pts.map(q => `L${x(q.t).toFixed(1)},${y1(q.solar).toFixed(1)}`).join(" ") + ` L${x(pts[pts.length - 1].t)},${y1(0)} Z`;
  const windArea = hasWind ? `M${x(pts[0].t)},${y1(pts[0].solar)} ` + pts.map(q => `L${x(q.t).toFixed(1)},${y1(q.solar + q.wind).toFixed(1)}`).join(" ")
    + " " + [...pts].reverse().map(q => `L${x(q.t).toFixed(1)},${y1(q.solar).toFixed(1)}`).join(" ") + " Z" : "";
  const genArea = hasGen ? `M${x(pts[0].t)},${y1(pts[0].solar + pts[0].wind)} ` + pts.map(q => `L${x(q.t).toFixed(1)},${y1(q.solar + q.wind + q.gen).toFixed(1)}`).join(" ")
    + " " + [...pts].reverse().map(q => `L${x(q.t).toFixed(1)},${y1(q.solar + q.wind).toFixed(1)}`).join(" ") + " Z" : "";
  const useLine = pts.map(q => `${x(q.t).toFixed(1)},${y1(q.use).toFixed(1)}`).join(" ");
  const socLine = pts.map(q => `${x(q.t).toFixed(1)},${y2(q.soc).toFixed(1)}`).join(" ");
  const ticks: number[] = [];
  for (let c = Math.ceil(rise / 3) * 3; c <= rise + 24; c += 3) ticks.push(c);
  const hp = hover !== null ? pts[hover] : null;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - box.left) * VW) / box.width;
    const t = rise + ((px - l) / (VW - l - r)) * 24;
    setHover(Math.max(0, Math.min(pts.length - 1, Math.round((t - rise) / 0.25))));
  }

  return (
    <div className={styles.dayChart}>
      <p className={styles.dayInfo} aria-live="polite">
        {hp ? <><b>{clock(hp.t)}</b> · Solar {watts(hp.solar)}{hasWind ? ` · ${steadyName} ${watts(hp.wind)}` : ""}{hasGen ? ` · Generator ${watts(hp.gen)}` : ""} · Sign uses {watts(hp.use)} · Battery {Math.round(hp.soc * 100)}%</>
          : <>{label}. Move over the chart to read any hour.</>}
      </p>
      <svg viewBox={`0 0 ${VW} ${VH}`} className={styles.chart} role="img" aria-label={`Power and battery over one average day: ${label}`}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={l} x2={VW - r} y1={y1(maxW * f / 1.1)} y2={y1(maxW * f / 1.1)} className={styles.cGrid} />
            <text x={l - 6} y={y1(maxW * f / 1.1) + 4} textAnchor="end" className={styles.cAxis}>{watts(maxW * f / 1.1)}</text>
          </g>
        ))}
        <path d={solarArea} className={styles.dSolar} />
        {hasWind && <path d={windArea} className={styles.dWind} />}
        {hasGen && <path d={genArea} className={styles.dGen} />}
        <polyline points={useLine} className={styles.dUse} />
        <text x={l} y={t2 - 7} className={styles.cAxis}>Battery</text>
        {[0, 1].map(f => (
          <g key={f}>
            <line x1={l} x2={VW - r} y1={y2(f)} y2={y2(f)} className={styles.cGrid} />
            <text x={l - 6} y={y2(f) + 4} textAnchor="end" className={styles.cAxis}>{f * 100}%</text>
          </g>
        ))}
        <line x1={l} x2={VW - r} y1={y2(0.3)} y2={y2(0.3)} className={styles.cReserve} />
        <polyline points={socLine} className={styles.dSoc} />
        {ticks.map(c => (
          <g key={c}>
            <line x1={x(c)} x2={x(c)} y1={t1} y2={t2 + h2} className={styles.cGrid} />
            <text x={x(c)} y={VH - 6} textAnchor="middle" className={styles.cAxis}>{clock(c)}</text>
          </g>
        ))}
        {hp && (
          <>
            <line x1={x(hp.t)} x2={x(hp.t)} y1={t1} y2={t2 + h2} className={styles.cCross} />
            <circle cx={x(hp.t)} cy={y1(hp.use)} r={4} className={styles.dUseDot} />
            <circle cx={x(hp.t)} cy={y2(hp.soc)} r={4} className={styles.dSocDot} />
          </>
        )}
        <rect x={l} y={t1} width={VW - l - r} height={t2 + h2 - t1} fill="transparent" style={{ cursor: "crosshair" }}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      <p className={styles.legend}>
        {p.pv > 1 && <><span className={styles.swatch} data-k="solar" /> Solar power</>}
        {hasWind && <><span className={styles.swatch} data-k="wind" /> {steadyName} power</>}
        {hasGen && <><span className={styles.swatch} data-k="gen" /> Generator (average day)</>}
        <span className={styles.swatch} data-k="use" /> What the sign uses
        <span className={styles.swatch} data-k="soc" /> Battery level
      </p>
    </div>
  );
}

// sun / wind -> panels / turbine -> smart controller -> battery -> sign, with moving dashes where power flows
function Flow({ night, second, solar, labels }: { night: boolean; second: "wind" | "stream" | "gen" | null; solar: boolean; labels: Record<string, string> }) {
  const wind = second !== null, gen = second === "gen";
  // a generator runs after sunset, when the battery is short; wind and a stream run day and night
  const on = { sun: !night && solar, panel: !night && solar, wind: gen ? night : wind, turb: gen ? night : wind,
               charge: (!night && solar) || (gen ? night : wind), battery: night, direct: !night && solar };
  const link = (d: string, active: boolean, kind: "solar" | "wind" | "store") => (
    <path d={d} className={active ? styles[`fl_${kind}`] : styles.flOff} />
  );
  const box = (x: number, y: number, w: number, h: number, dim = false) => <rect x={x} y={y} width={w} height={h} rx="16" className={dim ? styles.fnDim : styles.fn} />;
  return (
    <svg viewBox="0 0 1000 330" className={styles.flow} role="img" aria-label={night ? "At night the battery runs the sign" : "In the day the sun charges the battery and runs the sign"}>
      {/* links */}
      {link("M95 75 L170 75", on.sun, "solar")}
      {link("M320 75 C 380 75, 380 165, 430 165", on.panel, "solar")}
      {link("M95 245 L170 245", on.wind, "wind")}
      {link("M320 245 C 380 245, 380 175, 430 175", on.turb, "wind")}
      {link("M590 170 L660 170", on.charge, (wind && night) || !solar ? "wind" : "solar")}
      {link("M815 170 L860 170", on.battery, "store")}
      {link("M560 135 C 620 40, 860 40, 905 130", on.direct, "solar")}

      {/* sun and wind */}
      {night || !solar ? (
        <g opacity={solar ? 1 : 0.35}><circle cx="60" cy="75" r="24" fill="#94a3b8" /><circle cx="71" cy="67" r="21" fill="#f0f9ff" /></g>
      ) : (
        <g>
          <circle cx="60" cy="75" r="26" fill="#fbbf24" />
          {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={60 + Math.cos(a) * 33} y1={75 + Math.sin(a) * 33} x2={60 + Math.cos(a) * 42} y2={75 + Math.sin(a) * 42} stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" />; })}
        </g>
      )}
      {second === "gen" ? (
        <g opacity={on.wind ? 1 : 0.35}><rect x="30" y="228" width="44" height="40" rx="5" fill="#64748b" /><rect x="38" y="220" width="12" height="9" fill="#475569" />
          <text x="52" y="254" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">FUEL</text></g>
      ) : second === "stream" ? (
        <g stroke="#0ea5e9" strokeWidth="5" fill="none" strokeLinecap="round">
          {[228, 246, 264].map(y => <path key={y} d={`M24 ${y} q11 -9 22 0 t22 0 t22 0`} />)}
        </g>
      ) : (
        <g opacity={wind ? 1 : 0.3} stroke="#0ea5e9" strokeWidth="5" fill="none" strokeLinecap="round">
          <path d="M28 230 h44 a10 10 0 1 0 -10 -10" /><path d="M28 248 h56 a10 10 0 1 1 -10 10" /><path d="M28 266 h34" />
        </g>
      )}

      {/* panels */}
      {box(170, 40, 150, 70, !on.panel)}
      <g transform="translate(190 52)" opacity={on.panel ? 1 : 0.4}>
        {[0, 1, 2].map(i => <rect key={i} x={i * 38} y="0" width="34" height="46" rx="3" fill="#0ea5e9" stroke="#7dd3fc" strokeWidth="2" />)}
      </g>
      {/* turbine */}
      {box(170, 210, 150, 70, !on.turb)}
      {second === "gen" ? (
        <g transform="translate(205 222)" opacity={on.turb ? 1 : 0.4}>
          <rect width="80" height="46" rx="6" fill="#334155" /><rect x="8" y="8" width="30" height="30" rx="15" fill="none" stroke="#94a3b8" strokeWidth="3" />
          <text x="60" y="29" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fbbf24">GEN</text>
        </g>
      ) : (
        <g transform="translate(245 245)" opacity={wind ? 1 : 0.35}>
          <rect x="-2" y="-2" width="4" height="34" fill="#64748b" />
          <ellipse cx="0" cy="-12" rx="22" ry="20" fill="none" stroke="#475569" strokeWidth="3" />
          <path d="M-20 -22 C 10 -14, -10 -2, 20 2" fill="none" stroke="#475569" strokeWidth="3" />
        </g>
      )}
      {/* controller */}
      {box(430, 130, 160, 80)}
      <g transform="translate(452 148)">
        <rect width="44" height="44" rx="8" fill="#0f172a" />
        {[8, 18, 28].map(v => <g key={v}><rect x={v} y="-6" width="4" height="6" fill="#64748b" /><rect x={v} y="44" width="4" height="6" fill="#64748b" /></g>)}
        <text x="22" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#38bdf8">ESP32</text>
      </g>
      <text x="508" y="166" className={styles.fTitle}>Smart</text>
      <text x="508" y="186" className={styles.fTitle}>controller</text>
      {/* battery */}
      {box(650, 130, 165, 80)}
      <g transform="translate(666 150)">
        <rect width="70" height="40" rx="6" fill="none" stroke="#16a34a" strokeWidth="4" />
        <rect x="70" y="12" width="7" height="16" rx="2" fill="#16a34a" />
        <rect x="5" y="5" width={night ? 34 : 60} height="30" rx="3" fill="#16a34a" opacity="0.85" />
      </g>
      <text x="752" y="176" className={styles.fTitle}>Battery</text>
      {/* sign */}
      <g transform="translate(860 130)">
        <rect width="110" height="62" rx="6" fill={night ? "#0f172a" : "#ffc400"} stroke="#334155" strokeWidth="5" />
        <text x="55" y="38" textAnchor="middle" fontSize="18" fontWeight="700" fill={night ? "#ffb000" : "#b91c1c"} style={{ fontFamily: "var(--font-display)" }}>AD</text>
        <rect x="25" y="62" width="6" height="34" fill="#64748b" /><rect x="79" y="62" width="6" height="34" fill="#64748b" />
        {night && <rect width="110" height="62" rx="6" fill="#ffb000" opacity="0.12" />}
      </g>

      {/* labels */}
      <text x="245" y="132" textAnchor="middle" className={styles.fLabel}>{labels.panel}</text>
      <text x="245" y="302" textAnchor="middle" className={styles.fLabel}>{labels.turbine}</text>
      <text x="510" y="235" textAnchor="middle" className={styles.fLabel}>{labels.controller}</text>
      <text x="732" y="235" textAnchor="middle" className={styles.fLabel}>{labels.battery}</text>
      <text x="915" y="250" textAnchor="middle" className={styles.fLabel}>{labels.sign}</text>
      <text x="735" y="34" textAnchor="middle" className={styles.fLabel}>{night || !solar ? "" : "Daytime: solar runs the sign directly"}</text>
    </svg>
  );
}

export default function PowerStory({ result, option, night }: { result: PlanResult; option: OptionResult; night: boolean }) {
  const [which, setWhich] = useState<"good" | "bad">("bad");
  if (option.fail || !option.cases || !option.profiles) return null;
  const { place, inputs } = result;
  const c1 = option.cases[1];
  const { good, bad, usable } = option.profiles;
  const nights = (usable / Math.max(1, c1.avgNight)).toFixed(1);
  const lat = place.lat;
  const why = bad.month >= 6 && bad.month <= 9 && lat > 5 && lat < 30 ? "monsoon clouds"
    : Math.abs(lat) >= 35 ? "short winter days and a low sun" : "clouds and shorter days";
  const wBest = result.windMonthly.reduce((b, v, i, a) => (v > a[b] ? i : b), 0);
  const panels = panelText(c1.pv), solar = c1.pv.Wp > 0;
  const g = c1.gen, second: "wind" | "stream" | "gen" | null = g ? "gen" : c1.hydroW > 0 ? "stream" : c1.nT > 0 ? "wind" : null;
  const genRunW = g ? Math.min(g.W, 0.5 * c1.cap + c1.avgNight / 12) : 0;

  let windText: string;
  if (c1.nT > 0) windText = `${c1.nT} small turbine${c1.nT > 1 ? "s" : ""} on a mast. Wind is strongest in ${MONTH_NAMES[wBest]}: about ${kwh(result.windMonthly[wBest] * c1.nT)} kWh a day, often when the sun is weak. It also works at night. Above 65 km/h the controller brakes it, so storms cannot break it.`;
  else if (inputs.site === "city") windText = `No turbine here. Buildings slow the wind: one turbine would make only about ${kwh(result.windMonthly[wBest])} kWh a day, even in ${MONTH_NAMES[wBest]}, its best month.`;
  else windText = `No turbine. One would make about ${kwh(result.windMonthly[wBest])} kWh a day in ${MONTH_NAMES[wBest]}, but for this sign a little more solar is cheaper. On a foggy, windy hill road it can win.`;
  if (g) windText = `${g.units > 1 ? `${g.units} × ` : ""}${g.name}. It starts by itself when the battery is short, mostly after sunset, and runs about ${Math.round(g.genHYr).toLocaleString("en-IN")} hours a year on ${FUEL_NAME[g.fuel]} (about ${Math.round(g.fuelYr).toLocaleString("en-IN")} litres). ${g.kind === "dg" ? "It needs an oil change every 250 hours, a locked fuel tank and a silent canopy." : "It is silent and needs almost no service, but it is small."}`;
  else if (c1.hydroW > 0) windText = `A small turbine in a stream: about ${c1.hydroW} W, day and night, ${inputs.hydro?.season === "all" ? "all year" : "from June to October"}. Water from higher up comes down a pipe and spins it. Because it also works at night, the battery can be smaller.`;

  const labels = {
    panel: !solar ? "No solar panels" : `${panels}: ${kwh(good.pv)} kWh in ${MONTH_NAMES[good.month - 1].slice(0, 3)}, ${kwh(bad.pv)} in ${MONTH_NAMES[bad.month - 1].slice(0, 3)}`,
    turbine: g ? `${g.name.split(" (")[0]}: ~${Math.round(g.genHYr)} h a year` : c1.hydroW > 0 ? `Stream turbine: ${c1.hydroW} W all day`
      : c1.nT > 0 ? `${c1.nT} turbine: ${kwh(result.windMonthly[wBest] * c1.nT)} kWh/day in ${MONTH_NAMES[wBest].slice(0, 3)}` : "No turbine: not worth it here",
    controller: night ? "Checks the battery, dims if low" : "Sends power where it is needed",
    battery: `${kwh(c1.cap)} kWh · ${nights} nights`,
    sign: `Uses about ${kwh(c1.avgAll)} kWh a day`,
  };
  const prof = which === "good" ? good : bad;

  return (
    <div className={styles.power}>
      <div className={styles.lookBar}>
        <h3>How {g ? (solar ? "solar and a generator power" : "a generator powers") : c1.hydroW > 0 ? "solar and a stream power" : c1.nT > 0 ? "solar and wind power" : "solar powers"} it</h3>
        <span className={styles.small}>{night ? "At night: the battery runs the sign." : solar ? "In the day: the sun runs the sign and fills the battery." : "The generator fills the battery; the battery runs the sign."} Use the Day / Night switch above.</span>
      </div>
      <div className={styles.flowBox}><Flow night={night} second={second} solar={solar} labels={labels} /></div>

      <div className={styles.explain}>
        <div>
          <span className={styles.explainIcon} data-k="solar"><Sun size={20} aria-hidden /></span>
          <h4>Solar</h4>
          <p>{!solar ? "No solar panels in this choice: all the energy comes from the generator, through the battery. " : <>{panels}, facing {lat >= 0 ? "south" : "north"} and tilted {place.tilt}°.</>}{solar && <> On an average {MONTH_NAMES[good.month - 1]} day they make about {kwh(good.pv)} kWh; in {MONTH_NAMES[bad.month - 1]} only about {kwh(bad.pv)} kWh, because of {why}. We size the panels for that worst month, so the sign stays lit all year.</>}</p>
        </div>
        <div>
          <span className={styles.explainIcon} data-k="wind">{g ? <Fuel size={20} aria-hidden /> : c1.hydroW > 0 ? <Waves size={20} aria-hidden /> : <Wind size={20} aria-hidden />}</span>
          <h4>{g ? (g.kind === "fc" ? "Fuel cell" : "Generator") : c1.hydroW > 0 ? "Stream" : "Wind"}</h4>
          <p>{windText}</p>
        </div>
        <div>
          <span className={styles.explainIcon} data-k="store"><BatteryCharging size={20} aria-hidden /></span>
          <h4>Battery and smart controller</h4>
          <p>{solar ? "In the day the controller sends solar power to the sign and fills the battery. After sunset the battery takes over." : "The controller starts the generator when the battery drops below 30% and stops it when the battery is nearly full, so the generator always runs at a good load."} Every evening the controller checks the battery; if it is low it dims the sign a little, so it never goes dark. This battery ({kwh(c1.cap)} kWh) can run the sign for about {nights} nights with no sun.</p>
        </div>
      </div>

      <div className={styles.lookBar}>
        <h3>A day with this sign</h3>
        <div className={styles.toggle} role="group" aria-label="Which month">
          <button type="button" aria-pressed={which === "good"} onClick={() => setWhich("good")}>{solar ? "Sunniest" : "Easiest"} month ({MONTH_NAMES[good.month - 1].slice(0, 3)})</button>
          <button type="button" aria-pressed={which === "bad"} onClick={() => setWhich("bad")}>{solar ? "Darkest" : "Hardest"} month ({MONTH_NAMES[bad.month - 1].slice(0, 3)})</button>
        </div>
      </div>
      <DayChart p={prof} usable={usable} genW={genRunW} label={`An average ${MONTH_NAMES[prof.month - 1]} day in ${place.name}, from sunrise to the next sunrise`} />
    </div>
  );
}
