"use client";

import { useState } from "react";
import { Sun, BatteryCharging, Wind, ShieldCheck, Pencil, Star, Moon, Fuel, Waves } from "lucide-react";
import styles from "./planner.module.css";
import type { CompareRow, Inputs, OptionId, OptionResult, PlanResult } from "@/lib/types";
import { inIndia, kwhRange, panelRange, panelText, rupeeRange, rupees, range } from "@/lib/format";
import { OPTIONS, POWER, SITE_PHRASE, dotsLine, reasons, reliability } from "@/lib/text";
import OptionDetail from "./OptionDetail";
import Method from "./Method";
import SignPreview, { type AdKey } from "./SignPreview";
import { placement } from "@/lib/space";

export function FitTag({ fit }: { fit: OptionResult["fit"] }) {
  const t = { fits: "Fits budget", tight: "Tight", over: "Over budget" }[fit];
  const title = fit === "tight" ? "The low estimate fits the budget, the high estimate does not" : undefined;
  return <span className={styles.tag} data-tone={fit} title={title}>{t}</span>;
}

const CHANGE = { rare: "Same ad for months", month: "New ad monthly", week: "New ad weekly", rotate: "Ads take turns" };
const TARGET = { full: "Always full brightness", smart: "Never dark", budget: "Cheapest" };

