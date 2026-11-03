import type { Faces, OptionId } from "@/lib/types";
import type { Pv } from "@/lib/format";
import { placement, PANEL_W } from "@/lib/space";

// Front view of the board, its solar panels, the turbine and a 1.7 m person, all to the same scale.
export function faceSize(id: OptionId, F: Faces): [number, number] {
  if (id === "led") return [F.ledC * 0.32, F.ledR * 0.16];
  if (id === "wall") return [F.cabC * 0.5, F.cabR * 0.5];
  if (id === "lcd") return [F.lcdC * 1.21, F.lcdR * 0.68];
  return [F.w, F.h];
}

function buildSvg(id: OptionId, F: Faces, pv: Pv, turbines: number, gen: boolean): string {
  const [W, H] = faceSize(id, F);
  const lift = H < 1.5 ? 2.2 : 3.0, turb = turbines > 0;
  const place = placement(F, pv);
  const nopv = pv.Wp === 0;                        // generator-only choice: no panels at all
  const top = !nopv && place.onBoard;              // panels on a tilted frame on top of the board
  const pw = pv.big ? 2.28 : Math.sqrt((pv.Wp / 209) * 2), ph = pv.big ? 1.13 : pw / 2, n = nopv ? 0 : pv.big ? pv.n : 1;
  const cols = Math.ceil(Math.sqrt(n * 2)), rows = Math.ceil(n / cols);
  const rowH = 0.45;                               // a 10-degree tilted panel seen from the front looks short
  const topH = top ? 0.35 + place.rows * (rowH + 0.08) : 0;
  const tx = W + 1.2, px0 = W + (turb ? 3.4 : 1.5), arrW = top || nopv ? 0 : cols * (pw + 0.12), arrH = top || nopv ? 0 : rows * (ph + 0.12) + 0.5;
  const mastTop = lift + H + topH + 1.2, turbTop = mastTop + 1.8;
  const xmin = gen ? -4.3 : -2, xmax = top || nopv ? (turb ? tx + 2 : W + 0.8) : px0 + arrW + 0.5;
  const ymax = Math.max(lift + H + topH, arrH, turb ? turbTop : 0, 1.8) + 0.6;
  const VW = 720, VH = 280, pad = 10, s = Math.min((VW - 2 * pad) / (xmax - xmin), (VH - 2 * pad) / ymax);
  const offX = Math.max(0, (VW - 2 * pad - (xmax - xmin) * s) / 2);   // centre a narrow scene
  const X = (x: number) => pad + offX + (x - xmin) * s, Y = (y: number) => VH - pad - y * s, L = (v: number) => v * s;
  const rect = (x: number, y: number, w: number, h: number, cls: string) =>
    `<rect x="${X(x).toFixed(1)}" y="${Y(y + h).toFixed(1)}" width="${L(w).toFixed(1)}" height="${L(h).toFixed(1)}" class="${cls}"/>`;
  const fill = (x: number, y: number, w: number, h: number, pat: string) =>
    `<rect x="${X(x)}" y="${Y(y + h)}" width="${L(w)}" height="${L(h)}" fill="url(#${pat})"/>`;
  let o = `<line x1="${pad}" y1="${Y(0)}" x2="${VW - pad}" y2="${Y(0)}" class="d-ground"/>`;
  const poleW = Math.max(0.12, W * 0.02);
  o += rect(W * 0.2, 0, poleW, lift, "d-pole") + rect(W * 0.8 - poleW, 0, poleW, lift, "d-pole");
  const dot = Math.max(2, L(0.16) * 0.9);
  if (id === "led") o += rect(0, lift, W, H, "d-screen") + fill(0, lift, W, H, "sp-dots");
  else if (id === "wall") o += rect(0, lift, W, H, "d-screen") + fill(0, lift, W, H, "sp-fine");
  else if (id === "lcd") {
    const bz = Math.max(1.5, L(0.04));
    for (let i = 0; i < F.lcdC; i++) for (let j = 0; j < F.lcdR; j++)
      o += `<rect x="${X(i * 1.21).toFixed(1)}" y="${Y(lift + (j + 1) * 0.68).toFixed(1)}" width="${L(1.21).toFixed(1)}" height="${L(0.68).toFixed(1)}" class="d-lcd" stroke-width="${bz.toFixed(1)}"/>`;
  } else if (id === "epaper") {
    o += rect(0, lift, W, H, "d-paper");
    const tiles = Math.max(1, Math.round(W / 0.7));
    for (let i = 1; i < tiles; i++) o += `<line x1="${X((i * W) / tiles)}" y1="${Y(lift)}" x2="${X((i * W) / tiles)}" y2="${Y(lift + H)}" class="d-paperline"/>`;
  } else {
    o += rect(0, lift, W, H, "d-print");
    if (L(H) > 26) o += `<text x="${X(W * 0.05)}" y="${Y(lift + H * 0.6)}" class="d-printtxt" font-size="${Math.min(26, L(H) * 0.2).toFixed(0)}">PRINTED AD</text>`;
    if (id === "zone") {
      const zA = F.zoneM2, zh = Math.min(H * 0.45, Math.sqrt(zA / 2.2)), zw = Math.min(W * 0.95, zA / zh);
      const zx = W - zw - W * 0.03, zy = lift + H * 0.06;
      o += rect(zx, zy, zw, zh, "d-screen") + fill(zx, zy, zw, zh, "sp-dots");
    }
  }
  o += rect(W * 0.8 - poleW - 0.55, lift - 1.0, 0.5, 0.6, "d-batt");
  if (turb) {
    o += rect(tx + 0.55, 0, 0.1, mastTop, "d-pole");
    o += `<rect x="${X(tx)}" y="${Y(turbTop)}" width="${L(1.2)}" height="${L(1.8)}" rx="${L(0.3)}" class="d-turb"/>`;
    o += `<path d="M${X(tx)} ${Y(turbTop - 0.2)} C ${X(tx + 1.2)} ${Y(turbTop - 0.7)}, ${X(tx)} ${Y(turbTop - 1.1)}, ${X(tx + 1.2)} ${Y(mastTop + 0.2)}" class="d-turb"/>`;
  }
  if (top) {
    // frame posts, then the rows of panels above the board
    o += rect(W * 0.15, lift + H, 0.08, topH, "d-pole") + rect(W * 0.85 - 0.08, lift + H, 0.08, topH, "d-pole");
    const perRow = pv.big ? place.perRow : 1, w1 = pv.big ? PANEL_W : Math.min(W, pw);
    for (let k = 0; k < n; k++) {
      const row = Math.floor(k / perRow), inRow = Math.min(perRow, n - row * perRow), j = k % perRow;
      const x0 = W / 2 - (inRow * (w1 + 0.03)) / 2 + j * (w1 + 0.03);
      o += rect(x0, lift + H + 0.35 + row * (rowH + 0.08), w1, rowH, "d-panel");
    }
  } else if (!nopv) {
    for (let k = 0; k < n; k++) o += rect(px0 + (k % cols) * (pw + 0.12), 0.5 + Math.floor(k / cols) * (ph + 0.12), pw, ph, "d-panel");
    o += rect(px0 + 0.2, 0, 0.08, 0.5, "d-pole") + rect(px0 + arrW - 0.4, 0, 0.08, 0.5, "d-pole");
  }
  if (gen) o += rect(-4.0, 0, 1.5, 1.0, "d-gen");   // generator in its silent canopy, about 1.5 x 0.8 m
  const hx = -1.1, hd = 0.12;
  o += `<circle cx="${X(hx)}" cy="${Y(1.7 - hd)}" r="${L(hd)}" class="d-person"/><path d="M${X(hx)} ${Y(1.7 - 2 * hd)} L${X(hx)} ${Y(0.85)} M${X(hx)} ${Y(0.85)} L${X(hx - 0.2)} ${Y(0)} M${X(hx)} ${Y(0.85)} L${X(hx + 0.2)} ${Y(0)} M${X(hx - 0.3)} ${Y(1.25)} L${X(hx + 0.3)} ${Y(1.25)}" class="d-person"/>`;
  return `<svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Drawing to scale of the board, its solar panels${turb ? ", the wind turbine" : ""} and a person" style="width:100%;height:auto;display:block">
    <defs><pattern id="sp-dots" width="${dot.toFixed(2)}" height="${dot.toFixed(2)}" patternUnits="userSpaceOnUse"><circle cx="${(dot / 2).toFixed(2)}" cy="${(dot / 2).toFixed(2)}" r="${(dot * 0.32).toFixed(2)}" class="d-dot"/></pattern>
    <pattern id="sp-fine" width="2.4" height="2.4" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="0.75" class="d-dot"/></pattern></defs>${o}</svg>`;
}

export default function SignDrawing({ id, faces, pv, turbines, gen = false }: { id: OptionId; faces: Faces; pv: Pv; turbines: number; gen?: boolean }) {
  return <div dangerouslySetInnerHTML={{ __html: buildSvg(id, faces, pv, turbines, gen) }} />;
}
