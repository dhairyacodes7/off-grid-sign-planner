import type { Faces } from "./types";
import type { Pv } from "./format";

// Where do the panels go? On a tilted frame on top of the board if they fit in at most 2 rows
// AND their area is not bigger than the board (more would load the board frame too much in a storm,
// IS 875 check). Otherwise they need their own ground frame or a nearby roof.
export const PANEL_W = 1.13; // 540 W panel, standing upright: 1.13 m wide, 2.28 m long
export const GROUND_COVER = 0.7; // panel area / land area for low-tilt rows with walking gaps

export function placement(F: Faces, pv: Pv) {
  const m2 = pv.big ? pv.n * 2.58 : pv.Wp / 200;
  const perRow = pv.big ? Math.max(1, Math.floor((F.w + 0.5) / (PANEL_W + 0.03))) : 1;
  const smallWidth = Math.sqrt((m2 / 2)) * 2;  // long side of a small 2:1 panel
  const rows = pv.big ? Math.ceil(pv.n / perRow) : smallWidth <= F.w + 0.5 ? 1 : 2;
  const onBoard = rows <= 2 && m2 <= F.m2;
  return { m2, perRow, rows, onBoard, land: m2 / GROUND_COVER };
}
