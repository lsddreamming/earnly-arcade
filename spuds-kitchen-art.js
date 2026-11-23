// Tiny counter-top illustrations, lit from the upper left.
const shape = (d, fill, stroke = "#573626") =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round"/>`;
const oval = (x, y, a, b, color) =>
  `<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${b}" fill="${color}"/>`;
const svg = (body) =>
  `<svg viewBox="0 0 64 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const cup = (t) =>
  shape(
    "M12 26 Q11 52 32 52 Q48 52 49 27 M49 28 Q65 23 57 39 Q54 44 46 42",
    t > 5 ? "#abe2da" : "#fff0cb",
  ) +
  oval(30, 26, 19, 6, "#864a34") +
  oval(29, 25, 11, 3, "#e9b988");
const loaf = (t) =>
  shape(
    "M7 39 Q7 27 21 22 Q34 12 49 21 Q59 25 57 38 Q56 49 38 52 Q16 54 8 45Z",
    t > 5 ? "#c17b37" : "#e4a650",
  ) + shape("M19 26q8 1 9 9 M31 21q8 2 9 10 M43 21q7 3 7 8", "none", "#ffdda2");
const fruit = (t) =>
  shape(
    "M31 24 Q44 13 53 26 Q62 37 46 52 Q38 59 31 53 Q22 59 13 46 Q1 25 17 21 Q23 18 31 24Z",
    t > 3 ? "#ed8c46" : "#dc524b",
  ) + shape("M31 24Q28 12 44 10Q43 22 31 24", "#609353");
const dish = (t) =>
  oval(32, 45, 28, 10, "#e2f0de") +
  oval(32, 42, 23, 7, "#76ac9c") +
  shape("M11 38Q14 23 33 21Q50 20 54 35Q47 45 18 44Z", "#e69d46") +
  oval(34, 33, 13, 8, "#fff1bf") +
  oval(36, 32, 6, 5, "#ffbe39");
export function food(id) {
  const c = Math.floor(id / 10),
    t = id % 10;
  let body =
    c === 0 && t < 3
      ? oval(32, 35, 15, 20, t === 0 ? "#ca5245" : "#89583a") +
        shape("M35 17Q22 30 33 36Q40 43 29 53", "none", "#593b30")
      : c === 0 || (c === 5 && t >= 3)
        ? cup(t)
        : c === 1 || c === 2
          ? loaf(t)
          : c === 3
            ? fruit(t)
            : dish(t);
  return svg(
    oval(33, 52, 24, 5, "#0002") +
      body +
      oval(22, 29, 3, 2, "#fff8") +
      `<circle cx="52" cy="52" r="9" fill="#384b40"/><text x="52" y="56" fill="white" font-size="12" text-anchor="middle" font-family="system-ui">${t + 1}</text>`,
  );
}
export function face(i) {
  const hats = ["#f9ead1", "#f3bb55", "#93c6ba", "#e39c93"];
  return svg(
    oval(32, 57, 23, 11, hats[(i + 2) % 4]) +
      shape(
        "M11 40Q7 23 20 18Q38 8 49 24Q61 39 48 51Q36 61 20 55Q10 51 11 40",
        "#dfad77",
      ) +
      shape(
        "M10 24Q9 15 20 16Q17 6 29 9Q40 1 44 13Q58 9 54 22L13 29Z",
        hats[i % 4],
      ) +
      oval(25, 37, 2, 3, "#422e30") +
      oval(41, 35, 2, 3, "#422e30") +
      shape("M29 44Q34 50 40 42", "none") +
      oval(19, 42, 4, 2, "#db8d74"),
  );
}
