// The router. The address after the # decides which page to show:
//   #/                      browse events
//   #/event/EV-000001       one event
//   #/checkout/BK-000001    pay for a booking
//   #/done/BK-000001        the confirmation
// Using # means the server needs no extra rules: it always just serves index.html.
import { configureMock, ApiError } from "./api.js";
import { h } from "./dom.js";
import { browseView } from "./views/browse.js";
import { eventView } from "./views/event.js";
import { checkoutView } from "./views/checkout.js";
import { doneView } from "./views/done.js";
import { messageView } from "./views/message.js";

// Demo knobs for the fake data, so you can see the countdown run out quickly:
//   /?hold=20     -> seats are held for 20 seconds
//   /?latency=0   -> no pretend waiting
const knobs = new URLSearchParams(location.search);
const hold = Number(knobs.get("hold"));
const latency = knobs.get("latency");
if (Number.isInteger(hold) && hold > 0) configureMock({ holdSeconds: hold });
if (latency !== null && Number.isInteger(Number(latency)) && Number(latency) >= 0) configureMock({ latencyMs: Number(latency) });

const main = document.getElementById("main");
const announcer = document.getElementById("announcer");
let cleanup = null;
let renderToken = 0;

export function announce(text) {
  // Clearing first makes screen readers speak the same sentence again if needed.
  announcer.textContent = "";
  setTimeout(() => { announcer.textContent = text; }, 30);
}

function parseRoute() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, queryText = ""] = raw.split("?");
  const query = new URLSearchParams(queryText);
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return { view: browseView, args: { query } };
  const id = parts[1] ? decodeURIComponent(parts[1]) : "";
  if (parts[0] === "event" && id && parts.length === 2) return { view: eventView, args: { id } };
  if (parts[0] === "checkout" && id && parts.length === 2) return { view: checkoutView, args: { ref: id } };
  if (parts[0] === "done" && id && parts.length === 2) return { view: doneView, args: { ref: id } };
  return { view: messageView, args: { kind: "notfound" } };
}

async function render() {
  const token = ++renderToken;
  if (cleanup) { cleanup(); cleanup = null; }
  const { view, args } = parseRoute();
  let page;
  try {
    page = await view({ ...args, announce });
  } catch (error) {
    if (token !== renderToken) return;
    const kind = error instanceof ApiError && error.code === "NOT_FOUND" ? "notfound" : "error";
    page = await messageView({ kind, detail: error instanceof ApiError ? error.message : "" });
  }
  if (token !== renderToken) return; // the person already moved on to another page
  main.replaceChildren(page.element);
  cleanup = page.cleanup ?? null;
  document.title = `${page.title} | Stub`;
  // Keyboard and screen-reader users start at the top of the new page.
  const heading = main.querySelector("h1");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", render);
render();
