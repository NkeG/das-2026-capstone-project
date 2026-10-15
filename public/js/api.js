// ============================================================================
// THE ONE DATA FILE.
// Every page of the website gets its data from THIS file and nowhere else.
// Right now it answers from fake (mock) data kept in memory.
// In Build 7 only the inside of these functions changes: they will call the real
// server with fetch("/api/..."). The pages stay exactly the same.
//
// The answers have the SAME SHAPE as the real REST API from Build 4/5:
//   event:   { id, title, city, venue, date, status, tiers: [{ id, name, priceCents, capacity, seatsLeft }] }
//   booking: { ref, eventId, tierId, buyerName, quantity, totalCents, status }
//   error:   throws ApiError with .code and .status (like { error: { code, message } })
// Money is whole cents (kobo).
// ============================================================================

export const MAX_PER_BOOKING = 10; // same limit as the server
export const DECLINED_TEST_CARD = "4000000000000002";
export const SUCCESS_TEST_CARD = "4242424242424242";

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const STATUS = {
  VALIDATION: 400,
  PAYMENT_DECLINED: 402,
  NOT_FOUND: 404,
  SOLD_OUT: 409,
  INVALID_STATE: 409,
};
function fail(code, message) {
  return new ApiError(code, message, STATUS[code] ?? 500);
}

// ---------------------------------------------------------------- fake data
function tier(id, name, priceCents, capacity, sold) {
  return { id, name, priceCents, capacity, sold };
}

function seedEvents() {
  return [
    { id: "EV-000001", title: "Lagos Jazz Nights", city: "Lagos", venue: "Terra Hall, Victoria Island", date: "2026-11-07", status: "published",
      tiers: [tier("T1", "General", 800000, 200, 57), tier("T2", "VIP table", 2500000, 40, 28)] },
    { id: "EV-000002", title: "Abuja Tech Summit 2026", city: "Abuja", venue: "Capital Conference Hall", date: "2026-11-12", status: "published",
      tiers: [tier("T1", "Student", 500000, 150, 150), tier("T2", "Standard", 1800000, 400, 211), tier("T3", "Workshop pass", 4500000, 60, 49)] },
    { id: "EV-000003", title: "Kano Heritage Durbar Walk", city: "Kano", venue: "Emir's Palace Square", date: "2026-11-14", status: "published",
      tiers: [tier("T1", "Walk-in", 200000, 500, 120)] },
    { id: "EV-000004", title: "Ibadan Stand-up Night", city: "Ibadan", venue: "Cultural Centre Mokola", date: "2026-11-21", status: "published",
      tiers: [tier("T1", "Regular", 300000, 120, 120), tier("T2", "Front row", 1000000, 24, 18)] },
    { id: "EV-000005", title: "Port Harcourt Food Festival", city: "Port Harcourt", venue: "Garden City Grounds", date: "2026-12-05", status: "published",
      tiers: [tier("T1", "Free entry", 0, 1000, 640), tier("T2", "Tasting pass", 1500000, 150, 90)] },
    { id: "EV-000006", title: "Enugu Gospel Concert", city: "Enugu", venue: "Coal City Arena", date: "2026-12-12", status: "published",
      tiers: [tier("T1", "Regular", 500000, 800, 355), tier("T2", "Gold", 2000000, 100, 94)] },
    { id: "EV-000007", title: "Lagos Comedy Cruise", city: "Lagos", venue: "Marina Jetty, Lagos Island", date: "2026-12-19", status: "published",
      tiers: [tier("T1", "Deck", 1200000, 90, 31), tier("T2", "Captain's table", 3500000, 16, 3)] },
    { id: "EV-000008", title: "Detty December Beach Party", city: "Lagos", venue: "Landmark Beach, Oniru", date: "2026-12-26", status: "published",
      tiers: [tier("T1", "Early bird", 1000000, 300, 300), tier("T2", "Regular", 1500000, 500, 500)] },
  ];
}

// ------------------------------------------------------------------ settings
// Tests (and the demo link ?hold=20) can change these. Real life never calls configureMock.
let settings = { latencyMs: 120, holdSeconds: 600, now: () => Date.now() };
let events = seedEvents();
let bookings = new Map();
let bookingCounter = 0;

export function configureMock(change = {}) {
  settings = { ...settings, ...change };
}
export function resetMock() {
  events = seedEvents();
  bookings = new Map();
  bookingCounter = 0;
}

async function pause() {
  if (settings.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, settings.latencyMs));
}

// ------------------------------------------------------------------- helpers
function eventView(event) {
  return {
    id: event.id, title: event.title, city: event.city, venue: event.venue, date: event.date, status: event.status,
    tiers: event.tiers.map((t) => ({ id: t.id, name: t.name, priceCents: t.priceCents, capacity: t.capacity, seatsLeft: t.capacity - t.sold })),
  };
}
function bookingView(b) {
  return { ref: b.ref, eventId: b.eventId, tierId: b.tierId, buyerName: b.buyerName, quantity: b.quantity,
    totalCents: b.totalCents, status: b.status, holdExpiresAt: b.holdExpiresAt };
}
const lowestPrice = (e) => Math.min(...e.tiers.map((t) => t.priceCents));
const seatsLeftTotal = (e) => e.tiers.reduce((sum, t) => sum + (t.capacity - t.sold), 0);

function releaseSeats(booking) {
  const event = events.find((e) => e.id === booking.eventId);
  const t = event?.tiers.find((x) => x.id === booking.tierId);
  if (t) t.sold -= booking.quantity;
}

// A pending booking whose hold ran out becomes "expired" and gives its seats back.
function expireIfLate(booking) {
  if (booking.status === "pending" && settings.now() >= Date.parse(booking.holdExpiresAt)) {
    booking.status = "expired";
    releaseSeats(booking);
  }
}

