export type OptionId = "print" | "zone" | "led" | "wall" | "lcd" | "epaper";
export type Site = "city" | "highway" | "ghat";
export type Target = "full" | "smart" | "budget";

export interface Inputs {
  place: string;
  w: number;
  h: number;
  budget: number;
  change: "rare" | "month" | "week" | "rotate";
  digital: "daynight" | "night";
  site: Site;
  power: Power;
  target: Target;
  zone: number; // share of the board, 0.1 - 0.4
  structure: "have" | "new";
  view: number; // metres to the closest people who read it: picks the LED dot size
  ledType: "auto" | "saver" | "standard";
  fuel: "diesel" | "biodiesel"; // for the generator choices
  hydro: Hydro | null; // a stream near the sign, if there is one
  space: "board" | "land"; // board = solar panels only on the sign's own frame, no extra land
  back: boolean; // the back of the board faces the sun, so panels may stand on it
  printLight: "auto" | "front" | "back"; // printed boards: floodlights in front, or a backlit lightbox
}

// auto = sun (+ wind where it helps); hydro = sun + stream turbine; backup = sun on the board + generator; fuel = generator only
export type Power = "auto" | "solar" | "wind" | "hydro" | "backup" | "fuel";
export interface Hydro { flow: number; head: number; season: "monsoon" | "all" } // L/s, metres of drop

export interface GenInfo {
  kind: "dg" | "fc"; name: string; fuel: "diesel" | "biodiesel" | "methanol";
  units: number; W: number; fuelYr: number; genHYr: number; runYr: number; genDays: number;
}
export interface Kit { esp: boolean; px: number; cards: number; W: number; cost: number }

// NASA POWER daily data for one place, in the compact shape the model reads
export interface PlaceData {
  key: string;
  name: string;
  lat: number;
  lon: number;
  start: string; // YYYYMMDD
  H: number[];
  Hc: number[];
  Tx: number[];
  Tm: number[] | null;
  W10: number[];
}

export interface Stats {
  N: number;
  normal: number;
  save: number;
  survival: number;
  dark: number;
  dimDays: number;
  heatDays: number;
  spilled: number;
  gen: number;
}

export interface CaseResult {
  avgAll: number;
  avgNight: number;
  pv: { Wp: number; n: number; big: boolean };
  cap: number;
  nT: number;
  V: number;
  amps: number;
  invW: number;
  stats: Stats;
  cost: {
    display: number; panels: number; frame: number; battery: number; box: number;
    controller: number; turbine: number; inverter: number; fit: number; structure: number; gst: number; total: number;
    video: number; gen: number; stream: number; back: number;
  };
  kit: Kit | null;      // what plays the pictures on an LED face
  gen: GenInfo | null;  // generator or fuel cell, if the power choice has one
  hydroW: number;       // stream turbine power, W (0 if none)
  back: { Wp: number; n: number; big: boolean } | null; // panels standing on the back of the board
  run: number;          // fuel + generator service per year, Rs
  perChange: number;
  times: number | null;
  yearly: number | null;
  solo: { cost: number; pv: { Wp: number; n: number; big: boolean }; cap: number } | null;
  withWind: { cost: number } | null;
}

// an average day of one month for one option (upper estimate): what the sun, wind and sign do
export interface DayProfile {
  month: number;   // 1-12
  pv: number;      // Wh a day from the panels
  wind: number;    // Wh a day from the turbines that are fitted
  windEach: number; // Wh a day one turbine would make here
  hydro: number;   // Wh a day from the stream turbine
  gen: number;     // Wh a day from the generator or fuel cell
  dayUse: number;  // Wh used in daylight (screen + controller)
  dayShape: number; // the part of dayUse that follows the sun (screen auto-brightness)
  nightUse: number; // Wh used at night at full service
  dayLen: number;  // hours of daylight
  eveH: number;    // lit hours before midnight
  lateH: number;   // lit hours after midnight (at half light)
  fixNight: number; // controller etc. at night, Wh
  nightLoad: number; // the dimmable night part, Wh
  socDawn: number; // battery level at sunrise, 0-1
}

export interface OptionResult {
  id: OptionId;
  fail: boolean;
  need: [number, string];
  fit: "fits" | "tight" | "over";
  total: [number, number] | null;
  ten: [number, number] | null;
  cases: [CaseResult, CaseResult] | null;
  windLoad: { board: number; panels: number; panelM2: number } | null;
  chem: { k: string; name: string; nominal: number; upfront: number; ten: number; kg: number; life: string; heat: string; india: string }[];
  monthly: { pv: number; use: number; gen: number }[];
  ledType: "saver" | "standard" | null;
  why: "space" | null; // why it failed: "space" = it would work with land for more panels
  parts: PartRow[];    // every component, with spec and how many
  light: "front" | "back" | null; // how a printed board is lit
  lightAlt: { light: "front" | "back"; total: [number, number]; ten: [number, number] | null; avgAll: number; cap: number } | null;
  alt: { ledType: "saver" | "standard"; total: [number, number]; ten: [number, number] | null; cap: number[]; pv: { Wp: number; n: number; big: boolean }[] } | null;
  soc: Float32Array | null; // battery level after each night, high estimate
  mode: Uint8Array | null; // 0 full, 1 save, 2 survival, 3 dark
  profiles: { good: DayProfile; bad: DayProfile; usable: number } | null;
}

export interface Faces {
  wFt: number; hFt: number; w: number; h: number; m2: number; sqft: number;
  ledC: number; ledR: number; led: number; zone: number; zoneM2: number; printedM2: number;
  cabC: number; cabR: number; cab: number; wallM2: number; lcdC: number; lcdR: number; lcdN: number;
  pitch: number; pxW: number; pxH: number; zonePx: number; wallPx: number;
}

export interface PartRow { group: string; part: string; spec: string; qty: string; note: string }

// no-power extras for this board: retroreflective sheeting and glow tape
export interface Passive {
  perim: number; border: number; words: number; tapeM: number; // m, sq ft, sq ft, m
  borderCost: [number, number]; wordsCost: [number, number]; tapeCost: number;
  lum: { d: number; typeI: [number, number]; typeIV: [number, number]; typeXI: [number, number] }[]; // cd/m² in a car's headlights
  glow10: [number, number]; glow60: [number, number]; // cd/m² 10 and 60 minutes after dark
  lit: { flood: number; ledMax: number };
}

// the same sign with another power choice (comparison table)
export interface CompareRow {
  power: Exclude<Power, "auto">;
  fail: boolean;
  why?: "space" | null;
  back?: { Wp: number; n: number; big: boolean } | null;
  total?: [number, number];
  ten?: [number, number] | null;
  cap?: [number, number];
  pv?: { Wp: number; n: number; big: boolean }[];
  nT?: [number, number];
  hydroW?: number;
  gen?: { name: string; kind: "dg" | "fc"; fuel: string; units: [number, number]; fuelYr: [number, number]; genHYr: [number, number]; runYr: [number, number] } | null;
  dark?: number;
  dim?: number;
}

export interface PlanResult {
  inputs: Inputs;
  place: { key: string; name: string; lat: number; lon: number; tilt: number; days: number };
  faces: Faces;
  bestId: OptionId;
  options: OptionResult[];
  passive: Passive;
  julyWind: number; // Wh a day per turbine in July at this site
  windMonthly: number[]; // Wh a day per turbine, Jan..Dec
  year: Uint16Array;
  month: Uint8Array;
  dom: Uint8Array;
  sun: Float32Array;
}