export default function Results({ result, busy, selected, onPick, onEdit, onCompare }: {
  result: PlanResult; busy: boolean; selected: OptionId; onPick: (id: OptionId) => void; onEdit: (step: number) => void;
  onCompare: (option: OptionId, inp: Inputs) => Promise<CompareRow[]>;
}) {
  const { inputs, place } = result;
  const [ad, setAd] = useState<AdKey>(inputs.site === "ghat" ? "road" : "dhaba");
  const best = result.options.find(o => o.id === result.bestId)!;
  const option = result.options.find(o => o.id === selected && !o.fail) ?? best;
  const answers: [string, number][] = [
    [place.name, 0], [inputs.space === "board" ? "Panels only on the sign" : "Land for panels", 0], [`${inputs.w} × ${inputs.h} ft`, 1], [rupees(inputs.budget), 2],
    [CHANGE[inputs.change], 3], [`People ${inputs.view} m away`, 1], [TARGET[inputs.target], 4], [POWER[inputs.power].short, 4],
  ];

  return (
    <div className={styles.results}>
      <div className={styles.answers}>
        <span className={styles.answersLabel}>Your answers</span>
        {answers.map(([t, s]) => (
          <button type="button" key={t} className={styles.answerChip} onClick={() => onEdit(s)} title="Change this">
            {t} <Pencil size={13} aria-hidden />
          </button>
        ))}
        {busy && <span className={styles.updating}><span className={styles.spinner} aria-hidden /> Updating…</span>}
      </div>

      {best.fail || !best.cases || !best.total ? (
        <section className={styles.hero}><h2>No setup works here. Try a smaller board.</h2></section>
      ) : (
        <>
          <section className={styles.hero} id="answer">
            <div className={styles.heroText}>
            <p className={styles.heroKicker}><Star size={16} fill="currentColor" aria-hidden /> Our pick for {SITE_PHRASE[inputs.site]} in {place.name}</p>
            <h2 className={styles.heroTitle}>{OPTIONS[best.id].name}</h2>
            <div className={styles.heroPrice}>
              <span className={`${styles.heroAmount} num`}>{rupeeRange(best.total)}</span>
              <span className={styles.heroBadge} data-tone={best.fit}>
                {{ fits: "Fits your budget", tight: "Low estimate fits your budget", over: "Over your budget" }[best.fit]}
              </span>
            </div>
            <p className={styles.heroNote}>Fitted, with GST, {inputs.structure === "new" ? "including a new iron structure" : "on your existing structure"}.</p>
            </div>
            <figure className={styles.heroPic}>
              <SignPreview id={best.id} faces={result.faces} ad={ad} night pv={best.cases[1].pv} backlit={best.light === "back"} />
              <figcaption><Moon size={14} aria-hidden /> At night, lit by its own {best.cases[1].gen ? "battery and generator" : best.cases[1].hydroW ? "stream and battery" : "solar battery"} (sample ad)</figcaption>
            </figure>
          </section>

          <div className={styles.stats4}>
            <div className={styles.stat}><Sun size={22} aria-hidden /><span>Solar panels</span><b className="num">{panelRange([best.cases[0].pv, best.cases[1].pv])}{best.cases[1].back ? ` + ${panelText(best.cases[1].back)} on the back` : ""}</b></div>
            <div className={styles.stat}><BatteryCharging size={22} aria-hidden /><span>Battery (LiFePO4)</span><b className="num">{kwhRange([best.cases[0].cap, best.cases[1].cap])}</b></div>
            {best.cases[1].gen ? (
              <div className={styles.stat}><Fuel size={22} aria-hidden /><span>{best.cases[1].gen.kind === "fc" ? "Fuel cell" : "Generator"}</span>
                <b className="num">{range([best.cases[0].gen!.fuelYr, best.cases[1].gen.fuelYr], x => Math.round(x).toLocaleString("en-IN"))} L fuel a year</b></div>
            ) : best.cases[1].hydroW > 0 ? (
              <div className={styles.stat}><Waves size={22} aria-hidden /><span>Stream turbine</span><b className="num">{best.cases[1].hydroW} W, day and night</b></div>
            ) : (
              <div className={styles.stat}><Wind size={22} aria-hidden /><span>Wind turbine</span>
                <b>{best.cases[0].nT + best.cases[1].nT === 0 ? "Not needed" : `${range([best.cases[0].nT, best.cases[1].nT])} turbine${Math.max(best.cases[0].nT, best.cases[1].nT) > 1 ? "s" : ""}`}</b></div>
            )}
            <div className={styles.stat}><ShieldCheck size={22} aria-hidden /><span>{Math.round(best.cases[1].stats.N / 365.25)} years of weather</span><b>{reliability(best.cases[1].stats)}</b></div>
          </div>

          <section className={styles.why}>
            <h3>Why we picked it</h3>
            <ul>{reasons(best, result).map((r, i) => <li key={i}>{r}</li>)}</ul>
            {!inIndia(place.lat, place.lon) && (
              <p className={styles.small}>Prices are Indian prices in rupees with GST. The panel, battery and wind sizes are right for {place.name}; get local prices there.</p>
            )}
          </section>
        </>
      )}

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2>All six kinds of sign</h2>
          <p className={styles.muted}>Tap a card to see what it needs. Prices are fitted, with GST.</p>
        </div>
        <div className={styles.optionGrid}>
          {result.options.map(o => (
            <button type="button" key={o.id} className={styles.optionCard} data-on={o.id === option.id} aria-pressed={o.id === option.id}
              disabled={o.fail} onClick={() => onPick(o.id)}>
              <span className={styles.optPic}><SignPreview id={o.id} faces={result.faces} ad={ad} night={false} compact pv={o.cases?.[1].pv} backlit={o.light === "back"} /></span>
              <span className={styles.optTop}>
                <span className={styles.optName}>{OPTIONS[o.id].short}</span>
                {o.id === result.bestId && <span className={styles.pickPill}>Our pick</span>}
              </span>
              <span className={`${styles.optPrice} num`}>{o.total ? rupeeRange(o.total) : o.why === "space" ? "Needs land for panels" : "Not possible here"}</span>
              <span className={styles.optRow}><FitTag fit={o.fit} /><span className={styles.optJob} data-tone={o.need[0]}>{o.need[1]}</span></span>
              <span className={styles.optTen}>Over 10 years: <b className="num">{o.ten ? rupeeRange(o.ten) : "not possible"}</b></span>
              {dotsLine(o.id, result.faces) && <span className={styles.optDots}>{dotsLine(o.id, result.faces)}</span>}
              {o.light && !o.fail && <span className={styles.optDots}>{o.light === "back" ? "Backlit lightbox" : "Front-lit with floodlights"}</span>}
              {o.cases && (() => { const p = placement(result.faces, o.cases[1].pv); return (
                <span className={styles.optSpace} data-ok={p.onBoard}>
                  {o.cases[1].pv.Wp === 0 ? "No solar panels" : p.onBoard ? (o.cases[1].back ? "Panels on top and back of the board" : "Panels fit on the board") : <>Panels need about <b className="num">{Math.round(p.land)} m²</b> of extra land</>}
                </span>); })()}
            </button>
          ))}
        </div>
      </section>

      <OptionDetail result={result} option={option} ad={ad} onAd={setAd} onCompare={onCompare} />
      <Method />
    </div>
  );
}
