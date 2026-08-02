// Validated categorical palette (dataviz skill, light mode) — passes CVD
// separation (adjacent ΔE ≥ 8) and normal-vision floor (≥ 15) on a white
// chart surface. Order is the safety mechanism: always assign in this
// sequence, never re-sort or cycle. Three slots (aqua, yellow, magenta) sit
// below 3:1 contrast on white, so charts using them always pair the mark
// with a direct label/legend entry — never color alone.
export const CHART_CATEGORICAL = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
] as const;

export const CHART_INK = {
  primary: "#1a1d23",
  secondary: "#5b6270",
  muted: "#9198a3",
  grid: "#e4e1db",
  axis: "#d3cfc6",
};
