import type { Faces, OptionId, OptionResult, PlanResult, Power, Stats } from "./types";
import { rupees, range } from "./format";

export const OPTIONS: Record<OptionId, { name: string; short: string; blurb: string }> = {
  print: { name: "Printed board with solar floodlights", short: "Printed + floodlights",
    blurb: "A normal flex print. The sun lights it in the day, small LED floodlights at night." },
  zone: { name: "Printed board with a small LED screen", short: "Printed + LED zone",
    blurb: "The big picture stays printed. One part is a colour LED screen for offers, prices and changing ads." },
  led: { name: "Full LED board", short: "Full LED board",
    blurb: "The whole face is a colour LED screen. The dot size is picked from how close people stand. Many ads can take turns." },
  wall: { name: "Concert-style LED wall (P3.9)", short: "Concert LED wall",
    blurb: "The fine-pixel screen used at concerts. Sharp video even from close. Runs on 230 V through an inverter." },
  lcd: { name: "Outdoor LCD screens", short: "LCD screens",
    blurb: "55-inch sunlight-readable LCDs joined into a wall. Very sharp, but the backlight burns power even on black." },
  epaper: { name: "Colour e-paper", short: "E-paper",
    blurb: "Like a Kindle screen. Easy to read in full sun and uses power only when the picture changes." },
};

export const PLACE_NOTES: Record<string, string> = {
  pune: "Monsoon city, our home",
  mumbai: "Heavy monsoon, coast",
  delhi: "Hot summers, hazy winters",
  leh: "High, cold desert",
  dubai: "Strong desert sun",
  london: "Dark, cloudy winters",
  nairobi: "On the equator",
  sydney: "Southern hemisphere",
  tromso: "Arctic, weeks with no sun",
};

export const POWER: Record<Power, { short: string; long: string }> = {
  auto: { short: "Sun (+ wind if it helps)", long: "Solar panels and a battery, with a wind turbine only where it pays" },
  solar: { short: "Sun only", long: "Solar panels and a battery" },
  wind: { short: "Sun + wind", long: "Solar panels, a battery and 1–2 small wind turbines" },
  hydro: { short: "Sun + stream", long: "A small turbine in a stream, solar panels and a battery" },
  backup: { short: "Sun + generator", long: "Solar panels on the board only, a small battery and a generator for dark weeks" },
  fuel: { short: "Generator only", long: "A generator and a battery, no solar panels at all" },
};

// LED dot size: sharp from about 1 m per mm of dot gap, smooth from about 3 m per mm
export function dotsLine(id: OptionId, F: Faces): string | null {
  if (id === "led") return `P${F.pitch} dots · ${F.pxW} × ${F.pxH} pixels`;
  if (id === "zone") return `P${F.pitch} dots · ${F.zonePx.toLocaleString("en-IN")} pixels in the zone`;
  if (id === "wall") return `P3.9 dots · ${F.wallPx.toLocaleString("en-IN")} pixels`;
  return null;
}
export const sharpFrom = (pitch: number) => `sharp from about ${Math.round(pitch)} m, smooth from about ${Math.round(pitch * 3)} m`;

export const FUEL_NAME = { diesel: "diesel", biodiesel: "biodiesel (B100)", methanol: "methanol" } as const;

export const SITE_PHRASE = { city: "a city street", highway: "an open highway", ghat: "a hill or ghat road" } as const;

export function reliability(st: Stats): string {
  const yrs = st.N / 365.25;
  if (st.dark > 0) return `${(st.dark / yrs).toFixed(1)} dark nights a year`;
  const dim = (st.save + st.survival) / yrs;
  if (dim < 0.05) return "Never dark, never dimmed";
  return dim < 1 ? `Never dark, dims about once in ${Math.round(1 / dim)} years` : `Never dark, dims about ${Math.round(dim)} nights a year`;
}

export function reasons(r: OptionResult, res: PlanResult): string[] {
  const out: string[] = [];
  const budget = rupees(res.inputs.budget);
  if (r.fit === "fits") out.push(`It fits your budget of ${budget}, GST included.`);
  else if (r.fit === "tight") out.push(`The lower estimate fits ${budget}, the upper one does not. Get two or three quotes before promising a price.`);
  else out.push(`Nothing that does the job fits ${budget}. This is the closest. A smaller board, a smaller LED zone, "Night only" or the "Budget" reliability level will bring the price down.`);
  out.push({
    print: "Your ad does not change often, so printing is the cheapest. The sun lights the print in the day, and LED floodlights take over at night.",
    zone: "The sun lights the printed part for free in the day. Only the small screen uses real power, and you change offers from a phone without reprinting.",
    led: "The whole face is a screen, so you can sell time slots to many advertisers. It needs a big solar field.",
    wall: "Full video, sharp even from close. It uses the most power per square metre.",
    lcd: "Very sharp close up, but the backlight burns power even on a black picture.",
    epaper: "It is easy to read in full sun and uses power only when the picture changes.",
  }[r.id]);
  const c = r.cases;
  if (c && c[1].gen) {
    const g = c[1].gen, f = [c[0].gen!.fuelYr, g.fuelYr];
    out.push(`${g.name} for the dark days: about ${range(f, x => Math.round(x).toLocaleString("en-IN"))} litres of ${FUEL_NAME[g.fuel]} a year (${rupees(c[0].run)} – ${rupees(c[1].run)} with service). Fuel is the big cost over 10 years.`);
  }
  if (c && c[1].hydroW > 0) out.push(`A stream turbine gives about ${c[1].hydroW} W day and night while the water flows, so the battery can be smaller.`);
  if (r.ledType === "saver") out.push("Energy-saving (common-cathode) LED modules: they cost more, but need less solar and battery here.");
  const prt = res.options.find(o => o.id === "print");
  if (r.id !== "print" && prt && !prt.fail && prt.ten && r.ten && r.ten[0] + r.ten[1] < prt.ten[0] + prt.ten[1] && prt.cases)
    out.push(`Over 10 years it costs less than a printed board, because you skip ${prt.cases[0].times} reprints a year.`);
  return out;
}
