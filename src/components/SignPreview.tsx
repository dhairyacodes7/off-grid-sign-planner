"use client";

import { useId } from "react";
import type { Faces, OptionId } from "@/lib/types";
import type { Pv } from "@/lib/format";
import { placement, PANEL_W } from "@/lib/space";

// An illustration of the board with a sample ad, drawn the way each sign type really looks.
// LED dots are drawn much bigger than real, so the difference between P10, P4 and P3.9 is visible.

export type AdKey = "dhaba" | "phone" | "road";
export const ADS: { key: AdKey; label: string }[] = [
  { key: "dhaba", label: "Dhaba" },
  { key: "phone", label: "Phone shop" },
  { key: "road", label: "Road safety" },
];
const ZONE_TEXT: Record<AdKey, [string, string]> = {
  dhaba: ["TODAY'S SPECIAL", "PANEER THALI ₹150"], phone: ["NEW 5G PHONES", "FROM ₹9,999"], road: ["FOG AHEAD", "40 KM/H"],
};

const FONT = "var(--font-display), sans-serif";
// shrink a line of text until it fits the width (Lexend bold capitals are about 0.66 em wide)
const fit = (text: string, maxW: number, base: number, k = 0.66) => Math.min(base, maxW / (text.length * k));

// the ad itself, drawn on a 1000 × 500 canvas. "night" = our dark-background version for screens.
function AdArt({ ad, night, zone }: { ad: AdKey; night: boolean; zone: boolean }) {
  if (ad === "dhaba") {
    const bg = night ? "#000000" : "#ffc400";
    return (
      <g>
        <rect width="1000" height="500" fill={bg} />
        <text x="50" y="165" fontFamily={FONT} fontWeight="700" fontSize={fit("SAI DHABA", 600, 150)} fill={night ? "#ff6a1a" : "#d7261e"}>SAI DHABA</text>
        <text x="55" y="270" fontFamily={FONT} fontWeight="600" fontSize="78" fill={night ? "#ffc400" : "#3b1f00"}>Veg Thali ₹120</text>
        {!night && <rect y="345" width="1000" height="155" fill="#ffffff" />}
        <text x="55" y={zone ? 440 : 452} fontFamily={FONT} fontWeight="700" fontSize={zone ? 54 : 84} fill={night ? "#ffe08a" : "#111111"}>2 KM AHEAD</text>
        {!zone && <path d="M650 395 l70 30 l-70 30 z" fill={night ? "#ff6a1a" : "#d7261e"} />}
        <g transform="translate(800 170)">
          <circle r="118" fill={night ? "none" : "#f1f1f1"} stroke={night ? "#ffb000" : "#d9d9d9"} strokeWidth={night ? 8 : 6} />
          {[["#e67700", -45, -45], ["#2f9e44", 45, -45], ["#e03131", -45, 45], ["#fcc419", 45, 45]].map(([c, x, y]) => (
            <circle key={String(c)} cx={x as number} cy={y as number} r="36" fill={night ? "none" : (c as string)} stroke={night ? (c as string) : "none"} strokeWidth="7" />
          ))}
        </g>
      </g>
    );
  }
  if (ad === "phone") {
    return (
      <g>
        <rect width="1000" height="500" fill={night ? "#000000" : "#1d4ed8"} />
        {!night && <circle cx="880" cy="60" r="260" fill="#2563eb" />}
        <text x="50" y="150" fontFamily={FONT} fontWeight="700" fontSize={fit("CITY MOBILES", 640, 120)} fill={night ? "#38bdf8" : "#ffffff"}>CITY MOBILES</text>
        <text x="55" y="250" fontFamily={FONT} fontWeight="600" fontSize="70" fill={night ? "#fde047" : "#fde047"}>Diwali sale</text>
        <text x="55" y="335" fontFamily={FONT} fontWeight="700" fontSize="92" fill={night ? "#f472b6" : "#ffffff"}>Up to 30% off</text>
        <text x="57" y="440" fontFamily={FONT} fontWeight="600" fontSize="48" fill={night ? "#94a3b8" : "#bfdbfe"}>Open till 10 pm</text>
        <g transform="translate(790 80)">
          <rect width="150" height="290" rx="26" fill={night ? "none" : "#0f172a"} stroke={night ? "#38bdf8" : "#e2e8f0"} strokeWidth="8" />
          <rect x="16" y="30" width="118" height="210" rx="8" fill={night ? "none" : "#38bdf8"} stroke={night ? "#38bdf8" : "none"} strokeWidth="4" />
          <circle cx="75" cy="262" r="10" fill={night ? "#38bdf8" : "#e2e8f0"} />
        </g>
      </g>
    );
  }
  // road safety: yellow warning board by day, amber text on black at night
  return (
    <g>
      <rect width="1000" height="500" fill={night ? "#000000" : "#ffd200"} />
      {!night && <rect x="14" y="14" width="972" height="472" fill="none" stroke="#111111" strokeWidth="14" rx="18" />}
      <text x="60" y="170" fontFamily={FONT} fontWeight="700" fontSize={fit("GHAT SECTION AHEAD", 640, 92)} fill={night ? "#ffb000" : "#111111"}>GHAT SECTION AHEAD</text>
      <text x="62" y="285" fontFamily={FONT} fontWeight="600" fontSize="68" fill={night ? "#ffb000" : "#111111"}>Drive slow</text>
      <text x="62" y="375" fontFamily={FONT} fontWeight="600" fontSize="68" fill={night ? "#ffb000" : "#111111"}>Use low gear</text>
      {!zone && <text x="62" y="455" fontFamily={FONT} fontWeight="600" fontSize="44" fill={night ? "#ff8a00" : "#7c2d12"}>Next 12 km</text>}
      <path d="M850 420 C 850 330, 760 300, 790 220 S 900 130, 850 70" fill="none" stroke={night ? "#ffb000" : "#111111"} strokeWidth="34" strokeLinecap="round" />
      <path d="M815 95 l35 -45 l35 45" fill="none" stroke={night ? "#ffb000" : "#111111"} strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

export default function SignPreview({ id, faces, ad, night, compact = false, pv, backlit = false }: {
  id: OptionId; faces: Faces; ad: AdKey; night: boolean; compact?: boolean; pv?: Pv; backlit?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ratio = Math.min(1.2, Math.max(0.25, faces.h / faces.w));
  const SW = 1000;
  let BW = compact ? 860 : 720, BH = BW * ratio;
  const maxBH = compact ? 420 : 360;
  if (BH > maxBH) { BH = maxBH; BW = BH / ratio; }
  // solar panels on a frame on top of the board, when they fit there
  const place = pv ? placement(faces, pv) : null;
  const topRows = place && pv && pv.Wp > 0 && place.onBoard ? place.rows : 0;
  const rowH = compact ? 26 : 30;
  const bx = (SW - BW) / 2, by = (compact ? 64 : 84) + (topRows ? 30 + topRows * (rowH + 6) : 0);
  const ground = by + BH + (compact ? 60 : 120);
  const SH = ground + (compact ? 20 : 40);
  const screen = id === "led" || id === "wall";
  const artNight = night && (screen || id === "lcd");      // screens switch to the dark night version of the ad
  // drawn dot gap: bigger than real, but finer real dots (P4) are drawn finer than coarse ones (P10)
  const pitch = id === "wall" ? (compact ? 4 : 3.2) : (compact ? 1.25 : 1) * (3 + faces.pitch / 2);
  const glow = night ? 0.95 : 0.35;

  // the zone: real share of the board, about 3 : 1, bottom right
  const share = Math.min(0.4, faces.zoneM2 / Math.max(0.01, faces.m2));
  const zw = Math.min(BW * 0.62, Math.sqrt(share * BW * BH * 3)), zh = zw / 3;
  const zx = bx + BW - zw - BW * 0.03, zy = by + BH - zh - BH * 0.05;
  const zLines = ZONE_TEXT[ad];
  const zoneFont = Math.min(zh * 0.34, ...zLines.map(t => fit(t, zw * 0.9, zh * 0.34, 0.64)));

  const art = (n: boolean, z = false) => (
    <svg x={bx} y={by} width={BW} height={BH} viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">
      <AdArt ad={ad} night={n} zone={z} />
    </svg>
  );
  const ids = { dots: `d${uid}`, mask: `m${uid}`, glow: `g${uid}`, zdots: `zd${uid}`, zmask: `zm${uid}`, clip: `c${uid}`, sat: `s${uid}`, sky: `k${uid}`, flood: `f${uid}` };

  return (
    <svg viewBox={`0 0 ${SW} ${SH}`} role="img" style={{ width: "100%", height: "auto", display: "block" }}
      aria-label={`Illustration of a ${id} sign with a sample ad, ${night ? "at night" : "in the day"}`}>
      <defs>
        <linearGradient id={ids.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? "#0b1026" : "#7dd3fc"} />
          <stop offset="1" stopColor={night ? "#1e2a4a" : "#e0f2fe"} />
        </linearGradient>
        <pattern id={ids.dots} width={pitch} height={pitch} patternUnits="userSpaceOnUse">
          <circle cx={pitch / 2} cy={pitch / 2} r={pitch * (id === "wall" ? 0.47 : 0.4)} fill="#fff" />
        </pattern>
        <mask id={ids.mask}><rect x={bx} y={by} width={BW} height={BH} fill={`url(#${ids.dots})`} /></mask>
        <pattern id={ids.zdots} width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="2.3" fill="#fff" /></pattern>
        <mask id={ids.zmask}><rect x={zx} y={zy} width={zw} height={zh} fill={`url(#${ids.zdots})`} /></mask>
        <filter id={ids.glow} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={night ? 6 : 3} /></filter>
        <filter id={ids.sat}><feColorMatrix type="saturate" values="0.5" /></filter>
        <clipPath id={ids.clip}><rect x={bx} y={by} width={BW} height={BH} /></clipPath>
        <radialGradient id={ids.flood} cx="0.5" cy="0" r="0.9">
          <stop offset="0" stopColor="#fff3c4" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* sky, sun or moon, ground */}
      <rect width={SW} height={SH} fill={`url(#${ids.sky})`} />
      {night
        ? <>{[[80, 40], [190, 90], [930, 50], [860, 140], [300, 30], [640, 25]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2.2" fill="#e2e8f0" opacity="0.8" />)}
            <circle cx="900" cy="80" r="26" fill="#f8fafc" opacity="0.9" /><circle cx="912" cy="72" r="24" fill="#1a2444" /></>
        : <><circle cx="110" cy="70" r="70" fill="#fde68a" opacity="0.45" /><circle cx="110" cy="70" r="38" fill="#fbbf24" /></>}
      <rect y={ground} width={SW} height={SH - ground} fill={night ? "#0f172a" : "#94a3b8"} />
      <rect y={ground + 6} width={SW} height="5" fill={night ? "#334155" : "#f8fafc"} opacity="0.7" />

      {/* poles and battery box */}
      <rect x={bx + BW * 0.22} y={by + BH} width="16" height={ground - by - BH} fill={night ? "#334155" : "#475569"} />
      <rect x={bx + BW * 0.78 - 16} y={by + BH} width="16" height={ground - by - BH} fill={night ? "#334155" : "#475569"} />
      {!compact && <rect x={bx + BW * 0.78 - 58} y={by + BH + 40} width="34" height="42" rx="4" fill="#16a34a" />}

      {/* the face */}
      <rect x={bx - 10} y={by - 10} width={BW + 20} height={BH + 20} rx="8" fill={night ? "#1e293b" : "#334155"} />
      <g clipPath={`url(#${ids.clip})`}>
        {(id === "print" || id === "zone") && (
          <>
            {art(false, id === "zone")}
            {night && !backlit && <rect x={bx} y={by} width={BW} height={BH} fill="#000" opacity="0.5" />}
            {night && !backlit && <rect x={bx} y={by} width={BW} height={BH} fill={`url(#${ids.flood})`} />}
            {night && backlit && <rect x={bx} y={by} width={BW} height={BH} fill="#000" opacity="0.12" />}
          </>
        )}
        {(id === "led" || id === "wall") && (
          <>
            <rect x={bx} y={by} width={BW} height={BH} fill="#0a0a0a" />
            <rect x={bx} y={by} width={BW} height={BH} fill={`url(#${ids.dots})`} opacity="0.13" />
            <g filter={`url(#${ids.glow})`} opacity={glow}><g mask={`url(#${ids.mask})`}>{art(artNight)}</g></g>
            <g mask={`url(#${ids.mask})`}>{art(artNight)}</g>
            {id === "wall" && !compact && (
              <g><rect x={bx + BW - 132} y={by + 14} width="118" height="34" rx="17" fill="#000" opacity="0.6" />
                <circle cx={bx + BW - 112} cy={by + 31} r="7" fill="#ef4444" />
                <text x={bx + BW - 98} y={by + 38} fontFamily={FONT} fontWeight="700" fontSize="19" fill="#fff">VIDEO</text></g>
            )}
          </>
        )}
        {id === "lcd" && (
          <>
            <rect x={bx} y={by} width={BW} height={BH} fill={night ? "#1f242b" : "#000"} />
            <g opacity={night ? 0.92 : 1}>{art(artNight)}</g>
            {night && <rect x={bx} y={by} width={BW} height={BH} fill="#3b4250" opacity="0.28" style={{ mixBlendMode: "screen" }} />}
            {Array.from({ length: Math.max(0, faces.lcdC - 1) }, (_, i) => <rect key={`c${i}`} x={bx + ((i + 1) * BW) / faces.lcdC - 4} y={by} width="8" height={BH} fill="#0b0f14" />)}
            {Array.from({ length: Math.max(0, faces.lcdR - 1) }, (_, i) => <rect key={`r${i}`} x={bx} y={by + ((i + 1) * BH) / faces.lcdR - 4} width={BW} height="8" fill="#0b0f14" />)}
            {!night && <path d={`M${bx} ${by} L${bx + BW * 0.45} ${by} L${bx + BW * 0.2} ${by + BH} L${bx} ${by + BH} Z`} fill="#fff" opacity="0.07" />}
          </>
        )}
        {id === "epaper" && (
          <>
            <g filter={`url(#${ids.sat})`} opacity={night ? 0.6 : 0.92}>{art(false)}</g>
            <rect x={bx} y={by} width={BW} height={BH} fill="#f5efe1" opacity={night ? 0.05 : 0.22} />
            {night && <rect x={bx} y={by} width={BW} height={BH} fill="#000" opacity="0.35" />}
            {night && <rect x={bx} y={by} width={BW} height={BH} fill={`url(#${ids.flood})`} opacity="0.7" />}
            {Array.from({ length: Math.max(0, Math.round(faces.w / 0.7) - 1) }, (_, i) => {
              const n = Math.round(faces.w / 0.7);
              return <rect key={i} x={bx + ((i + 1) * BW) / n - 1.5} y={by} width="3" height={BH} fill="#9ca3af" opacity="0.6" />;
            })}
          </>
        )}
      </g>

      {/* LED zone on the printed board */}
      {id === "zone" && (
        <g>
          <rect x={zx - 6} y={zy - 6} width={zw + 12} height={zh + 12} rx="4" fill="#1e293b" />
          <rect x={zx} y={zy} width={zw} height={zh} fill="#050505" />
          <rect x={zx} y={zy} width={zw} height={zh} fill={`url(#${ids.zdots})`} opacity="0.12" />
          {[night ? 1 : 0.5, 1].map((op, k) => (
            <g key={k} mask={`url(#${ids.zmask})`} filter={k === 0 ? `url(#${ids.glow})` : undefined} opacity={op}>
              {zLines.map((t, j) => (
                <text key={j} x={zx + zw / 2} y={zy + zh / 2 + (j === 0 ? -0.18 : 0.98) * zoneFont} textAnchor="middle" fontFamily={FONT} fontWeight="700"
                  fontSize={zoneFont} fill={j === 0 ? "#22d3ee" : "#ffb000"}>{t}</text>
              ))}
            </g>
          ))}
        </g>
      )}

      {/* solar panels on the top frame */}
      {topRows > 0 && place && pv && (() => {
        const per = pv.big ? place.perRow : 1;
        const n = pv.big ? pv.n : 1;
        const w1 = pv.big ? Math.min(BW / per - 4, (BW * PANEL_W) / faces.w) : Math.min(BW, BW * Math.sqrt(place.m2 * 2) / faces.w);
        const rowY = (r: number) => by - 62 - (r + 1) * (rowH + 6);
        const items = [];
        for (let k = 0; k < n; k++) {
          const r = Math.floor(k / per), inRow = Math.min(per, n - r * per), j = k % per;
          const x0 = bx + BW / 2 - (inRow * (w1 + 4)) / 2 + j * (w1 + 4);
          items.push(
            <g key={k}>
              <rect x={x0} y={rowY(r)} width={w1} height={rowH} rx="2" fill={night ? "#1e40af" : "#0ea5e9"} stroke={night ? "#334155" : "#e0f2fe"} strokeWidth="2" />
              <line x1={x0 + w1 / 3} x2={x0 + w1 / 3} y1={rowY(r)} y2={rowY(r) + rowH} stroke={night ? "#334155" : "#7dd3fc"} strokeWidth="1.5" />
              <line x1={x0 + (2 * w1) / 3} x2={x0 + (2 * w1) / 3} y1={rowY(r)} y2={rowY(r) + rowH} stroke={night ? "#334155" : "#7dd3fc"} strokeWidth="1.5" />
            </g>,
          );
        }
        const topY = rowY(place.rows - 1);
        return (
          <g>
            <rect x={bx + BW * 0.12} y={topY + 6} width="7" height={by - 10 - topY - 6} fill={night ? "#334155" : "#475569"} />
            <rect x={bx + BW * 0.88 - 7} y={topY + 6} width="7" height={by - 10 - topY - 6} fill={night ? "#334155" : "#475569"} />
            {items}
          </g>
        );
      })()}

      {/* a backlit box glows evenly, with a soft halo at night */}
      {backlit && night && (id === "print" || id === "zone") && (
        <rect x={bx - 6} y={by - 6} width={BW + 12} height={BH + 12} rx="10" fill="none" stroke="#fff7d6" strokeWidth="6" opacity="0.35" filter={`url(#${ids.glow})`} />
      )}
      {/* floodlight arms for lit print and e-paper */}
      {(id === "epaper" || ((id === "print" || id === "zone") && !backlit)) && [0.25, 0.75].map(f => (
        <g key={f}>
          <rect x={bx + BW * f - 3} y={by - 40} width="6" height="34" fill="#475569" />
          <rect x={bx + BW * f - 22} y={by - 48} width="44" height="14" rx="4" fill="#334155" />
          {night && <ellipse cx={bx + BW * f} cy={by - 33} rx="20" ry="5" fill="#fff7d6" />}
        </g>
      ))}
    </svg>
  );
}
