"use client";

import { Fragment, useEffect, useState } from "react";
import { AlertTriangle, Info, Sun, Moon } from "lucide-react";
import styles from "./planner.module.css";
import type { CompareRow, Inputs, OptionId, OptionResult, PlanResult } from "@/lib/types";
import { MONTHS, kwh, kwhRange, panelRange, panelText, range, rupeeRange, rupees } from "@/lib/format";
import { FUEL_NAME, OPTIONS, POWER, dotsLine, sharpFrom } from "@/lib/text";
import SignDrawing, { faceSize } from "./SignDrawing";
import BatteryChart from "./BatteryChart";
import SignPreview, { ADS, type AdKey } from "./SignPreview";
import PowerStory from "./PowerStory";
import { placement } from "@/lib/space";

const TABS = ["What you buy", "Parts list", "Power choices", "Reflective & glow", "Bad weather", "Cost", "Battery types", "Month by month"] as const;
const cd = (a: number[], dp = 0) => range(a, x => x.toFixed(dp));
const lakhs = (a: number[]) => range(a, x => Math.round(x).toLocaleString("en-IN"));

function Note({ warn, children }: { warn?: boolean; children: React.ReactNode }) {
  return (
    <p className={styles.note} data-tone={warn ? "warn" : undefined}>
      {warn ? <AlertTriangle size={18} aria-hidden /> : <Info size={18} aria-hidden />}
      <span>{children}</span>
    </p>
  );
}

