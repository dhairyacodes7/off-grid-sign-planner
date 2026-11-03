import styles from "./planner.module.css";

const STEPS: [string, string][] = [
  ["Real weather", "NASA POWER daily data from 1 January 2015 to 31 December 2024: sun on flat ground, clear-sky sun, temperature and wind at 10 m. Nine places are built in; any other place can be loaded from NASA. Hill fog (30% less sun in the four cloudiest months) and how windy a site is are our assumptions, because NASA's grid is too coarse to see one ghat."],
  ["Sun on the panel", "Each day's sun is split into direct and diffuse light (Erbs, Klein and Duffie, 1982) and moved onto a panel facing the equator (Liu–Jordan model, as in Duffie and Beckman). The tilt is picked for each place to give the most energy in its darkest 30 days, never under 10° so rain still washes the panel."],
  ["What the panel really gives", "Heat loss (−0.35% per °C, NOCT model), weak-light loss, dust (5% in the dry season, 1% in the monsoon), 3% wiring, 97% charge controller and 10 years of ageing. In Pune's worst monsoon week this keeps 84% of the sun's energy."],
  ["Dot size from viewing distance", "LED dots look like one picture from about 1 m away for every mm between dots, and smooth from about 3 m per mm. So we pick P4 for 2–4 m, P5 for 5–8 m, P8 for 8–15 m and P10 beyond. Finer dots use more power: a P5 module draws about 40–46 W at full white against 27–30 W for P10."],
  ["What the sign really uses", "Screens follow the daylight through the day (bright at noon, dimmer in the morning and evening), up to 5,000 cd/m² in full sun and less on cloudy days. At night they stay within the UK limits for lit adverts: 600 cd/m² up to 10 m², 300 cd/m² above. Floodlit print gets 300 lux (450 in a city), above the 215 lux minimum for billboards. Everything dims to half after midnight."],
  ["Wind, where the site allows", "A 1.2 × 1.8 m helical turbine: power = ½ · air density · area · 0.18 · speed³, starting at 3 m/s, full power at 12 m/s, braked above 18 m/s. Wind speeds around each day's average follow a Rayleigh spread."],
  ["The picture player", "A small screen (up to about 8,000 pixels) runs straight from the ESP32. A bigger one needs an LED media player (12–15 W) and receiving cards (3 W each), which stay on whenever the screen is on."],
  ["The battery, day by day", "LiFePO4: 97% in, 97% out, 90% usable, sized to still work at 80% capacity after 10 years. Through each day the sun follows a curve, so the battery covers mornings and evenings. Every evening the controller picks full, save (60%) or survival (25%) light and always keeps 30% back. On frosty days a small heater warms the box while it charges."],
  ["Backup that does not need the sun", "A stream turbine gives about 5 W per metre of drop per litre a second, day and night, while the water flows. A generator or methanol fuel cell starts when the battery is short and fills it for the night; the battery can then be small, but every litre of fuel is counted for 10 years. For these choices the cheapest over 10 years wins, not the cheapest to buy."],
  ["Where the panels go", "If there is no free ground, panels may only sit on a tilted frame on top of the board: at most 2 rows and no more panel area than the board itself (so a storm does not overload the frame). A 20 × 10 ft board holds about 7 panels of 540 W. If the back of the board faces the sun, about 7 more can stand upright on the back; they make about 60% of what the top panels make over a year, about half in July. A sign that needs more than this is marked \"Needs land for panels\"."],
  ["The cheapest setup that passes", "For each real battery size we search for the fewest panels (with 0, 1 or 2 turbines) that get through all 3,653 days at your reliability level. The cheapest one wins. Then we add the sign face, fitting, iron work and GST."],
];