const SORT_KEYS = { date: (e) => e.date, price: lowestPrice, availability: seatsLeftTotal };

// ---------------------------------------------------------------- the calls
// GET /api/events
export async function listEvents(query = {}) {
  await pause();
  const allowed = ["q", "city", "dateFrom", "dateTo", "minPriceCents", "maxPriceCents", "sort", "order"];
  for (const key of Object.keys(query)) {
    if (!allowed.includes(key)) throw fail("VALIDATION", `Unknown filter: ${key}.`);
  }
  const { q, city, dateFrom, dateTo, minPriceCents, maxPriceCents, sort, order } = query;
  if (dateFrom && dateTo && dateFrom > dateTo) throw fail("VALIDATION", "dateFrom cannot be after dateTo.");
  if (sort != null && !(sort in SORT_KEYS)) throw fail("VALIDATION", "sort must be date, price or availability.");
  if (order != null && sort == null) throw fail("VALIDATION", "order needs sort.");
  if (order != null && order !== "asc" && order !== "desc") throw fail("VALIDATION", "order must be asc or desc.");

  const needle = (q ?? "").trim().toLowerCase();
  const wantedCity = (city ?? "").trim().toLowerCase();
  let found = events.filter((e) => {
    if (e.status !== "published") return false;
    if (needle && !`${e.title} ${e.city} ${e.venue}`.toLowerCase().includes(needle)) return false;
    if (wantedCity && e.city.toLowerCase() !== wantedCity) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    if (minPriceCents != null && lowestPrice(e) < minPriceCents) return false;
    if (maxPriceCents != null && lowestPrice(e) > maxPriceCents) return false;
    return true;
  });
  if (sort) {
    const key = SORT_KEYS[sort];
    const direction = order === "desc" ? -1 : 1;
    // Array.sort is stable, so events that tie keep their order.
    found = found.slice().sort((a, b) => (key(a) < key(b) ? -direction : key(a) > key(b) ? direction : 0));
  }
  return { events: found.map(eventView) };
}

// GET /api/events/:eventId
export async function getEvent(eventId) {
  await pause();
  const event = events.find((e) => e.id === eventId);
  if (!event) throw fail("NOT_FOUND", "We cannot find that event.");
  return { event: eventView(event) };
}

// POST /api/bookings
export async function createBooking({ eventId, tierId, buyerName, quantity }) {
  await pause();
  const event = events.find((e) => e.id === eventId && e.status === "published");
  if (!event) throw fail("NOT_FOUND", "We cannot find that event.");
  const t = event.tiers.find((x) => x.id === tierId);
  if (!t) throw fail("NOT_FOUND", "We cannot find that ticket type.");
  if (typeof buyerName !== "string" || buyerName.trim() === "") throw fail("VALIDATION", "Enter the name for the booking.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PER_BOOKING) {
    throw fail("VALIDATION", `Choose between 1 and ${MAX_PER_BOOKING} tickets.`);
  }
  const left = t.capacity - t.sold;
  if (quantity > left) {
    throw fail("SOLD_OUT", left === 0 ? `${t.name} is sold out.` : `Only ${left} ${t.name} ${left === 1 ? "ticket is" : "tickets are"} left.`);
  }
  t.sold += quantity;
  bookingCounter += 1;
  const booking = {
    ref: `BK-${String(bookingCounter).padStart(6, "0")}`,
    eventId, tierId, buyerName: buyerName.trim(), quantity,
    totalCents: t.priceCents * quantity,
    status: "pending",
    holdExpiresAt: new Date(settings.now() + settings.holdSeconds * 1000).toISOString(),
  };
  bookings.set(booking.ref, booking);
  return { booking: bookingView(booking) };
}

// GET /api/bookings/:ref
export async function getBooking(ref) {
  await pause();
  const booking = bookings.get(ref);
  if (!booking) throw fail("NOT_FOUND", "We cannot find that booking.");
  expireIfLate(booking);
  return { booking: bookingView(booking) };
}

// The website never sends card numbers to the server. It turns the card into a "token" first.
// (A real payment company does this step in the browser. Our mock does it here.)
// Test cards: 4242 4242 4242 4242 works. 4000 0000 0000 0002 is declined.
function cardToToken(cardNumber) {
  return String(cardNumber).replace(/\D/g, "") === DECLINED_TEST_CARD ? "tok_declined" : "tok_success";
}

// POST /api/bookings/:ref/pay   (the server call only ever receives { paymentToken })
export async function payBooking(ref, { cardNumber }) {
  await pause();
  const booking = bookings.get(ref);
  if (!booking) throw fail("NOT_FOUND", "We cannot find that booking.");
  expireIfLate(booking);
  if (booking.status !== "pending") {
    throw fail("INVALID_STATE", booking.status === "expired" ? "This booking ran out of time. Your seats were released." : `This booking is already ${booking.status}.`);
  }
  if (cardToToken(cardNumber) === "tok_declined") {
    throw fail("PAYMENT_DECLINED", "The card was declined.");
  }
  booking.status = "paid";
  return { booking: bookingView(booking) };
}

// POST /api/bookings/:ref/cancel   (unpaid bookings only)
export async function cancelBooking(ref) {
  await pause();
  const booking = bookings.get(ref);
  if (!booking) throw fail("NOT_FOUND", "We cannot find that booking.");
  expireIfLate(booking);
  if (booking.status === "paid") throw fail("INVALID_STATE", "A paid booking needs a refund.");
  if (booking.status === "pending") {
    booking.status = "cancelled";
    releaseSeats(booking);
  }
  return { booking: bookingView(booking) };
}
