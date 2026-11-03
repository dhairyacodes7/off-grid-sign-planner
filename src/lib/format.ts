// Indian money and energy formatting, plus the built-in places and the NASA link.
import type { PlaceData } from "./types";

const trim = (v: number) => (v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.?0+$/, "");
export function rupees(x: number): string {
  if (x >= 1e7) return "₹" + trim(x / 1e7) + " crore";
  if (x >= 1e5) return "₹" + trim(x / 1e5) + " lakh";
  if (x < 1) return "₹0";
  return "₹" + (Math.round(x / 100) * 100).toLocaleString("en-IN");
}

export function rupeeRange(a: [number, number]): string {
  const lo = Math.min(a[0], a[1]), hi = Math.max(a[0], a[1]);
  return hi - lo < 50 ? rupees(lo) : `${rupees(lo)} – ${rupees(hi)}`;
}

export const kwh = (wh: number) => (wh / 1000).toFixed(wh < 10000 ? 2 : 1);

export function kwhRange(a: number[]): string {
  const lo = kwh(Math.min(...a)), hi = kwh(Math.max(...a));
  return (lo === hi ? lo : `${lo}–${hi}`) + " kWh";
}

export type Pv = { Wp: number; n: number; big: boolean };
export const panelText = (pv: Pv) => (pv.Wp === 0 ? "None" : pv.big ? `${pv.n} × 540 W` : `1 × ${pv.Wp} W`);
export function panelRange(a: Pv[]): string {
  const [x, y] = a[0].Wp <= a[1].Wp ? a : [a[1], a[0]];
  if (x.Wp === y.Wp) return panelText(x);
  return x.big && y.big ? `${x.n}–${y.n} × 540 W` : `${panelText(x)} to ${panelText(y)}`;
}

export function range(a: number[], f: (x: number) => string | number = x => x): string {
  const lo = String(f(Math.min(...a))), hi = String(f(Math.max(...a)));
  return lo === hi ? lo : `${lo}–${hi}`;
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const BUILT_IN = [
  { key: "pune", name: "Pune, India" },
  { key: "mumbai", name: "Mumbai, India" },
  { key: "delhi", name: "New Delhi, India" },
  { key: "leh", name: "Leh, Ladakh, India" },
  { key: "dubai", name: "Dubai, UAE" },
  { key: "london", name: "London, UK" },
  { key: "nairobi", name: "Nairobi, Kenya" },
  { key: "sydney", name: "Sydney, Australia" },
  { key: "tromso", name: "Tromsø, Norway (Arctic)" },
];

export const inIndia = (lat: number, lon: number) => lat > 6 && lat < 37.5 && lon > 68 && lon < 97.5;

const NASA_PARAMS = "ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN,T2M,T2M_MAX,WS10M";
export const nasaUrl = (lat: number, lon: number) =>
  `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${NASA_PARAMS}&community=RE&longitude=${lon}&latitude=${lat}&start=20150101&end=20241231&format=JSON`;

// NASA POWER daily JSON -> the compact shape the model reads. Fills NASA's -999 gaps with the day before.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw JSON from NASA, checked field by field below
export function fromNasa(json: any, name: string): PlaceData {
  const P = json?.properties?.parameter;
  if (!P?.ALLSKY_SFC_SW_DWN) throw new Error("This is not a NASA POWER daily file.");
  const [lon, lat] = json.geometry.coordinates;
  const days = Object.keys(P.ALLSKY_SFC_SW_DWN).sort();
  if (days.length < 365) throw new Error("The file has less than one year of days.");
  const col = (k: string, dflt: number): number[] | null => {
    if (!P[k]) return null;
    let last = dflt;
    return days.map(d => {
      let x = P[k][d];
      if (x == null || x <= -998) x = last;
      last = x;
      return +x;
    });
  };
  const H = col("ALLSKY_SFC_SW_DWN", 0)!;
  return {
    key: `geo:${(+lat).toFixed(3)},${(+lon).toFixed(3)}`,
    name: name.trim().slice(0, 60) || `Lat ${(+lat).toFixed(2)}, Lon ${(+lon).toFixed(2)}`,
    lat: +lat, lon: +lon, start: days[0], H,
    Hc: col("CLRSKY_SFC_SW_DWN", 0) || H.map(h => Math.max(h, 0.1)),
    Tx: col("T2M_MAX", 25) || H.map(() => 25),
    Tm: col("T2M", 20),
    W10: col("WS10M", 3) || H.map(() => 3),
  };
}