const NUMBERS: [string, string, string][] = [
  ["Worst monsoon week in Pune (flat ground)", "1.70 kWh/m² a day, from 8 July 2022", "NASA data"],
  ["Outdoor colour LED modules, 32 × 16 cm", "P4 38–46 W, P5 40–46 W, P8 35–44 W, P10 27–30 W at full white; 5,000–6,000 cd/m²", "Module spec sheets"],
  ["LED module prices", "P4 ₹1,000–1,250, P5 ₹1,050–1,400, P8 ₹900–1,200, P10 ₹350–750", "IndiaMART listings, 2026"],
  ["LED module with a black screen", "P10 0.3–1.0 W up to P4 0.75–2.5 W", "Assumed from the number of driver chips: measure first"],
  ["Energy-saving (common-cathode) modules", "20–30% less power, 1.2–1.6× the price", "Maker claims; Made-in-China listings"],
  ["LED media player + receiving card", "12 W (NovaStar TB40) + 3 W per card (A5s Plus, 512 × 384 dots)", "NovaStar spec sheets; TB1/TB2 ₹7,900–16,500 on IndiaMART"],
  ["Concert wall P3.91", "800 W/m² max, 25–60 W/m² on black", "Datasheets; black assumed"],
  ["Outdoor 55-inch LCD", "220–390 W at 2,500–4,000 cd/m²", "Philips and LG spec sheets"],
  ["Controller (ESP32, GSM, sensors)", "2 W all day", "Assumed"],
  ["Diesel generator 5 kVA", "₹2–3.3 lakh; fuel L/h = 0.08145 × rated kW + 0.246 × output kW (× 1–1.5)", "IndiaMART; HOMER fuel curve, checked against 1.0–1.6 L/h at 75% load"],
  ["Diesel / biodiesel B100", "₹98.63 / ₹55–100 a litre", "Pune pump price, Sep 2026 / Pune sellers and OMC price"],
  ["Methanol fuel cell (EFOY Pro 2800)", "125 W, 0.9 L methanol per kWh, €4,999–8,299", "SFC spec sheet and European shops; methanol ₹90–175/L assumed (bulk ₹74/kg)"],
  ["Stream turbine", "W ≈ 5 × drop (m) × flow (L/s), up to 1.2 kW; ₹30,000–2.6 lakh", "PowerSpout rule of thumb; price low end assumed"],
  ["Backlit lightbox (glow sign)", "Same brightness as the floodlit print; flex lets about 25–32% of light through, 60–80% of LED light reaches the face, 120–130 lm/W; ₹170–300 per sq ft", "Heytex backlit flex data; box share assumed; IndiaMART glow sign boards"],
  ["UK brightness guide for lit adverts", "100 cd/m² dark areas; 300–1,000 cd/m² elsewhere, by size and area", "ILP PLG05 (2023)"],
  ["Retroreflective sheeting (white)", "Type I 70, Type IV 360, Type XI 580 cd/lx/m²; Type IV ₹63–120 per sq ft", "ASTM D4956 minimums; IS 15684; IndiaMART"],
  ["Headlight on a roadside sign", "200–1,000 cd per low-beam lamp", "Assumed: depends on angle and lamp"],
  ["Glow (photoluminescent) tape / paint", "0.09–2.75 cd/m² after 10 min, 0.012–0.087 after 1 h; ₹23/m tape, ₹2,220–5,800/L paint", "DIN 67510 pigment tests (Honeywell, Everyglow); IndiaMART"],
  ["540 W solar panels", "₹18–26 per W", "Indian retail prices, 2026"],
  ["LiFePO4 battery", "₹11–18 per Wh before GST", "12.8 V 100 Ah sells for ₹16,958–20,199"],
  ["Iron frame for panels / new board structure", "₹3–7 per W / ₹600–2,000 per sq ft", "Indian structure prices, IndiaMART"],
  ["Wind turbine with mast", "₹40,000–1,20,000", "Assumed, needs quotes"],
  ["GST", "5% on solar panels, 18% on the rest", "Rates from 22 September 2025"],
  ["Storm wind for the iron work", "39 m/s basic wind speed (Pune)", "IS 875 Part 3"],
];

export default function Method() {
  return (
    <section className={styles.section} id="method">
      <div className={styles.sectionHead}>
        <h2>How we work it out</h2>
        <p className={styles.muted}>Every plan runs 10 years of real NASA weather day by day, for all six signs. Nothing is hidden: the method and every main number are below.</p>
      </div>
      <details className={styles.methodFold}>
        <summary>Read the full method</summary>
        <div className={styles.methodBody}>
      <ol className={styles.steps}>
        {STEPS.map(([t, d]) => <li key={t}><b>{t}.</b> {d}</li>)}
      </ol>

      <h3 className={styles.h3}>How we checked it</h3>
      <ul className={styles.plain}>
        <li>Our sun maths matches NASA&apos;s own clearness index within 0.0006 on average.</li>
        <li>1 kW of panels makes, in its first year (10-year average): Pune 1,565 kWh, Delhi 1,516, Dubai 1,712, Sydney 1,533, London 1,064, Tromsø 762. When we compared with published solar maps they were within about 10%.</li>
        <li>Polar night in Tromsø, frost in Leh and London, and the southern hemisphere all run through the same code without errors.</li>
      </ul>

      <h3 className={styles.h3}>What we still have to measure</h3>
      <ul className={styles.plain}>
        <li>The real power of one LED module showing a black screen. On a big board it can be more than half of the night&apos;s energy.</li>
        <li>How close people really stand, at the real site, before choosing the dot size.</li>
        <li>For a stream: the flow in the driest week, with a bucket and a watch.</li>
        <li>The real wind at a site, with an anemometer for 2 to 4 monsoon weeks.</li>
        <li>Quotes from two or three suppliers for panels, batteries, the controller and the iron work.</li>
      </ul>

      <h3 className={styles.h3}>Other power we checked, and why it is not in the plan</h3>
      <ul className={styles.plain}>
        <li><b>Wind from passing traffic:</b> a maker claims 1 kW from one roadside turbine. A turbine that size would need a steady 50 km/h wind, and car gusts last a second. Not counted until it is measured.</li>
        <li><b>Speed-breaker generators:</b> about 0.5 kJ per car, so even 10,000 cars give under 1 kWh a day. The energy comes from the cars&apos; fuel, and highways cannot have speed breakers.</li>
        <li><b>Rain on the board:</b> about 1 Wh a day. Too small.</li>
        <li><b>Biogas from food waste:</b> real, about 0.09 kWh of electricity per kg (a Pune plant: 50 kWh from 550–600 kg a day). A dhaba&apos;s own waste could run its own small board, but we found no price for a generator that small, so it is an idea to test, not part of the plan.</li>
        <li><b>Aluminium-air batteries:</b> Indus Towers is trying 300 of them at telecom towers with IOC Phinergy. No public price yet.</li>
      </ul>

      <details className={styles.fold}>
        <summary>The main numbers we used</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Item</th><th>Value</th><th>Where it comes from</th></tr></thead>
            <tbody>{NUMBERS.map(([a, b, c]) => <tr key={a}><td>{a}</td><td className="num">{b}</td><td>{c}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
        </div>
      </details>
    </section>
  );
}