export default function OptionDetail({ result, option, ad, onAd, onCompare }: {
  result: PlanResult; option: OptionResult; ad: AdKey; onAd: (a: AdKey) => void;
  onCompare: (option: OptionId, inp: Inputs) => Promise<CompareRow[]>;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("What you buy");
  const [night, setNight] = useState(false);
  const [cmp, setCmp] = useState<{ key: string; rows: CompareRow[] } | null>(null);
  const cmpKey = option.id + JSON.stringify(result.inputs);
  // the comparison runs every power choice, so it is only worked out when its tab is open
  useEffect(() => {
    if (tab !== "Power choices" || cmp?.key === cmpKey) return;
    let live = true;
    onCompare(option.id, result.inputs).then(rows => { if (live) setCmp({ key: cmpKey, rows }); });
    return () => { live = false; };
  }, [tab, cmpKey, cmp?.key, onCompare, option.id, result.inputs]);
  if (option.fail || !option.cases || !option.total) return null;
  const { faces: F, place, inputs } = result;
  const [c0, c1] = option.cases;
  const st = c1.stats, yrs = st.N / 365.25;
  const wl = option.windLoad!;
  const [fw, fh] = faceSize(option.id, F);
  const spill = st.gen > 0 ? st.spilled / st.gen : 0;
  const lfp = option.chem[0], lead = option.chem[1];
  const nights = ((c1.cap * 0.72) / Math.max(1, c1.avgNight)).toFixed(1);
  const hard = c1.cap * 0.72 > 20 * c1.avgAll || wl.panelM2 > 15 * F.m2;
  const spot = placement(F, c1.pv);
  const kit = (c: typeof c1) => c.cost.panels + c.cost.frame + c.cost.battery + c.cost.box + c.cost.controller + c.cost.turbine;
  const g = c1.gen, solar = c1.pv.Wp > 0;
  const saver = option.ledType === "saver" ? " energy-saving" : "";
  const pitch = option.id === "wall" ? 3.91 : F.pitch, dots = dotsLine(option.id, F);
  const rows = cmp?.key === cmpKey ? cmp.rows : null;
  const current = (p: CompareRow["power"]) => inputs.power === p || (inputs.power === "auto" && p === (c1.nT > 0 ? "wind" : "solar"));

  const backlit = option.light === "back";
  const display = {
    print: backlit ? "Backlit lightbox: frame, backlit flex and LED modules" : "Flex print and LED floodlights",
    zone: `${F.zone}${saver} colour P${F.pitch} LED modules, ${backlit ? "backlit lightbox for the print" : "flex print, floodlights"}`,
    led: `${F.led}${saver} colour P${F.pitch} LED modules (${F.ledC} × ${F.ledR}) and frame`,
    wall: `${F.cab} P3.91 cabinets (50 × 50 cm) and video processor`,
    lcd: `${F.lcdN} outdoor 55-inch LCDs and mounts`,
    epaper: "E-paper tiles, sealed box and front light",
  }[option.id];

  let windText: string;
  if (inputs.site === "city") windText = `No turbine. In a city it would make only about ${kwh(result.julyWind)} kWh a day even in July, because buildings slow the wind.`;
  else if (c1.nT > 0) windText = `A turbine helps here: about ${kwh(result.julyWind)} kWh a day in July, when the sun is weakest.${c1.solo ? ` Solar alone would need ${panelText(c1.solo.pv)} and cost ${rupees(c1.solo.cost - kit(c1))} more.` : ""} Measure the site wind for 2 to 4 monsoon weeks before buying one.`;
  else if (c1.withWind) windText = `Solar alone is cheaper here. A turbine (about ${kwh(result.julyWind)} kWh a day in July) would add ${rupees(c1.withWind.cost - kit(c1))}.`;
  else windText = "Solar only, as you chose.";
  if (g) windText = `${g.kind === "fc" ? "Fuel cell" : "Generator"}: about ${lakhs([c0.gen!.fuelYr, g.fuelYr])} litres of ${FUEL_NAME[g.fuel]} a year. Over 10 years fuel and service cost ${rupees(10 * c0.run)} – ${rupees(10 * c1.run)}${g.kind === "dg" ? ". It needs a silent canopy (noise rules) and a locked tank" : ""}.`;
  else if (c1.hydroW > 0) windText = `Stream turbine: ${c1.hydroW} W from your flow and drop. Measure the flow in the driest week you need it; a stream that stops in March cannot carry the sign then.`;

  const costRows: [string, number, number][] = [
    [display, c0.cost.display, c1.cost.display],
    [`Solar panels (${panelRange([c0.pv, c1.pv])})`, c0.cost.panels, c1.cost.panels],
    ["Iron (GI) frame for the panels", c0.cost.frame, c1.cost.frame],
    [`LiFePO4 battery (${kwhRange([c0.cap, c1.cap])})`, c0.cost.battery, c1.cost.battery],
    ["Locked steel battery box", c0.cost.box, c1.cost.box],
    ["Charge controller, ESP32 and GSM kit", c0.cost.controller, c1.cost.controller],
  ];
  if (c0.cost.video + c1.cost.video > 0) costRows.push([`LED media player and ${range([c0.kit!.cards, c1.kit!.cards])} receiving cards`, c0.cost.video, c1.cost.video]);
  if (g) costRows.push([`${g.name}${g.units > 1 ? ` × ${g.units}` : ""}`, c0.cost.gen, c1.cost.gen]);
  if (c1.hydroW > 0) costRows.push(["Stream turbine, pipe and cable", c0.cost.stream, c1.cost.stream]);
  if (c1.back) costRows.push([`Panels on the back of the board (${panelText(c1.back)}) and frame, with GST`, c0.cost.back, c1.cost.back]);
  if (c0.cost.turbine + c1.cost.turbine > 0) costRows.push(["Wind turbine with mast", c0.cost.turbine, c1.cost.turbine]);
  if (c1.cost.inverter > 0) costRows.push(["Inverter, 230 V", c0.cost.inverter, c1.cost.inverter]);
  costRows.push(["Fitting and wiring", c0.cost.fit, c1.cost.fit]);
  if (inputs.structure === "new") costRows.push([`New iron board structure (${F.sqft} sq ft)`, c0.cost.structure, c1.cost.structure]);
  costRows.push(["GST (5% on panels, 18% on the rest)", c0.cost.gst, c1.cost.gst]);

  return (
    <section className={styles.block} id="detail">
      <div className={styles.blockHead}>
        <h2>{OPTIONS[option.id].name}</h2>
        <p className={styles.muted}>{OPTIONS[option.id].blurb}</p>
      </div>

      {hard && <Note warn>This place is very hard for an off-grid sign. Long dark spells mean a very big battery or solar field. Think about a smaller sign, a turbine-first design, or switching the sign off in the darkest weeks.</Note>}

      <div className={styles.look}>
        <div className={styles.lookBar}>
          <h3>How it looks</h3>
          <div className={styles.toggle} role="group" aria-label="Time of day">
            <button type="button" aria-pressed={!night} onClick={() => setNight(false)}><Sun size={16} aria-hidden /> Day</button>
            <button type="button" aria-pressed={night} onClick={() => setNight(true)}><Moon size={16} aria-hidden /> Night</button>
          </div>
          <div className={styles.adPick} role="group" aria-label="Sample ad">
            <span>Sample ad:</span>
            {ADS.map(a => <button type="button" key={a.key} aria-pressed={ad === a.key} onClick={() => onAd(a.key)}>{a.label}</button>)}
          </div>
        </div>
        <div className={styles.lookPic}><SignPreview id={option.id} faces={F} ad={ad} night={night} pv={c1.pv} backlit={option.light === "back"} /></div>
        {dots && (
          <p className={styles.dotsNote} data-warn={inputs.view < pitch}>
            <b>{dots}</b>: {sharpFrom(pitch)}. You said people stand about {inputs.view} m away
            {inputs.view < pitch ? ", which is closer than these dots look sharp. For reading from arm's length, LCD or e-paper is sharper." : ", so the picture looks solid."}
            {option.id !== "wall" && " Finer dots cost more and use more power for the same brightness."}
          </p>
        )}
        <p className={styles.small}>
          {{
            print: backlit ? "A backlit lightbox (a glow sign board): the print is on see-through flex with LEDs inside the box, so at night the whole face glows evenly." : "Normal flex print. In the day the sun lights it; at night two LED floodlights light it from the top.",
            zone: `The printed ad stays${backlit ? " and glows from behind (backlit lightbox)" : ""}. The black box is the LED zone: change its offer from a phone, any time.`,
            led: "Every dot is an LED. At night the ad switches to a dark background, which uses about a tenth of the power.",
            wall: "Same idea as the LED board, but with dots about 2.5 times closer, so it stays sharp even from close and can show video.",
            lcd: "Joined LCD screens with dark borders between them. At night black looks dark grey, because the backlight stays on.",
            epaper: "Looks like paper: softer colours, no glow. At night a small front light shines on it, like on a printed board.",
          }[option.id]} Illustration with a sample ad; LED dots are drawn bigger than real so you can see the difference.
        </p>
      </div>

      <PowerStory result={result} option={option} night={night} />

      <div className={styles.tabs} role="tablist" aria-label="Details">
        {TABS.map(t => (
          <button type="button" key={t} role="tab" aria-selected={tab === t} className={styles.tab} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div role="tabpanel" className={styles.panel}>
        {tab === "What you buy" && (
          <>
            <figure className={styles.figure}>
              <SignDrawing id={option.id} faces={F} pv={c1.pv} turbines={c1.nT} gen={!!g} />
              <figcaption>
                Size and parts, to scale: the board ({fw.toFixed(2)} × {fh.toFixed(2)} m), {solar ? `${panelText(c1.pv)} of solar panels (${wl.panelM2.toFixed(1)} m²)` : "no solar panels"}
                {c1.nT ? ", the wind turbine" : ""}{g ? ", the generator (grey)" : ""}, the battery box (green) and a 1.7 m person.
              </figcaption>
            </figure>
            <div className={styles.where}>
              <h4>Where everything goes</h4>
              <ul>
                {!solar ? <li data-ok={true}><b>Solar panels: </b>none in this choice.</li> : <li data-ok={spot.onBoard}>
                  <b>Solar panels: </b>
                  {spot.onBoard
                    ? <>fit on a tilted frame on top of the board ({c1.pv.big ? `${spot.rows} row${spot.rows > 1 ? "s" : ""} of up to ${spot.perRow} panels` : "one small panel"}). No extra land needed.</>
                    : <>too many for the board: {spot.m2.toFixed(0)} m² of panels, {(spot.m2 / F.m2).toFixed(1)} times the board&apos;s own area. They need their own ground frame next to it, about <b className="num">{Math.round(spot.land)} m² ({Math.round(spot.land * 10.764).toLocaleString("en-IN")} sq ft)</b> of land, or a nearby roof.</>}
                  {" "}The frame tilts them {place.tilt}° to the {place.lat >= 0 ? "south" : "north"}, whichever way the board faces.
                </li>}
                {c1.back && <li data-ok={true}><b>Panels on the back: </b>{panelText(c1.back)} standing upright on the back of the board. Because the back faces the sun, they make about 60% of what the top panels make over a year (about half in July), with no extra land.</li>}
                {g && <li data-ok={true}><b>{g.kind === "fc" ? "Fuel cell: " : "Generator: "}</b>{g.kind === "dg"
                  ? "on the ground in a locked silent canopy, about 1.5 × 0.8 m, with a locked fuel tank, a few metres from the road edge and from people (noise and fumes)."
                  : "inside the battery box or a small cabinet next to it, with its methanol cartridges."}</li>}
                {c1.hydroW > 0 && <li data-ok={true}><b>Stream turbine: </b>at the stream, below a small intake higher up. A pipe brings the water down to it, and a cable runs to the battery box.</li>}
                <li data-ok={c1.nT === 0 ? undefined : true}>
                  <b>Wind turbine: </b>
                  {c1.nT > 0
                    ? <>on its own 6–10 m pole next to the board, not on the board itself, because it shakes. It needs about 1 m² of ground and a clear zone around it as wide as the pole is tall.</>
                    : <>none for this sign, so no extra space.</>}
                </li>
                <li data-ok={true}><b>Battery and controller: </b>in a locked steel box on the board&apos;s own pole, 3–4 m up, so no extra space and hard to steal.</li>
              </ul>
            </div>
            <div className={styles.kit}>
              <div><span>Sign face</span><b>{display}</b></div>
              <div><span>Solar panels</span><b className="num">{panelRange([c0.pv, c1.pv])}</b><small>{solar ? `tilted ${place.tilt}°, facing ${place.lat >= 0 ? "south" : "north"}` : "none"}{c1.back ? `; plus ${panelText(c1.back)} upright on the back` : ""}</small></div>
              {c1.kit && <div><span>Picture player</span><b>{c1.kit.esp ? "ESP32 drives the LEDs" : `Media player + ${range([c0.kit!.cards, c1.kit.cards])} receiving cards`}</b>
                <small>{c1.kit.esp ? "small screen, no extra box" : `${range([c0.kit!.W, c1.kit.W])} W while the screen is on`}</small></div>}
              {g && <div><span>{g.kind === "fc" ? "Fuel cell" : "Generator"}</span><b>{g.units > 1 ? `${g.units} × ` : ""}{g.name}</b>
                <small>about {lakhs([c0.gen!.genHYr, g.genHYr])} hours and {lakhs([c0.gen!.fuelYr, g.fuelYr])} L {FUEL_NAME[g.fuel]} a year</small></div>}
              {c1.hydroW > 0 && <div><span>Stream turbine</span><b className="num">{c1.hydroW} W</b><small>day and night, {inputs.hydro?.season === "all" ? "all year" : "June–October"}</small></div>}
              <div><span>Battery</span><b className="num">LiFePO4 {c1.V} V, {range([c0.cap, c1.cap].map(c => Math.round(c / c1.V)))} Ah</b><small>{kwhRange([c0.cap, c1.cap])}, about {Math.round(lfp.kg)} kg</small></div>
              <div><span>Charge controller</span><b className="num">MPPT {range([c0.amps, c1.amps], a => Math.round(a))} A</b>
                <small>{c1.amps > 100 ? `${range([c0.amps, c1.amps], a => Math.ceil(a / 100))} units of 100 A, ` : ""}with ESP32 and GSM</small></div>
              {c1.nT > 0 && <div><span>Wind turbine</span><b>{c1.nT} small turbine{c1.nT > 1 ? "s" : ""}</b><small>certified, storm brake at 18 m/s</small></div>}
              {c1.invW > 0 && <div><span>Inverter</span><b className="num">230 V, {kwh(c0.invW)}–{kwh(c1.invW)} kW</b><small>switched off when the screen is off</small></div>}
              <div><span>Energy a day</span><b className="num">{kwhRange([c0.avgAll, c1.avgAll])}</b><small>on average</small></div>
            </div>
            <div className={styles.notes}>
              <Note warn={!!g}>{windText}</Note>
              {option.lightAlt && <Note>{option.lightAlt.light === "back"
                ? `A backlit lightbox (glow sign) instead would cost ${rupeeRange(option.lightAlt.total)} fitted and use about ${kwh(option.lightAlt.avgAll)} kWh a day against ${kwh(c1.avgAll)}: the light has to shine through the flex (only about 30% gets through). It glows evenly with no glare and keeps the LEDs inside, safe from rain and theft.`
                : `Floodlights (front-lit) instead would cost ${rupeeRange(option.lightAlt.total)} fitted and use about ${kwh(option.lightAlt.avgAll)} kWh a day against ${kwh(c1.avgAll)}.`}</Note>}
              {option.alt && <Note>{option.alt.ledType === "standard" ? "With standard LED modules" : "With energy-saving LED modules"} it would cost {rupeeRange(option.alt.total)} fitted. We picked the cheaper of the two over 10 years.</Note>}
              {wl.panels > 0.5 * wl.board
                ? <Note warn>Storm check (IS 875-3, Pune 39 m/s): the panels catch about {wl.panels.toFixed(0)} kN of wind, the board about {wl.board.toFixed(0)} kN. Put the panels on their own ground frame and get a structural engineer to sign it off.</Note>
                : <Note>Storm check (IS 875-3, Pune 39 m/s): panels about {wl.panels.toFixed(1)} kN, board about {wl.board.toFixed(1)} kN. The panels can share the board frame if the engineer agrees.</Note>}
              {spill > 0.35 && <Note>In the dry months {Math.round(spill * 100)}% of the solar energy has nowhere to go. It could run a CCTV camera, a phone-charging point or an air-quality sensor for free.</Note>}
              {st.heatDays > 0 && <Note warn>About {Math.round(st.heatDays / yrs)} days a year it freezes while the panels charge. LiFePO4 must not be charged below 0 °C, so the battery box has a small heater; its energy is already counted.</Note>}
            </div>
          </>
        )}

        {tab === "Parts list" && (
          <div className={styles.tableWrap}>
            <p className={styles.small}>Every part for this sign, as sized for the high estimate (the low estimate is shown where it differs). Part names marked &quot;class&quot; are examples of the kind to buy; check the spec, not the brand.</p>
            <table className={styles.table}>
              <thead><tr><th>Part</th><th>Spec</th><th className={styles.r}>How many</th><th>Why / where</th></tr></thead>
              <tbody>{option.parts.map((p, i) => (
                <Fragment key={i}>{(i === 0 || option.parts[i - 1].group !== p.group) && <tr className={styles.groupRow}><td colSpan={4}>{p.group}</td></tr>}
                  <tr><td><b>{p.part}</b></td><td>{p.spec}</td><td className={`${styles.r} num`}>{p.qty}</td><td>{p.note}</td></tr></Fragment>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === "Reflective & glow" && (() => { const ps = result.passive, l100 = ps.lum[1], l200 = ps.lum[2]; return (
          <div className={styles.tableWrap}>
            <p className={styles.small}>Three materials that need no power at all. They do not replace the lights on an ad, but they keep the sign visible if the battery ever runs out, and they make road signs safer.</p>
            <ul className={styles.plain}>
              <li><b>Retroreflective sheeting</b> sends a car&apos;s headlight straight back to the driver, like a cat&apos;s eye. Indian road signs use the prismatic grades (IS 15684).</li>
              <li><b>Glow (photoluminescent) tape or paint</b> soaks up daylight and gives it back slowly as a soft green glow for hours after sunset.</li>
              <li><b>Fluorescent colours</b> (yellow-green, orange) look brighter by day and at dusk. Used on school and work-zone signs; they fade faster in sun, so use a UV-protected film.</li>
            </ul>
            <h4 className={styles.h4}>How bright at night, compared (cd/m²)</h4>
            <table className={styles.table}>
              <thead><tr><th>What</th><th className={styles.r}>Brightness</th><th>Who sees it</th></tr></thead>
              <tbody>
                <tr><td>LED screen at night (our limit for this size)</td><td className={`${styles.r} num`}>{ps.lit.ledMax}</td><td>Everyone</td></tr>
                <tr><td>Printed board with floodlights (300 lux)</td><td className={`${styles.r} num`}>about {Math.round(ps.lit.flood)}</td><td>Everyone</td></tr>
                <tr><td>Reflective, prismatic (Type IV), car at 100 m / 200 m</td><td className={`${styles.r} num`}>{cd(l100.typeIV)} / {cd(l200.typeIV)}</td><td>Only the people in that car</td></tr>
                <tr><td>Reflective, microprismatic (Type XI), car at 100 m / 200 m</td><td className={`${styles.r} num`}>{cd(l100.typeXI)} / {cd(l200.typeXI)}</td><td>Only the people in that car</td></tr>
                <tr><td>Reflective, old glass-bead grade (Type I), car at 100 m</td><td className={`${styles.r} num`}>{cd(l100.typeI, 1)}</td><td>Only the people in that car</td></tr>
                <tr><td>Glow tape, 10 minutes / 1 hour after dark</td><td className={`${styles.r} num`}>{cd(ps.glow10, 2)} / {cd(ps.glow60, 3)}</td><td>Anyone close by; good for edges, too dim to read an ad</td></tr>
              </tbody>
            </table>
            <h4 className={styles.h4}>For this board</h4>
            <table className={styles.table}>
              <thead><tr><th>Extra</th><th className={styles.r}>How much</th><th className={styles.r}>Price</th><th>What it does</th></tr></thead>
              <tbody>
                <tr><td>Reflective border, 10 cm band (Type IV)</td><td className={`${styles.r} num`}>{Math.round(ps.border)} sq ft</td><td className={`${styles.r} num`}>{rupeeRange(ps.borderCost)}</td><td>The board&apos;s outline shows in headlights even with an empty battery</td></tr>
                <tr><td>Reflective key words or arrow, 10% of the face</td><td className={`${styles.r} num`}>{Math.round(ps.words)} sq ft</td><td className={`${styles.r} num`}>{rupeeRange(ps.wordsCost)}</td><td>For road-safety and direction signs (&quot;GHAT AHEAD&quot;, an arrow)</td></tr>
                <tr><td>Glow tape, board outline and both poles</td><td className={`${styles.r} num`}>{Math.round(ps.tapeM)} m</td><td className={`${styles.r} num`}>{rupees(ps.tapeCost)}</td><td>Marks the board and poles for walkers and two-wheelers</td></tr>
              </tbody>
            </table>
            <p className={styles.small}>
              Brightness in headlights: sheeting value (ASTM D4956 minimum for white: Type I 70, Type IV 360, Type XI 580 cd/lx/m²) × light from two low-beam headlamps,
              each 200–1,000 cd towards the sign (our assumption; it depends on the angle and the lamp) ÷ distance². Coloured parts reflect less than white.
              Glow: strontium aluminate pigments, DIN 67510 tests (Honeywell Lumilux, Everyglow); about 12 hours until it fades to what a dark-adapted eye can just see.
              Prices before GST from IndiaMART: prismatic sheeting ₹63–120 per sq ft, glow tape about ₹23 a metre (₹1,150 for 50 m), glow paint ₹2,220–5,800 a litre.
              A fully reflective ad print is possible, but walkers and drivers whose headlights do not point at it see a dark board, so we use reflective parts as a safety backup, not as the ad light.
            </p>
          </div>); })()}

        {tab === "Power choices" && (
          <div className={styles.tableWrap}>
            <p className={styles.small}>The same {OPTIONS[option.id].short.replace(/^\w/, ch => ch.toLowerCase())} with every way to power it, sized the same way on 10 years of weather. Your choice is marked.</p>
            {!rows ? <p className={styles.small}><span className={styles.spinner} aria-hidden /> Working out every power choice…</p> : (
              <table className={styles.table}>
                <thead><tr><th>Power</th><th className={styles.r}>Battery</th><th>Solar panels</th><th>Also needs</th><th className={styles.r}>Fitted price</th><th className={styles.r}>Over 10 years</th></tr></thead>
                <tbody>{rows.map(r => {
                  if (r.fail || !r.pv || !r.total || !r.cap) return <tr key={r.power}><td>{POWER[r.power].short}</td><td colSpan={5}>{r.why === "space" ? "Needs land for more panels" : "Not possible here"}</td></tr>;
                  const sp = placement(F, r.pv[1]);
                  return (
                    <tr key={r.power} data-pick={current(r.power)}>
                      <td><b>{POWER[r.power].short}</b>{current(r.power) ? " (your plan)" : ""}</td>
                      <td className={`${styles.r} num`}>{kwhRange(r.cap)}</td>
                      <td>{r.pv[1].Wp === 0 ? "None" : <>{panelRange(r.pv)}<br /><small>{sp.onBoard ? "on the board" : `+${Math.round(sp.land)} m² land`}</small></>}</td>
                      <td>{r.gen ? <>{r.gen.name}<br /><small>{lakhs(r.gen.fuelYr)} L {FUEL_NAME[r.gen.fuel as keyof typeof FUEL_NAME] ?? r.gen.fuel} a year</small></>
                        : r.hydroW ? `Stream turbine, ${r.hydroW} W` : r.nT && Math.max(...r.nT) > 0 ? `${range(r.nT)} wind turbine${Math.max(...r.nT) > 1 ? "s" : ""}` : "Nothing else"}</td>
                      <td className={`${styles.r} num`}>{rupeeRange(r.total)}</td>
                      <td className={`${styles.r} num`}>{r.ten ? rupeeRange(r.ten) : "n/a"}</td>
                    </tr>);
                })}</tbody>
              </table>
            )}
            <p className={styles.small}>
              Why the battery changes: it must carry the sign through the time when nothing comes in. With sun, that is every night plus a few cloudy days, so it is never much smaller than about two nights.
              A stream that flows all year, or a generator, also works at night, so the battery can shrink, but a generator turns that saving into a fuel bill every year.
              Generator prices use today&apos;s fuel price, with no price rise.
            </p>
          </div>
        )}

        {tab === "Bad weather" && (
          <>
            <div className={styles.miniStats}>
              <div><b className="num">{((100 * st.normal) / st.N).toFixed(1)}%</b><span>nights at full brightness</span></div>
              <div><b className="num">{(st.save / yrs).toFixed(1)}</b><span>dimmed nights a year</span></div>
              <div><b className="num">{(st.survival / yrs).toFixed(1)}</b><span>survival nights a year</span></div>
              <div><b className="num">{st.dark}</b><span>dark nights in {Math.round(yrs)} years</span></div>
              <div><b className="num">{nights}</b><span>nights the battery covers with no sun</span></div>
              {g && <div><b className="num">{Math.round(g.genDays)}</b><span>days a year the {g.kind === "fc" ? "fuel cell" : "generator"} runs</span></div>}
            </div>
            <BatteryChart result={result} option={option} />
          </>
        )}

        {tab === "Cost" && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Part</th><th className={styles.r}>Low</th><th className={styles.r}>High</th></tr></thead>
              <tbody>{costRows.map(([k, a, b]) => <tr key={k}><td>{k}</td><td className={`${styles.r} num`}>{rupees(a)}</td><td className={`${styles.r} num`}>{rupees(b)}</td></tr>)}</tbody>
              <tfoot>
                <tr><td>Total, fitted, with GST</td><td className={`${styles.r} num`}>{rupees(c0.cost.total)}</td><td className={`${styles.r} num`}>{rupees(c1.cost.total)}</td></tr>
                {option.ten && c0.yearly !== null && c1.yearly !== null ? (
                  <>
                    <tr><td>Each year: {c0.times ? `${c0.times} reprints, ` : ""}{g ? "fuel and generator service, " : ""}cleaning and checks</td><td className={`${styles.r} num`}>{rupees(c0.yearly)}</td><td className={`${styles.r} num`}>{rupees(c1.yearly)}</td></tr>
                    <tr><td>10-year cost</td><td className={`${styles.r} num`}>{rupees(option.ten[0])}</td><td className={`${styles.r} num`}>{rupees(option.ten[1])}</td></tr>
                  </>
                ) : <tr><td colSpan={3}>A printed board cannot rotate ads, so there is no 10-year cost.</td></tr>}
              </tfoot>
            </table>
            <p className={styles.small}>&quot;Low&quot; uses the lower power values and prices, &quot;High&quot; the upper ones. Each is sized on its own.</p>
          </div>
        )}

        {tab === "Battery types" && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Battery</th><th className={styles.r}>Size</th><th className={styles.r}>Weight</th><th className={styles.r}>Price now</th><th className={styles.r}>Over 10 years</th><th>Life</th><th>Heat</th><th>In India</th></tr></thead>
              <tbody>{option.chem.map(c => (
                <tr key={c.k} data-pick={c.k === "lfp"}>
                  <td>{c.name}{c.k === "lfp" ? " (our pick)" : ""}</td><td className={`${styles.r} num`}>{kwh(c.nominal)} kWh</td>
                  <td className={`${styles.r} num`}>{Math.round(c.kg)} kg</td><td className={`${styles.r} num`}>{rupees(c.upfront)}</td>
                  <td className={`${styles.r} num`}>{rupees(c.ten)}</td><td>{c.life}</td><td>{c.heat}</td><td>{c.india}</td>
                </tr>))}
              </tbody>
            </table>
            <p className={styles.small}>
              Same usable energy in each. LiFePO4 lets you use 90%, lasts about 10 years and copes with heat in a shaded, vented box.
              Lead-acid would weigh about {Math.round(lead.kg)} kg and cost {rupees(lead.ten)} over 10 years, against {rupees(lfp.ten)}.
            </p>
          </div>
        )}

        {tab === "Month by month" && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>kWh a day</th>{MONTHS.map(m => <th key={m} className={styles.r}>{m}</th>)}</tr></thead>
              <tbody>
                <tr><td>Made</td>{option.monthly.map((m, i) => <td key={i} className={`${styles.r} num`}>{kwh(m.pv)}</td>)}</tr>
                <tr><td>Used</td>{option.monthly.map((m, i) => <td key={i} className={`${styles.r} num`}>{kwh(m.use)}</td>)}</tr>
                {g && <tr><td>From the {g.kind === "fc" ? "fuel cell" : "generator"}</td>{option.monthly.map((m, i) => <td key={i} className={`${styles.r} num`}>{kwh(m.gen)}</td>)}</tr>}
              </tbody>
            </table>
            <p className={styles.small}>Upper estimate. In the weakest months the battery and the smart dimming carry the sign through.</p>
          </div>
        )}
      </div>
    </section>
  );
}
