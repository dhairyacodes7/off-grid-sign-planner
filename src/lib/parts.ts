// @ts-nocheck
// Parts list and no-power extras, copied from ../Sign_Planner/model/parts.js.
/* eslint-disable */
// Parts list: every component of one sized sign, with its spec, how many, and where it goes.
// Also the no-power extras: retroreflective sheeting, glow (photoluminescent) tape and paint, fluorescent colours.
// Runs in the page and in Node. Needs model.js and planner.js loaded first.
import M from "./model";
import PL from "./planner";
const PA: any = {};

// ---------- no-power extras ----------
// RA = coefficient of retroreflection for white at 0.2 deg observation, -4 deg entrance (ASTM D4956 minimums)
PA.PASSIVE = {
  retroI:  { name: "Engineering grade (glass beads, ASTM Type I)", RA: 70, price: null, note: "Old type; Indian road signs now use prismatic grades (IS 15684)" },
  retroIV: { name: "High-intensity prismatic (ASTM Type IV)", RA: 360, price: [63, 120], note: "Orafol, 3M HIP; road signs on most roads" },
  retroXI: { name: "Microprismatic, full cube (ASTM Type XI)", RA: 580, price: null, note: "Brightest; expressways and gantries. Price: ask a dealer" },
  glow: { name: "Glow (photoluminescent) tape or paint, strontium aluminate",
          after10: [90, 2750], after60: [12, 87], hours: 12, tape: 1150 / 50, paint: [2220, 5800] },
  headCd: [200, 1000],   // low-beam light from ONE headlamp towards a roadside sign, cd (assumed; depends on angle and lamp)
};
// sign luminance from retroreflective sheeting lit by a car's two headlamps at distance d (m): L = RA x E, E = 2 I / d^2
PA.retroL = (RA, d, I) => RA * (2 * I) / (d * d);
PA.passive = function (F, lift) {
  const P = PA.PASSIVE, perim = 2 * (F.w + F.h);
  const border = perim * 0.1 / PL.SQFT_M2;                 // 10 cm reflective band around the board, sq ft
  const words = F.sqft * 0.1;                              // reflective key words or arrow on 10% of the face, sq ft
  const tapeM = perim + 2 * 2 * lift;                      // glow tape around the board and up both sides of both poles, m
  const lit = { flood: 300 * 0.7 / Math.PI, ledMax: F.m2 > 10 ? 300 : 600 };   // floodlit white print (300 lux, 70% white); LED night limit
  return {
    perim, border, words, tapeM,
    borderCost: P.retroIV.price.map(p => border * p), wordsCost: P.retroIV.price.map(p => words * p), tapeCost: tapeM * P.glow.tape,
    lum: [50, 100, 200].map(d => ({ d,
      typeI: P.headCd.map(I => PA.retroL(P.retroI.RA, d, I)), typeIV: P.headCd.map(I => PA.retroL(P.retroIV.RA, d, I)),
      typeXI: P.headCd.map(I => PA.retroL(P.retroXI.RA, d, I)) })),
    glow10: P.glow.after10.map(x => x / 1000), glow60: P.glow.after60.map(x => x / 1000), lit,
  };
};

