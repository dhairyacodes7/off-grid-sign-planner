"use client";

import { useState } from "react";
import {
  Building2, Route, Mountain, Store, RectangleHorizontal, Presentation, Landmark, Globe2, Check,
  CalendarRange, CalendarDays, CalendarClock, Repeat, Sun, Moon, ShieldCheck, PiggyBank, Lightbulb, ChevronDown,
  Footprints, Car, Truck, Signpost, PanelTop, LandPlot,
} from "lucide-react";
import styles from "./planner.module.css";
import type { Inputs, PlaceData, Power } from "@/lib/types";
import { fromNasa, nasaUrl, rupees } from "@/lib/format";
import { PLACE_NOTES } from "@/lib/text";

export const STEPS = ["Place", "Size", "Budget", "Use", "Reliability"];

type Props = {
  step: number;
  inputs: Inputs;
  onChange: (p: Partial<Inputs>) => void;
  places: { key: string; name: string }[];
  onAddPlace: (p: PlaceData) => void;
};

function Card({ on, onClick, icon, title, note, badge }: {
  on: boolean; onClick: () => void; icon?: React.ReactNode; title: string; note?: string; badge?: string;
}) {
  return (
    <button type="button" className={styles.card} data-on={on} aria-pressed={on} onClick={onClick}>
      {on && <span className={styles.cardCheck} aria-hidden><Check size={14} strokeWidth={3} /></span>}
      {icon && <span className={styles.cardIcon} aria-hidden>{icon}</span>}
      <span className={styles.cardTitle}>{title}</span>
      {note && <span className={styles.cardNote}>{note}</span>}
      {badge && <span className={styles.cardBadge}>{badge}</span>}
    </button>
  );
}

function Question({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <div className={styles.question}>
      <h2 className={styles.qTitle}>{title}</h2>
      <p className={styles.qHelp}>{help}</p>
      {children}
    </div>
  );
}

function OtherPlace({ onAddPlace }: { onAddPlace: (p: PlaceData) => void }) {
  const [lat, setLat] = useState("18.75");
  const [lon, setLon] = useState("73.40");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const la = parseFloat(lat), lo = parseFloat(lon);
  const ok = isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;

  async function fetchNasa() {
    if (!ok) return;
    setLoading(true);
    setMsg("Asking NASA for 10 years of daily weather. This can take up to a minute.");
    try {
      const r = await fetch(nasaUrl(la, lo));
      if (!r.ok) throw new Error(`NASA answered ${r.status}`);
      const p = fromNasa(await r.json(), name);
      onAddPlace(p);
      setMsg(`Loaded ${p.H.length} days for ${p.name}.`);
    } catch (e) {
      setMsg(`Could not reach NASA (${(e as Error).message}). Open the NASA link, save the page as a .json file and load it below.`);
    } finally { setLoading(false); }
  }

  async function loadFile(f: File) {
    try {
      const p = fromNasa(JSON.parse(await f.text()), name);
      onAddPlace(p);
      setMsg(`Loaded ${p.H.length} days for ${p.name}.`);
    } catch (e) { setMsg(`Could not read that file: ${(e as Error).message}`); }
  }

  return (
    <div className={styles.otherPlace}>
      <div className={styles.fields3}>
        <label className={styles.field}><span>Latitude (south is −)</span>
          <input type="number" step="0.01" value={lat} onChange={e => setLat(e.target.value)} /></label>
        <label className={styles.field}><span>Longitude (west is −)</span>
          <input type="number" step="0.01" value={lon} onChange={e => setLon(e.target.value)} /></label>
        <label className={styles.field}><span>Name</span>
          <input type="text" maxLength={60} placeholder="e.g. Lonavala ghat" value={name} onChange={e => setName(e.target.value)} /></label>
      </div>
      <div className={styles.otherActions}>
        <button type="button" className={styles.btnBlue} onClick={fetchNasa} disabled={!ok || loading}>
          <Globe2 size={18} aria-hidden /> {loading ? "Getting data…" : "Get NASA weather"}
        </button>
        <a href={ok ? nasaUrl(la, lo) : "https://power.larc.nasa.gov/data-access-viewer/"} target="_blank" rel="noopener noreferrer">Open the NASA link</a>
        <label className={styles.fileBtn}>
          Load saved file
          <input type="file" accept=".json,application/json" onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
        </label>
      </div>
      {msg && <p className={styles.small} role="status">{msg}</p>}
    </div>
  );
}

