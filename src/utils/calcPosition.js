// Owner console 2026-11-06 (release C, L-09: "או לפחות להזיז אותו גם הנייד"): the draggable calculator always stays on the screen
export const CALC_WIDTH = 340;
const CALC_BAR = 44; // the top bar (drag + close) that must stay on the screen

/** the calculator's position kept inside the screen: fully across, and at least its top bar down */
export function clampCalcPos({ x, y }, vw = window.innerWidth, vh = window.innerHeight) {
  const width = Math.min(CALC_WIDTH, vw);
  return {
    x: Math.min(Math.max(0, x), Math.max(0, vw - width)),
    y: Math.min(Math.max(0, y), Math.max(0, vh - CALC_BAR)),
  };
}
