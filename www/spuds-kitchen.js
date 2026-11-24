import { chains, venues, name } from "./spuds-kitchen-data.js";
import {
  fresh,
  refill,
  generate,
  move,
  serve,
  order,
  indices,
  price,
  spaces,
  slots,
  empty,
  goal,
  travel,
  discover,
} from "./spuds-kitchen-engine.js";
import { face, food } from "./spuds-kitchen-art.js";
const $ = (id) => document.getElementById(id),
  key = "earnly.spudsKitchen.v1",
  dialog = document.querySelector("dialog"),
  page = document.querySelector("article");
let s = fresh(),
  selected = null,
  notice = "", noticeUntil = 0,
  tab = "Restaurant",
  audio;
for (const k of [key, key + ".backup"]) {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    if (
      v?.version === 1 &&
      v.board.length === 80 &&
      venues[v.venue] &&
      Array.isArray(v.orders)
    ) {
      s = v;
      break;
    }
  } catch {}
}
function save() {
  try {
    const old = localStorage.getItem(key);
    if (old) localStorage.setItem(key + ".backup", old);
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    notice = "Storage unavailable. Keep this tab open to retain progress.";
  }
}
function ping(high = false) {
  try {
    if (s.sound === false) return;
    audio ??= new AudioContext();
    audio.resume();
    const osc = audio.createOscillator(),
      g = audio.createGain();
    osc.connect(g);
    g.connect(audio.destination);
    osc.frequency.value = high ? 784 : 440;
    g.gain.setValueAtTime(0.045, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
    osc.start();
    osc.stop(audio.currentTime + 0.16);
    if (s.haptic !== false) navigator.vibrate?.(10);
  } catch {}
}
function commit(message) {
  notice = message;
  noticeUntil = Date.now() + 2200;
  save();
  render();
}
function button(label, cb) {
  const b = document.createElement("button");
  b.textContent = label;
  b.onclick = cb;
  return b;
}
const people = [
  "Pip",
  "Aunt Rye",
  "Miss Dot",
  "Chef Marlo",
  "Inspector Roux",
  "Sunny",
];
function nextStep() {
  const ready = s.orders.findIndex(items => indices(s, items));
  if (ready >= 0) return "Tap " + people[(s.served + ready) % people.length] + " to serve.";
  const easiest = Math.min(...s.orders.flat().map(id => id % 10));
  const target = s.orders.flat().find(id => id % 10 === easiest && !s.board.includes(id))
    ?? s.orders.flat().find(id => !s.board.includes(id)) ?? s.orders[0][0];
  const base = target - target % 10;
  for (let id = target - 1; id >= base; id--) {
    if (s.board.filter(item => item === id).length >= 2)
      return "Tap two matching " + name(id).toLowerCase() + " tiles to merge.";
  }
  if (empty(s) < 0) return "Board full. Tap an item, then Store.";
  if (!s.energy) return "Out of energy? Open Journal → Supplies.";
  return "Tap Get " + name(base).toLowerCase() + " below.";
}
function render() {
  refill(s, Date.now());
  $("hud").innerHTML =
    `<span>Chef Lv ${s.level}</span><span>${s.xp}/${goal(s.level)} XP</span><span>ϟ ${s.energy}/100</span><span>$${s.money}</span>`;
  $("orders").replaceChildren(
    ...s.orders.map((items, i) => {
      const available = indices(s, items),
        p = (s.served + i) % people.length,
        b = button("", () => {
          if (serve(s, i)) {
            selected = null;
            ping(true);
            commit(
              "Served! +$" + price(items) + " and +" + price(items) + " XP",
            );
          } else {
            noticeUntil = Date.now() + 3500;
            notice = "Wanted: " + items.map(name).join(" + ");
            render();
          }
        });
      b.className = available ? "ready" : "";
      b.innerHTML =
        face(p) +
        "<b>" +
        people[p] +
        "</b>" +
        items.map(food).join("") +
        "<small>" +
        (available ? "Serve · " : "") +
        "$" +
        price(items) +
        " · " +
        price(items) +
        " XP</small>";
      b.setAttribute(
        "aria-label",
        people[p] +
          ": " +
          items.map(name).join(" and ") +
          (available ? ", serve now" : ""),
      );
      return b;
    }),
  );
  $("board").replaceChildren(
    ...s.board.map((id, i) => {
      const b = document.createElement("button");
      b.dataset.i = i;
      b.className =
        i >= spaces(s)
          ? "lock"
          : i === selected
            ? "selected"
            : id !== null && selected !== null && s.board[selected] === id
              ? "match"
              : "";
      b.innerHTML = i >= spaces(s) ? "·" : id === null ? "" : food(id);
      b.setAttribute(
        "aria-label",
        i >= spaces(s) ? "Locked" : id === null ? "Empty space" : name(id),
      );
      return b;
    }),
  );
  $("tip").textContent =
    selected !== null
      ? name(s.board[selected]) + " · tap a matching item to merge"
      : Date.now() < noticeUntil ? notice : nextStep();
  const actions = [];
  if (selected !== null) {
    actions.push(
      button("Store", () => {
        if (s.bag.length >= slots(s)) {
          selected = null;
          return commit("Pantry full");
        }
        s.bag.push(s.board[selected]);
        s.board[selected] = null;
        selected = null;
        commit("Stored in pantry");
      }),
      button("Sell", () => {
        const id = s.board[selected];
        if (id % 10 >= 5 && !confirm("Sell rare " + name(id) + "?")) return;
        s.undo = { id, value: 1 + (id % 10) };
        s.money += s.undo.value;
        s.board[selected] = null;
        selected = null;
        commit("Sold " + name(id));
      }),
    );
  }
  if (s.bubble && Date.now() >= s.bubble.expires) s.bubble = null;
  if (s.bubble) {
    const bubble = s.bubble;
    actions.push(
      button(
        "◌ " +
          name(bubble.id) +
          " · " +
          Math.ceil((bubble.expires - Date.now()) / 1000) +
          "s",
        () => {
          const at = empty(s);
          if (at < 0) return commit("Free one space for the bubble.");
          if (Date.now() >= bubble.expires) {
            s.bubble = null;
            return commit("Bubble expired");
          }
          if (
            !confirm(
              "Rewarded ads are unavailable. Pop for $5 restaurant cash?",
            )
          )
            return;
          if (s.money < 5) return commit("Serve an order to earn $5.");
          s.money -= 5;
          s.board[at] = bubble.id;
          discover(s, bubble.id);
          s.bubble = null;
          commit("Bubble popped");
        },
      ),
      button("Dismiss", () => {
        s.bubble = null;
        commit("Bubble released");
      }),
    );
  }
  if (s.undo)
    actions.push(
      button("Undo sale", () => {
        const i = empty(s);
        if (i < 0 || s.money < s.undo.value)
          return commit("Need one open space and $" + s.undo.value);
        s.board[i] = s.undo.id;
        s.money -= s.undo.value;
        s.undo = null;
        commit("Sale undone");
      }),
    );
  $("actions").replaceChildren(...actions);
  $("stations").replaceChildren(
    ...venues[s.venue].chains.map((c) =>
      button("Get " + name(10 * c).toLowerCase(), () => {
        selected = null;
        const ok = generate(s, c);
        if (ok) ping();
        commit(
          ok
            ? "Ingredient ready"
            : empty(s) < 0
              ? "Board full. Store, sell, or merge an item."
              : "Energy returns every two minutes. Check daily supplies.",
        );
      }),
    ),
  );
}
function play(a, b) {
  if (a !== null && a !== b) {
    const result = move(s, a, b);
    selected = null;
    if (result === "Merged" && !s.bubble && Math.random() < 0.12)
      s.bubble = { id: s.board[b], expires: Date.now() + 90000 };
    ping(result === "Merged");
    commit(result === "Merged" ? "Freshly made: " + name(s.board[b]) : result);
    if (result) $("board").children[b].classList.add("pop");
  } else {
    selected = s.board[b] !== null && selected !== b ? b : null;
    render();
  }
}
let drag = null;
$("board").onpointerdown = (e) => {
  const b = e.target.closest("[data-i]");
  if (!b || +b.dataset.i >= spaces(s)) return;
  drag = { i: +b.dataset.i, x: e.clientX, y: e.clientY };
  $("board").setPointerCapture(e.pointerId);
};
$("board").onpointermove = (e) => {
  if (
    !drag ||
    s.board[drag.i] === null ||
    (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6 && !$("ghost"))
  )
    return;
  let g = $("ghost");
  if (!g) {
    g = document.createElement("div");
    g.id = "ghost";
    g.innerHTML = food(s.board[drag.i]);
    document.body.append(g);
  }
  g.style.left = e.clientX + "px";
  g.style.top = e.clientY + "px";
};
$("board").onpointercancel = () => {
  drag = null;
  $("ghost")?.remove();
};
$("board").onpointerup = (e) => {
  if (!drag) return;
  const a = drag.i;
  drag = null;
  $("ghost")?.remove();
  const b = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest("[data-i]");
  if (b && +b.dataset.i < spaces(s))
    play(a === +b.dataset.i ? selected : a, +b.dataset.i);
};
$("board").onclick = (e) => {
  const b = e.target.closest("[data-i]");
  if (e.detail === 0 && b && +b.dataset.i < spaces(s))
    play(selected, +b.dataset.i);
};
const sections = [
  "Restaurant",
  "Appliance",
  "World map",
  "Recipes",
  "Pantry",
  "Supplies",
  "Settings",
];
function journal() {
  page.replaceChildren(
    ...sections.map((t) =>
      button(t, () => {
        tab = t;
        journal();
      }),
    ),
  );
  const h = document.createElement("h2");
  h.textContent = tab;
  page.append(h);
  const note = (t) => {
    const p = document.createElement("p");
    p.textContent = t;
    page.append(p);
  };
  const act = (label, fn) =>
    page.append(
      button(label, () => {
        fn();
        save();
        render();
        journal();
      }),
    );
  const v = venues[s.venue],
    n = s.decor[s.venue];
  if (tab === "Restaurant") {
    note(v.name + " · " + v.detail);
    page.insertAdjacentHTML("beforeend", room(v, n));
    note(n === 0 ? v.story : "Renovations completed: " + n + " of 6");
    const cost = 25 * (n + 1);
    if (n < 6)
      act(
        [
          "Repair the windows",
          "Lay mosaic tile",
          "Install booth seating",
          "Hang pendant lights",
          "Plant the terrace",
          "Raise the gold sign",
        ][n] +
          " · $" +
          cost,
        () => {
          if (s.money >= cost) {
            s.money -= cost;
            s.decor[s.venue]++;
            ping(true);
          } else alert("Serve customers to earn $" + cost + ".");
        },
      );
    for (const c of v.chains) {
      const r = s.ranks[c],
        cost = 30 * r;
      if (r < 5)
        act(chains[c].station + " Lv " + r + " · upgrade $" + cost, () => {
          if (s.money >= cost) {
            s.money -= cost;
            s.ranks[c]++;
          } else alert("Need $" + cost);
        });
    }
  }
  if (tab === "Appliance") {
    const [a, b] = v.chains.map((c) => 10 * c);
    note(
      "Chef’s finishing oven combines two different ingredients. Both ingredients must be on the board.",
    );
    for (let tier = 0; tier < 8; tier++) {
      const input = [a + tier, b + tier],
        output = a + tier + 1;
      act(input.map(name).join(" + ") + " → " + name(output), () => {
        const found = indices(s, input);
        if (!found)
          return alert("Gather both listed ingredients on the board.");
        s.board[found[0]] = output;
        s.board[found[1]] = null;
        discover(s, output);
        selected = null;
        ping(true);
      });
    }
  }
  if (tab === "World map")
    venues.forEach((v, i) =>
      act(
        (s.venue === i ? "Here · " : "") + v.name + " · Lv " + v.level,
        () => {
          if (travel(s, i)) {
            selected = null;
            notice = v.story;
            dialog.close();
          } else if (s.level < v.level)
            alert("Unlock at chef level " + v.level);
        },
      ),
    );
  if (tab === "Recipes") {
    note(s.seen.length + " / " + chains.length * 10 + " discoveries");
    chains.forEach((c, k) => {
      note(c.station);
      c.items.forEach((n, t) => {
        const id = k * 10 + t;
        if (s.seen.includes(id))
          page.insertAdjacentHTML("beforeend", food(id) + n + " ");
        else page.append(document.createTextNode(" ◇ "));
      });
    });
  }
  if (tab === "Pantry") {
    note(
      s.bag.length +
        " / " +
        slots(s) +
        " spaces. Tap an item to return it to the board.",
    );
    s.bag.forEach((id, i) =>
      act(name(id), () => {
        const at = empty(s);
        if (at >= 0) {
          s.board[at] = s.bag.splice(i, 1)[0];
        } else alert("Free one board space first.");
      }),
    );
  }
  if (tab === "Supplies") {
    const today = new Date().toLocaleDateString();
    note(
      "Orders served: " +
        s.served +
        ". Your daily delivery holds 25 energy and one ingredient.",
    );
    act(s.day === today ? "Delivery collected" : "Open daily delivery", () => {
      if (s.day === today) return;
      if (empty(s) < 0) return alert("Make room for your delivery.");
      if (
        s.energy > 75 &&
        !confirm("Your energy is nearly full. Open the delivery now?")
      )
        return;
      s.day = today;
      s.energy = Math.min(100, s.energy + 25);
      const id = v.chains[0] * 10 + 2;
      s.board[empty(s)] = id;
      discover(s, id);
      ping(true);
    });
  }
  if (tab === "Supplies") {
    const step = Math.floor(s.served / 10);
    note(
      "Service award · " +
        (s.served % 10) +
        " / 10 orders toward the next award.",
    );
    if (step > (s.awards || 0))
      act("Claim service award", () => {
        s.money += 20 * (step - (s.awards || 0));
        s.awards = step;
        ping(true);
      });
    for (const c of v.chains) {
      if (
        chains[c].items.every((_, i) => s.seen.includes(10 * c + i)) &&
        !(s.collections || []).includes(c)
      )
        act("Collect " + chains[c].station + " mastery · $100", () => {
          (s.collections ??= []).push(c);
          s.money += 100;
        });
    }
  }
  if (tab === "Settings") {
    act(
      "Kitchen sounds · " + (s.sound === false ? "off" : "on"),
      () => (s.sound = s.sound === false),
    );
    act(
      "Vibration · " + (s.haptic === false ? "off" : "on"),
      () => (s.haptic = s.haptic === false),
    );
    note(
      "Progress saves on this device. Restaurant cash buys kitchen upgrades.",
    );
  }
}
function room(v, n) {
  const [wall, roof] = v.colors;
  return `<svg style="width:100%" viewBox="0 0 300 112" aria-label="Your restaurant, ${n} renovations"><rect width="300" height="112" rx="12" fill="${wall}"/><path d="M0 88l150-21 150 20v25H0" fill="${n > 1 ? "#e7b97a" : "#937250"}"/><path d="M34 30l60-10v47l-60 10z" fill="${n ? "#b9e8db" : "#868d78"}"/><path d="M155 57l96-14 26 11-97 16z" fill="#f0c594"/><path d="M180 70l97-16v24l-97 19z" fill="${roof}"/>${n > 2 ? '<path d="M35 86l60-9 19 9-60 10z" fill="#ec936b"/>' : ""}${n > 3 ? '<circle cx="140" cy="21" r="9" fill="#ffe39a"/>' : ""}${n > 4 ? '<path d="M20 98q-20-31 0-16q-2-28 8-17q10 8-8 33" fill="#92bd6f"/>' : ""}${n > 5 ? '<text x="171" y="32" fill="#ffe2a0">SPUD’S ★</text>' : ""}</svg>`;
}
$("menu").onclick = () => {
  journal();
  dialog.showModal();
};
$("close").onclick = () => dialog.close();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) save();
  else render();
});
window.addEventListener("pagehide", save);
setInterval(() => {
  if (!drag && !document.hidden) render();
}, 15000);
render();