const SIZES: { w: number; h: number; title: string; note: string; icon: React.ReactNode }[] = [
  { w: 6, h: 3, title: "6 × 3 ft", note: "Shop or dhaba board", icon: <Store size={26} /> },
  { w: 10, h: 5, title: "10 × 5 ft", note: "Medium board", icon: <RectangleHorizontal size={26} /> },
  { w: 20, h: 10, title: "20 × 10 ft", note: "Standard hoarding", icon: <Presentation size={26} /> },
  { w: 40, h: 20, title: "40 × 20 ft", note: "Big highway hoarding", icon: <Landmark size={26} /> },
];
const BUDGETS = [50000, 100000, 300000, 500000, 1000000, 2500000];
// closest people who read the sign -> LED dot size (about 1 m per mm of dot gap)
const VIEWS: { v: number; title: string; note: string; icon: React.ReactNode }[] = [
  { v: 3, title: "2–4 m", note: "Footpath, shop front · P4 dots", icon: <Footprints size={24} /> },
  { v: 6, title: "5–8 m", note: "Street · P5 dots", icon: <Signpost size={24} /> },
  { v: 9, title: "8–15 m", note: "Main road · P8 dots", icon: <Car size={24} /> },
  { v: 20, title: "15 m or more", note: "Highway · P10 dots", icon: <Truck size={24} /> },
];
const POWERS: [Power, string][] = [
  ["auto", "Let the plan decide (sun, wind if it helps)"], ["solar", "Sun only"], ["wind", "Sun + wind"],
  ["hydro", "Sun + stream turbine"], ["backup", "Sun on the board + generator"], ["fuel", "Generator only, no solar"],
];

