"use client";

import { useMemo, useState } from "react";
import styles from "./planner.module.css";
import type { OptionResult, PlanResult } from "@/lib/types";
import { MONTHS } from "@/lib/format";

const MODE = ["Full brightness", "Dimmed (save mode)", "Survival (minimum light)", "Dark"];

// the year with the most dimmed nights (then the lowest battery) is the one worth showing first
function hardestYear(r: PlanResult, o: OptionResult): number {
  const score = new Map<number, number>();
  for (let i = 0; i < r.year.length; i++) {
    const y = r.year[i];
    score.set(y, (score.get(y) ?? 0) + (o.mode![i] > 0 ? 10 : 0) + (1 - o.soc![i]) * 0.01);
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export default function BatteryChart({ result, option }: { result: PlanResult; option: OptionResult }) {
  const years = useMemo(() => [...new Set(result.year)], [result.year]);
  const hardest = useMemo(() => hardestYear(result, option), [result, option]);
  const [chosen, setChosen] = useState<{ key: string; year: number } | null>(null);
  const key = option.id + result.place.key + JSON.stringify(result.inputs);
  const year = chosen && chosen.key === key ? chosen.year : hardest;
  const [hover, setHover] = useState<number | null>(null);

  const idx = useMemo(() => {
    const a: number[] = [];
    for (let i = 0; i < result.year.length; i++) if (result.year[i] === year) a.push(i);
    return a;
  }, [result.year, year]);

  const VW = 720, l = 40, r = 10, top = 10, plotH = 150, stripY = top + plotH + 14, stripH = 10, VH = stripY + stripH + 24;
  const x = (k: number) => l + (k * (VW - l - r)) / Math.max(1, idx.length - 1);
  const y = (v: number) => top + (1 - v) * plotH;
  const soc = option.soc!, mode = option.mode!;
  const pts = idx.map((i, k) => `${x(k).toFixed(1)},${y(soc[i]).toFixed(1)}`).join(" ");
  const months = idx.map((i, k) => [k, result.month[i]] as const).filter((m, j, arr) => j === 0 || m[1] !== arr[j - 1][1]);
  const counts = [0, 0, 0, 0];
  idx.forEach(i => counts[mode[i]]++);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - box.left) * VW) / box.width;
    setHover(Math.max(0, Math.min(idx.length - 1, Math.round(((px - l) / (VW - l - r)) * (idx.length - 1)))));
  }

  const hi = hover !== null ? idx[hover] : null;
  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartTop}>
        <span>Battery level after each night in</span>
        <select aria-label="Year" className={styles.selectSmall} value={year} onChange={e => setChosen({ key, year: +e.target.value })}>
          {years.map(yy => <option key={yy} value={yy}>{yy}{yy === hardest ? " (hardest)" : ""}</option>)}
        </select>
      </div>
      <div className={styles.chartBox}>
        <svg viewBox={`0 0 ${VW} ${VH}`} className={styles.chart} role="img" aria-label={`Battery level after each night in ${year}`}>
          {[0, 0.5, 1].map(v => (
            <g key={v}>
              <line x1={l} x2={VW - r} y1={y(v)} y2={y(v)} className={styles.cGrid} />
              <text x={l - 6} y={y(v) + 4} textAnchor="end" className={styles.cAxis}>{v * 100}%</text>
            </g>
          ))}
          <line x1={l} x2={VW - r} y1={y(0.3)} y2={y(0.3)} className={styles.cReserve} />
          <text x={VW - r} y={y(0.3) - 5} textAnchor="end" className={styles.cAxis}>30% kept back for the night</text>
          {months.map(([k, m]) => (
            <g key={k}>
              <line x1={x(k)} x2={x(k)} y1={top} y2={stripY + stripH} className={styles.cGrid} />
              <text x={x(k) + 3} y={VH - 6} className={styles.cAxis}>{MONTHS[m - 1]}</text>
            </g>
          ))}
          <path d={`M${l},${y(0)} L${pts.split(" ").join(" L")} L${x(idx.length - 1)},${y(0)} Z`} className={styles.cArea} />
          <polyline points={pts} className={styles.cLine} />
          <text x={l} y={stripY - 4} className={styles.cAxis}>Night mode</text>
          {idx.map((i, k) => mode[i] > 0 ? <rect key={k} x={x(k) - 1.3} y={stripY} width={2.6} height={stripH} className={styles[`cM${mode[i]}`]} /> : null)}
          {hover !== null && hi !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={top} y2={stripY + stripH} className={styles.cCross} />
              <circle cx={x(hover)} cy={y(soc[hi])} r={4.5} className={styles.cDot} />
            </>
          )}
          <rect x={l} y={top} width={VW - l - r} height={stripY + stripH - top} fill="transparent" style={{ cursor: "crosshair" }}
            onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
        {hover !== null && hi !== null && (
          <div className={styles.tip} style={{ left: `clamp(0px, calc(${(x(hover) / VW) * 100}% + 12px), calc(100% - 200px))` }}>
            <b>{result.dom[hi]} {MONTHS[result.month[hi] - 1]} {result.year[hi]}</b>
            <span>Sun: {result.sun[hi].toFixed(2)} kWh/m²</span>
            <span>Battery after the night: {Math.round(soc[hi] * 100)}%</span>
            <span>Night: {MODE[mode[hi]]}</span>
          </div>
        )}
      </div>
      <p className={styles.legend}>
        <span className={styles.swatch} data-m="1" /> dimmed night
        <span className={styles.swatch} data-m="2" /> survival night
        <span className={styles.swatch} data-m="3" /> dark night
        <span className={styles.legendCount}>In {year}: {counts[1]} dimmed, {counts[2]} survival, {counts[3]} dark</span>
      </p>
    </div>
  );
}
