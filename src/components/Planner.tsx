"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sun, ArrowLeft, ArrowRight, Check, RotateCcw, Unplug, CloudSun, Wallet } from "lucide-react";
import styles from "./planner.module.css";
import Wizard, { STEPS } from "./Wizard";
import Results from "./Results";
import type { CompareRow, Inputs, OptionId, PlaceData, PlanResult } from "@/lib/types";
import { BUILT_IN, rupeeRange } from "@/lib/format";
import { OPTIONS } from "@/lib/text";

const START: Inputs = {
  place: "pune", w: 20, h: 10, budget: 300000, change: "week", digital: "daynight",
  site: "highway", power: "auto", target: "smart", zone: 0.18, structure: "have",
  view: 20, ledType: "auto", fuel: "diesel", hydro: null, space: "board", back: false, printLight: "auto",
};
const RESULTS = STEPS.length; // the step after the last question

export default function Planner() {
  const [inputs, setInputs] = useState<Inputs>(START);
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState(0); // furthest step reached, so the progress bar can jump back
  const [places, setPlaces] = useState<{ key: string; name: string }[]>(BUILT_IN);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<OptionId | null>(null);
  const worker = useRef<Worker | null>(null);
  const lastId = useRef(0);
  const cmpId = useRef(0);   // comparison requests use negative ids
  const pending = useRef(new Map<number, (rows: CompareRow[]) => void>());

  useEffect(() => {
    const w = new Worker(new URL("../lib/plan.worker.ts", import.meta.url));
    w.onmessage = (e: MessageEvent) => {
      const { id, result, error } = e.data;
      if (id < 0) { pending.current.get(id)?.(e.data.compare ?? []); pending.current.delete(id); return; }
      if (id !== lastId.current) return; // an older answer; the inputs changed since
      setBusy(false);
      if (error) setError(error);
      else { setError(null); setResult(result); }
    };
    worker.current = w;
    return () => w.terminate();
  }, []);

  // the plan is worked out in the background while the questions are answered
  useEffect(() => {
    const t = setTimeout(() => {
      lastId.current += 1;
      worker.current?.postMessage({ type: "plan", id: lastId.current, inputs });
    }, 250);
    return () => clearTimeout(t);
  }, [inputs]);

  const change = useCallback((patch: Partial<Inputs>) => {
    setBusy(true);
    setInputs(prev => ({ ...prev, ...patch }));
  }, []);

  // the same sign with every power choice, worked out only when someone opens that sign
  const compare = useCallback((option: OptionId, inp: Inputs) => new Promise<CompareRow[]>(resolve => {
    cmpId.current -= 1;
    pending.current.set(cmpId.current, resolve);
    worker.current?.postMessage({ type: "compare", id: cmpId.current, option, inputs: inp });
  }), []);

  const addPlace = useCallback((p: PlaceData) => {
    worker.current?.postMessage({ type: "place", place: p });
    setPlaces(prev => [...prev.filter(x => x.key !== p.key), { key: p.key, name: p.name }]);
    change({ place: p.key });
  }, [change]);

  function go(s: number) {
    setStep(s);
    setSeen(v => Math.max(v, s));
    window.scrollTo({ top: 0 });
  }

  const best = result?.options.find(o => o.id === result.bestId);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.logo} onClick={() => go(0)}>
          <span className={styles.logoSun} aria-hidden><Sun size={18} strokeWidth={2.5} /></span>
          <span className={styles.logoText}>Sign Planner</span>
        </button>
        <span className={styles.headerBy}>by Team Illuminators, DIT Pune</span>
      </header>

      {step < RESULTS ? (
        <main className={styles.wizardWrap}>
          {step === 0 && (
            <section className={styles.welcome}>
              <h1>Plan a sign that lights itself</h1>
              <p>Answer five quick questions. We suggest the right sign, solar panels and battery for your budget.</p>
              <ul className={styles.welcomePoints}>
                <li><Unplug size={18} aria-hidden /> No grid wire needed</li>
                <li><CloudSun size={18} aria-hidden /> Tested on 10 years of NASA weather</li>
                <li><Wallet size={18} aria-hidden /> Sized to your budget</li>
              </ul>
            </section>
          )}

          <nav className={styles.progress} aria-label="Steps">
            <div className={styles.progressBar}><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
            <ol className={styles.stepList}>
              {STEPS.map((s, i) => (
                <li key={s}>
                  <button type="button" className={styles.stepDot} data-state={i < step ? "done" : i === step ? "now" : "todo"}
                    disabled={i > seen} onClick={() => go(i)} aria-current={i === step ? "step" : undefined}>
                    <span className={styles.stepNum}>{i < step ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                    <span className={styles.stepName}>{s}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <section className={styles.stepCard}>
            <p className={styles.stepCount}>Step {step + 1} of {STEPS.length}</p>
            <Wizard step={step} inputs={inputs} onChange={change} places={places} onAddPlace={addPlace} />
            <div className={styles.nav}>
              {step > 0 ? (
                <button type="button" className={styles.btnGhost} onClick={() => go(step - 1)}><ArrowLeft size={18} aria-hidden /> Back</button>
              ) : <span />}
              <button type="button" className={styles.btnOrange} onClick={() => go(step + 1)}>
                {step === STEPS.length - 1 ? "See my plan" : "Next"} <ArrowRight size={18} aria-hidden />
              </button>
            </div>
          </section>

          {best && best.total && (
            <p className={styles.preview} aria-live="polite">
              <span className={styles.previewDot} aria-hidden />
              {"Our pick so far: "}<b>{OPTIONS[best.id].short}</b>{", "}<span className="num">{rupeeRange(best.total)}</span>
              {busy && <span className={styles.previewBusy}>{" · updating"}</span>}
            </p>
          )}
        </main>
      ) : (
        <main className={styles.resultsWrap}>
          <div className={styles.resultsTop}>
            <h1>Your sign plan</h1>
            <button type="button" className={styles.btnGhost} onClick={() => { setPicked(null); go(0); }}>
              <RotateCcw size={17} aria-hidden /> Start again
            </button>
          </div>
          {error && <p className={styles.error}>Something went wrong while working this out: {error}</p>}
          {!result && !error && (
            <div className={styles.loadingCard}><span className={styles.spinner} aria-hidden /> Running 10 years of weather for six kinds of sign…</div>
          )}
          {result && (
            <Results result={result} busy={busy} selected={picked ?? result.bestId} onPick={setPicked} onEdit={s => go(s)} onCompare={compare} />
          )}
        </main>
      )}

      <footer className={styles.footer}>
        Made by Team Illuminators (DIT Pune) for the InUnity Innovation Week, October 2026. Planning estimates from a simulation,
        not a quote. GST included; permission fees, land and transport are not.
      </footer>
    </div>
  );
}