export default function Wizard({ step, inputs, onChange, places, onAddPlace }: Props) {
  const [other, setOther] = useState(false);
  const [more, setMore] = useState(false);
  const [budgetText, setBudgetText] = useState(String(inputs.budget));
  const [seenBudget, setSeenBudget] = useState(inputs.budget);
  if (inputs.budget !== seenBudget) { setSeenBudget(inputs.budget); setBudgetText(String(inputs.budget)); }
  const custom = !SIZES.some(s => s.w === inputs.w && s.h === inputs.h);

  if (step === 0) return (
    <Question title="Where will the sign stand?" help="We use 10 years of real NASA weather for this place. Pick the closest one, or any place on Earth.">
      <div className={styles.grid5}>
        {places.map(p => (
          <Card key={p.key} on={!other && inputs.place === p.key} onClick={() => { setOther(false); onChange({ place: p.key }); }}
            title={p.name} note={PLACE_NOTES[p.key] ?? "Your NASA data"} />
        ))}
        <Card on={other} onClick={() => setOther(true)} title="Another place…" note="Any latitude and longitude" />
      </div>
      {other && <OtherPlace onAddPlace={p => { setOther(false); onAddPlace(p); }} />}
      <h3 className={styles.subQ}>What kind of spot is it?</h3>
      <div className={styles.grid3}>
        <Card on={inputs.site === "city"} onClick={() => onChange({ site: "city" })} icon={<Building2 size={24} />} title="City street" note="Some shade, little wind" />
        <Card on={inputs.site === "highway"} onClick={() => onChange({ site: "highway" })} icon={<Route size={24} />} title="Open highway" note="Full sun, open to wind" />
        <Card on={inputs.site === "ghat"} onClick={() => onChange({ site: "ghat" })} icon={<Mountain size={24} />} title="Hill or ghat road" note="Fog, strong wind" />
      </div>
      <h3 className={styles.subQ}>Is there free ground next to the sign for solar panels?</h3>
      <div className={styles.grid2}>
        <Card on={inputs.space === "board"} onClick={() => onChange({ space: "board" })} icon={<PanelTop size={24} />} title="No, only on the sign" note="Panels on a frame on top of the board" />
        <Card on={inputs.space === "land"} onClick={() => onChange({ space: "land" })} icon={<LandPlot size={24} />} title="Yes, some land" note="Panels can stand next to it" />
      </div>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={inputs.back} onChange={e => onChange({ back: e.target.checked })} />
        <span>The back of the board faces the sun at noon (south in India), so panels can stand on the back too. They make about 60% of what the top panels make.</span>
      </label>
    </Question>
  );

  if (step === 1) return (
    <Question title="How big is the board?" help="Pick a common size, or type your own in feet.">
      <div className={styles.grid4}>
        {SIZES.map(s => (
          <Card key={s.title} on={inputs.w === s.w && inputs.h === s.h} onClick={() => onChange({ w: s.w, h: s.h })} icon={s.icon} title={s.title} note={s.note} />
        ))}
      </div>
      <div className={styles.customSize} data-on={custom}>
        <span className={styles.customLabel}>Your own size</span>
        <label className={styles.field}><span>Width (ft)</span>
          <input type="number" min={1} max={60} value={inputs.w} onChange={e => { const n = +e.target.value; if (n >= 1 && n <= 60) onChange({ w: n }); }} /></label>
        <span className={styles.times}>×</span>
        <label className={styles.field}><span>Height (ft)</span>
          <input type="number" min={1} max={40} value={inputs.h} onChange={e => { const n = +e.target.value; if (n >= 1 && n <= 40) onChange({ h: n }); }} /></label>
      </div>
      <h3 className={styles.subQ}>How close do people stand when they read it?</h3>
      <p className={styles.qHelp}>This picks the LED dot size. Finer dots look sharp from close, but cost more and use more power.</p>
      <div className={styles.grid4}>
        {VIEWS.map(x => (
          <Card key={x.v} on={inputs.view === x.v} onClick={() => onChange({ view: x.v })} icon={x.icon} title={x.title} note={x.note} />
        ))}
      </div>
    </Question>
  );

  if (step === 2) return (
    <Question title="What is your budget for one board?" help="Everything included: the sign, solar, battery, fitting and GST.">
      <div className={styles.budgetBox}>
        <span className={styles.rupee}>₹</span>
        <input aria-label="Budget in rupees" type="number" inputMode="numeric" min={1000} step={5000} value={budgetText}
          onChange={e => { setBudgetText(e.target.value); const n = parseFloat(e.target.value); if (n >= 1000) onChange({ budget: n }); }} />
        <span className={styles.budgetWords}>{rupees(inputs.budget)}</span>
      </div>
      <div className={styles.chips}>
        {BUDGETS.map(b => (
          <button type="button" key={b} className={styles.chip} data-on={inputs.budget === b} onClick={() => onChange({ budget: b })}>{rupees(b)}</button>
        ))}
      </div>
    </Question>
  );

  if (step === 3) return (
    <Question title="How will you use it?" help="This decides between printing and a screen.">
      <div className={styles.grid4}>
        <Card on={inputs.change === "rare"} onClick={() => onChange({ change: "rare" })} icon={<CalendarRange size={24} />} title="Same ad for months" />
        <Card on={inputs.change === "month"} onClick={() => onChange({ change: "month" })} icon={<CalendarDays size={24} />} title="New ad every month" />
        <Card on={inputs.change === "week"} onClick={() => onChange({ change: "week" })} icon={<CalendarClock size={24} />} title="New ad every week" />
        <Card on={inputs.change === "rotate"} onClick={() => onChange({ change: "rotate" })} icon={<Repeat size={24} />} title="Many ads take turns" note="Sell time slots" />
      </div>
      <h3 className={styles.subQ}>When should a screen be on?</h3>
      <div className={styles.grid2}>
        <Card on={inputs.digital === "daynight"} onClick={() => onChange({ digital: "daynight" })} icon={<Sun size={24} />} title="Day and night" note="Ads seen all day" />
        <Card on={inputs.digital === "night"} onClick={() => onChange({ digital: "night" })} icon={<Moon size={24} />} title="Night only" note="Much less power" />
      </div>
    </Question>
  );

  return (
    <Question title="How reliable must it be?" help="On the worst monsoon nights the sign can dim a little to save the battery. You choose how much.">
      <div className={styles.grid3}>
        <Card on={inputs.target === "full"} onClick={() => onChange({ target: "full" })} icon={<Lightbulb size={24} />} title="Always full brightness" note="For road and safety signs" />
        <Card on={inputs.target === "smart"} onClick={() => onChange({ target: "smart" })} icon={<ShieldCheck size={24} />} title="Never dark" note="May dim on the worst nights" badge="Recommended" />
        <Card on={inputs.target === "budget"} onClick={() => onChange({ target: "budget" })} icon={<PiggyBank size={24} />} title="Cheapest" note="About 1 dark night a year" />
      </div>
      <button type="button" className={styles.moreBtn} aria-expanded={more} onClick={() => setMore(!more)}>
        More options <ChevronDown size={18} className={more ? styles.flip : undefined} aria-hidden />
      </button>
      {more && (
        <div className={styles.moreBox}>
          <div>
            <p className={styles.miniQ}>Power source</p>
            <div className={styles.chips}>
              {POWERS.map(([v, l]) => (
                <button type="button" key={v} className={styles.chip} data-on={inputs.power === v}
                  onClick={() => onChange(v === "hydro" && !inputs.hydro ? { power: v, hydro: { flow: 2, head: 20, season: "monsoon" } } : { power: v })}>{l}</button>
              ))}
            </div>
            {inputs.power === "hydro" && inputs.hydro && (
              <>
                <div className={styles.hydroBox}>
                  <label className={styles.field}><span>Water flow (litres a second)</span>
                    <input type="number" min={0.1} max={50} step={0.1} value={inputs.hydro.flow}
                      onChange={e => { const n = +e.target.value; if (n > 0) onChange({ hydro: { ...inputs.hydro!, flow: n } }); }} /></label>
                  <label className={styles.field}><span>Drop down the slope (m)</span>
                    <input type="number" min={1} max={200} step={1} value={inputs.hydro.head}
                      onChange={e => { const n = +e.target.value; if (n > 0) onChange({ hydro: { ...inputs.hydro!, head: n } }); }} /></label>
                </div>
                <div className={styles.chips}>
                  <button type="button" className={styles.chip} data-on={inputs.hydro.season === "monsoon"} onClick={() => onChange({ hydro: { ...inputs.hydro!, season: "monsoon" } })}>Flows June–October</button>
                  <button type="button" className={styles.chip} data-on={inputs.hydro.season === "all"} onClick={() => onChange({ hydro: { ...inputs.hydro!, season: "all" } })}>Flows all year</button>
                </div>
                <p className={styles.hydroNote}>About {Math.min(1200, Math.round(5 * inputs.hydro.head * inputs.hydro.flow))} W, day and night. Measure the flow with a bucket and a watch: litres ÷ seconds.</p>
              </>
            )}
            {(inputs.power === "backup" || inputs.power === "fuel") && (
              <div className={styles.chips}>
                <button type="button" className={styles.chip} data-on={inputs.fuel === "diesel"} onClick={() => onChange({ fuel: "diesel" })}>Diesel</button>
                <button type="button" className={styles.chip} data-on={inputs.fuel === "biodiesel"} onClick={() => onChange({ fuel: "biodiesel" })}>Biodiesel B100 (renewable)</button>
              </div>
            )}
          </div>
          <div>
            <p className={styles.miniQ}>Light for the printed part</p>
            <div className={styles.chips}>
              {([["auto", "Pick the cheaper"], ["front", "Floodlights (front-lit)"], ["back", "Backlit lightbox (glow sign)"]] as const).map(([v, l]) => (
                <button type="button" key={v} className={styles.chip} data-on={inputs.printLight === v} onClick={() => onChange({ printLight: v })}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <p className={styles.miniQ}>LED modules</p>
            <div className={styles.chips}>
              {([["auto", "Pick the cheaper"], ["saver", "Energy-saving (common cathode)"], ["standard", "Standard"]] as const).map(([v, l]) => (
                <button type="button" key={v} className={styles.chip} data-on={inputs.ledType === v} onClick={() => onChange({ ledType: v })}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <p className={styles.miniQ}>LED zone size, for the printed + LED option: {Math.round(inputs.zone * 100)}% of the board</p>
            <input type="range" min={10} max={40} step={2} value={Math.round(inputs.zone * 100)} aria-label="LED zone size"
              className={styles.range} onChange={e => onChange({ zone: +e.target.value / 100 })} />
          </div>
          <div>
            <p className={styles.miniQ}>Iron structure for the board</p>
            <div className={styles.chips}>
              <button type="button" className={styles.chip} data-on={inputs.structure === "have"} onClick={() => onChange({ structure: "have" })}>We already have one</button>
              <button type="button" className={styles.chip} data-on={inputs.structure === "new"} onClick={() => onChange({ structure: "new" })}>We need a new one</button>
            </div>
          </div>
        </div>
      )}
    </Question>
  );
}