// ---------- the parts list ----------
const n0 = x => Math.max(0, Math.round(x));
const ftx = F => `${F.wFt} × ${F.hFt} ft`;
PA.list = function (id, inp, F, r) {
  if (r.fail) return [];
  const c0 = r.c[0], c1 = r.c[1], b = c1.b, L = c1.L, rows = [];
  const add = (group, part, spec, qty, note) => rows.push({ group, part, spec, qty: String(qty), note: note || "" });
  const pm = M.P.pitches[F.pitch] || M.P.pitches[10], saver = r.ledType === "saver";
  const flood = L.floodW, V = M.batteryV(b.cap), lift = F.h < 1.5 ? 2.2 : 3.0;
  const modules = id === "zone" ? F.zone : id === "led" ? F.led : 0;

  // sign face
  const backlit = (id === "print" || id === "zone") && r.light === "back", printSqft = n0(id === "zone" ? F.printedM2 / PL.SQFT_M2 : F.sqft);
  if ((id === "print" || id === "zone") && !backlit) add("Sign face", "Front-lit flex print", "UV-resistant hoarding flex, eyelets every 30 cm", `${printSqft} sq ft`, "Reprinted when the ad changes");
  if (backlit) {
    add("Sign face", "Backlit lightbox", "Aluminium frame 100–150 mm deep, white inside, sealed, drain holes", `${printSqft} sq ft`, "The LEDs sit inside, safe from rain and theft");
    add("Sign face", "Backlit flex print", "Translucent backlit flex (about 30% light through)", `${printSqft} sq ft`, "Reprinted when the ad changes; about 1.5 × a front-lit print");
  }
  if (modules) {
    add("Sign face", `P${F.pitch} full-colour outdoor LED module${saver ? ", energy-saving (common cathode)" : ""}`,
      `320 × 160 mm, ${pm.px[0]} × ${pm.px[1]} dots, IP65, ${pm.Lmax.toLocaleString("en-IN")} cd/m², ${pm.max[0]}–${pm.max[1]} W at full white`,
      modules, id === "zone" ? "The changing-offer zone" : `${F.ledC} across × ${F.ledR} down`);
    add("Sign face", "LED cabinet / frame", "Aluminium or steel, IP65, rear or front service, about 18 modules each", Math.ceil(modules / 18), "Sealed against monsoon rain");
    const peak = modules * pm.max[1] * (saver ? M.P.saver[1] : 1);
    add("Power electronics", "DC-DC converter for the LEDs", `${V} V → 5 V, 40 A (200 W), at least 92% efficient, IP-rated`, Math.ceil(peak / 200), "No 230 V needed: LEDs run straight from the battery");
  }
  if (id === "wall") add("Sign face", "Concert-grade LED cabinet P3.91", "500 × 500 mm, 128 × 128 dots, 5,500 cd/m², 230 V, receiving card inside", F.cab, `${F.cabC} across × ${F.cabR} down`);
  if (id === "lcd") add("Sign face", "Outdoor 55-inch LCD", "2,500–4,000 cd/m², IP56, sunlight-readable (Philips 55BDL6052H / LG 55XE4F-M class)", F.lcdN, `${F.lcdC} across × ${F.lcdR} down, with mounts`);
  if (id === "epaper") add("Sign face", "Colour e-paper tiles", "Outdoor-rated, in a sealed box with a glass front", `${F.m2.toFixed(1)} m²`, "Power only when the picture changes");
  if (flood > 0 && backlit) add("Lights", "LED lightbox modules", `${V} V DC, at least 125 lm/W, wide-angle lens, spaced for an even glow`, `about ${Math.round(flood)} W`, "Dimmed by the controller like the floodlights");
  if (flood > 0 && !backlit) {
    const each = flood > 400 ? 100 : flood > 120 ? 50 : 20, k = Math.max(2, Math.ceil(flood / each));
    add("Lights", "LED floodlight, billboard optic", `${V} V DC, ${each} W, IP66, at least 120 lm/W, asymmetric beam aimed up at the face`, k, `About ${Math.round(flood)} W in total, from the top or bottom edge`);
  }

  // picture player
  if (c1.vk) {
    if (c1.vk.esp) add("Smart controller", "HUB75 driver board for the ESP32", "Level shifter, 1 HUB75 output", 1, "The ESP32 shows the pictures itself");
    else {
      add("Video", c1.vk.px > M.PRICE.playerBigPx ? "LED media player (NovaStar TB40 class)" : "LED media player (NovaStar TB1 / TB2 class)",
        `Plays pictures and video, Wi-Fi / 4G, ${c1.vk.px.toLocaleString("en-IN")} dots`, 1, "Ads are uploaded from a phone or laptop");
      if (c1.vk.cards) add("Video", "Receiving card (NovaStar A5s Plus class)", "Up to 512 × 384 dots, 3 W", `${c0.vk.cards}–${c1.vk.cards}`, "One per cabinet in the high case");
    }
  }

  // power sources
  const panel = pv => pv.big ? `540 W mono PERC, about 2.28 × 1.13 m` : `${pv.Wp} W panel`;
  if (b.pv.Wp > 0) add("Solar", "Solar panel", panel(b.pv), b.pv.big ? `${c0.b.pv.n}–${b.pv.n}` : 1, "Tilted to face the equator (south in India); on the board's top frame or a ground frame");
  if (c1.back) add("Solar", "Solar panel on the back of the board", panel(c1.back), c1.back.big ? c1.back.n : 1, "Upright, facing the sun; about 60% of a top panel's energy");
  if (b.nT > 0) {
    add("Wind", "Small wind turbine with storm brake", "About 1.2 × 1.8 m helical rotor, brake above 18 m/s, survival at least 50 m/s (IEC 61400-2 certified)", `${c0.b.nT}–${b.nT}`, "Measure the site wind first");
    add("Wind", "Turbine mast and foundation", "6–10 m steel pole, guyed or concrete footing, checked for 39 m/s (IS 875-3)", b.nT, "Clear zone as wide as the mast is tall");
    add("Wind", "Wind charge controller + dump load", `${V} V, with brake resistor`, b.nT, "Stops the turbine in a storm");
    add("Smart controller", "Anemometer", "Cup type, pulse output", 1, "The ESP32 brakes the turbine above 18 m/s");
  }
  if (c1.hydroW > 0) {
    add("Stream", "Stream turbine (pico-hydro)", `About ${c1.hydroW} W from ${inp.hydro.flow} L/s and ${inp.hydro.head} m drop (PowerSpout class)`, 1, "Below a small intake higher up the stream");
    add("Stream", "Pipe (penstock) and intake screen", `HDPE pipe for ${inp.hydro.head} m of drop, leaf screen at the intake`, 1, "Length depends on the slope: survey the site");
  }
  if (b.gen) {
    if (b.gen.kind === "dg") {
      add("Generator", "Diesel generator, silent canopy", "5 kVA, auto-start, CPCB-compliant canopy", b.gen.units, `About ${Math.round(b.gen.genHYr)} hours a year`);
      add("Generator", "Battery charger", `${V} V, sized to 0.5 C of the battery`, 1, "Fills the battery when the generator runs");
      add("Generator", "Locked fuel tank", `For about ${Math.round(b.gen.fuelYr / 12)} L a month`, 1, "Theft is the main risk");
    } else add("Generator", "Methanol fuel cell (EFOY Pro 2800)", "125 W, 12/24 V, silent", b.gen.units, `About ${Math.round(b.gen.fuelYr)} L methanol a year in 28 L cartridges`);
  }

  // battery and power electronics
  add("Battery", "LiFePO4 battery with BMS", `${V} V, ${Math.round(b.cap / V)} Ah (${(b.cap / 1000).toFixed(1)} kWh); low case ${Math.round(c0.b.cap / V)} Ah`, 1, "BMS cuts off over- and under-voltage and blocks charging below 0 °C");
  add("Battery", "Locked steel battery box", "Vented, shaded, insulated, IP54", Math.max(1, Math.ceil(b.cap / 1000 / M.PRICE.boxKwh)), "On the board's pole, 3–4 m up");
  if (b.stats.heatDays > 0) add("Battery", "Box heater with thermostat", `${V} V heating pad, keeps the box at 5 °C while charging`, 1, "Only where it freezes");
  if (b.pv.Wp > 0 || c1.back) add("Power electronics", "MPPT solar charge controller", `${V} V battery, ${Math.round(b.cost.amps)} A${b.cost.amps > 100 ? " (several units)" : ""}`, b.cost.amps > 100 ? Math.ceil(b.cost.amps / 100) : 1, "Gets the most power out of the panels");
  if (L.invW > 0) add("Power electronics", "Pure sine inverter", `${V} V DC → 230 V AC, ${(L.invW / 1000).toFixed(1)} kW, switched off when the screen is off`, 1, "Only the concert wall and LCDs need 230 V");

  // smart controller (the same in every sign)
  add("Smart controller", "ESP32 controller board", "ESP32-S3, in an IP65 box", 1, "Decides full / save / survival light each evening");
  add("Smart controller", "4G modem with SIM", "LTE Cat-1, SMS + data", 1, "Sends alerts: low battery, lamp failure, door opened");
  add("Smart controller", "Battery monitor", "Voltage and current sensor with shunt (INA226 class)", 1, "Measures every Wh in and out");
  add("Smart controller", "Light sensor", "Ambient light sensor (BH1750 class)", 1, "Screen brightness follows daylight; lights on at dusk");
  add("Smart controller", "Temperature sensors", "DS18B20, waterproof", 2, "Battery box and electronics");
  add("Smart controller", "Clock module", "DS3231 real-time clock", 1, "Half light after midnight, schedules");
  add("Smart controller", "Dimming / switching outputs", "MOSFET PWM drivers or relays", 2, "Floodlights, screen enable");
  add("Smart controller", "Door switch", "Magnetic reed switch", 1, "Theft and tamper alert");

  // protection, wiring, iron work
  add("Protection", "DC fuses and breakers", "Per panel string, battery main fuse, load breaker", 1, "One set");
  add("Protection", "Surge protection device", "Type 2, PV side and battery side", 2, "Lightning is common on ghats");
  add("Protection", "Earthing", "2 earth pits with copper-bonded rods, earth cable", 1, "Frame, panels, mast and box bonded");
  add("Wiring", "Solar cable", "4–6 mm², UV-rated, MC4 connectors", "as needed", "Short runs: everything is on the board");
  add("Wiring", "Battery and load cables", `Sized for ${Math.round(b.cost.amps)} A charge current, lugs, cable glands`, "as needed", "");
  if (b.pv.Wp > 0) add("Iron work", "GI panel frame", "Hot-dip galvanised, tilt to suit the place", 1, PL.windLoad(F, b.pv).panels > 0.5 * PL.windLoad(F, b.pv).board ? "Own ground frame: get an engineer's sign-off" : "On top of the board");
  if (c1.back) add("Iron work", "Back-panel rails", "GI rails bolted to the board's back frame", 1, "About 20 kg per panel: engineer to check");
  if (inp.structure === "new") add("Iron work", "New board structure", `MS / GI, ${ftx(F)}, designed for 39 m/s wind (IS 875-3)`, 1, "With foundation");

  // no-power extras (recommended for every sign)
  const ps = PA.passive(F, lift);
  add("No-power extras", "Retroreflective border", `${PA.PASSIVE.retroIV.name}, 10 cm band`, `${n0(ps.border)} sq ft`, "Shows in headlights even if the battery is empty");
  add("No-power extras", "Glow tape", "Strontium aluminate, 24 mm", `${n0(ps.tapeM)} m`, "Board outline and poles: glows for hours after sunset");
  return rows;
};

export default PA;
