import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as api from "../public/js/api.js";
import { fileURLToPath } from "node:url";
import { createServer } from "../src/server.js";

let clock = 0;
beforeEach(() => {
  clock = Date.parse("2026-10-14T10:00:00Z");
  api.resetMock();
  api.configureMock({ latencyMs: 0, holdSeconds: 600, now: () => clock });
});

async function rejects(promise, code, status) {
  await assert.rejects(promise, (e) => {
    assert.ok(e instanceof api.ApiError, "should be an ApiError");
    assert.equal(e.code, code);
    if (status) assert.equal(e.status, status);
    return true;
  });
}
const seats = async (eventId, tierId) => (await api.getEvent(eventId)).event.tiers.find((t) => t.id === tierId).seatsLeft;

describe("mock API: browse, filter, sort (S05)", () => {
  test("lists published events with the real API's shape", async () => {
    const { events } = await api.listEvents();
    assert.equal(events.length, 8);
    for (const e of events) {
      assert.deepEqual(Object.keys(e).sort(), ["city", "date", "id", "status", "tiers", "title", "venue"]);
      assert.deepEqual(Object.keys(e.tiers[0]).sort(), ["capacity", "id", "name", "priceCents", "seatsLeft"]);
    }
  });
  test("filters by text, city, dates and price", async () => {
    assert.equal((await api.listEvents({ q: "JAZZ" })).events.length, 1);
    assert.equal((await api.listEvents({ city: "lagos" })).events.length, 3);
    assert.equal((await api.listEvents({ dateFrom: "2026-12-01" })).events.length, 4);
    assert.equal((await api.listEvents({ dateFrom: "2026-11-10", dateTo: "2026-11-20" })).events.length, 2);
    assert.equal((await api.listEvents({ maxPriceCents: 300000 })).events.length, 3);
    assert.equal((await api.listEvents({ minPriceCents: 1000000 })).events.length, 2);
    assert.equal((await api.listEvents({ q: "nothing like this" })).events.length, 0);
  });
  test("sorts by date, price and availability, both directions", async () => {
    const ids = async (q) => (await api.listEvents(q)).events.map((e) => e.id);
    const asc = await ids({ sort: "date", order: "asc" });
    assert.deepEqual(asc, [...asc].sort());
    assert.deepEqual(await ids({ sort: "date", order: "desc" }), [...asc].reverse());
    const prices = (await api.listEvents({ sort: "price", order: "asc" })).events.map((e) => Math.min(...e.tiers.map((t) => t.priceCents)));
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
    const left = (await api.listEvents({ sort: "availability", order: "desc" })).events.map((e) => e.tiers.reduce((s, t) => s + t.seatsLeft, 0));
    assert.deepEqual(left, [...left].sort((a, b) => b - a));
  });
  test("bad queries are refused like the real API does", async () => {
    await rejects(api.listEvents({ colour: "red" }), "VALIDATION", 400);
    await rejects(api.listEvents({ dateFrom: "2026-12-01", dateTo: "2026-11-01" }), "VALIDATION");
    await rejects(api.listEvents({ sort: "size" }), "VALIDATION");
    await rejects(api.listEvents({ order: "asc" }), "VALIDATION");
    await rejects(api.listEvents({ sort: "date", order: "up" }), "VALIDATION");
  });
  test("the page cannot change the data by editing what it was given", async () => {
    const first = await api.getEvent("EV-000001");
    first.event.tiers[0].seatsLeft = 0;
    first.event.title = "HACKED";
    const again = await api.getEvent("EV-000001");
    assert.equal(again.event.title, "Lagos Jazz Nights");
    assert.ok(again.event.tiers[0].seatsLeft > 0);
  });
  test("there is a fully sold-out event and a half sold-out event to practise on", async () => {
    const { events } = await api.listEvents();
    const total = (e) => e.tiers.reduce((s, t) => s + t.seatsLeft, 0);
    assert.ok(events.some((e) => total(e) === 0));
    assert.ok(events.some((e) => total(e) > 0 && e.tiers.some((t) => t.seatsLeft === 0)));
  });
  test("unknown event is NOT_FOUND", async () => {
    await rejects(api.getEvent("EV-999999"), "NOT_FOUND", 404);
  });
});

describe("mock API: book and pay (S06, S07)", () => {
  const good = { eventId: "EV-000001", tierId: "T1", buyerName: "  Ada  ", quantity: 2 };

  test("booking holds seats, totals in whole cents, trims the name", async () => {
    const before = await seats("EV-000001", "T1");
    const { booking } = await api.createBooking(good);
    assert.equal(booking.ref, "BK-000001");
    assert.equal(booking.buyerName, "Ada");
    assert.equal(booking.totalCents, 1600000);
    assert.equal(booking.status, "pending");
    assert.equal(booking.holdExpiresAt, "2026-10-14T10:10:00.000Z");
    assert.equal(await seats("EV-000001", "T1"), before - 2);
  });
  test("a sold-out tier cannot be booked", async () => {
    await rejects(api.createBooking({ ...good, eventId: "EV-000004", tierId: "T1" }), "SOLD_OUT", 409);
    await rejects(api.createBooking({ ...good, eventId: "EV-000008", tierId: "T2" }), "SOLD_OUT");
  });
  test("cannot book more than the seats left, and seats are not changed by the refusal", async () => {
    await rejects(api.createBooking({ ...good, eventId: "EV-000004", tierId: "T2", quantity: 7 }), "SOLD_OUT");
    assert.equal(await seats("EV-000004", "T2"), 6);
    await api.createBooking({ ...good, eventId: "EV-000004", tierId: "T2", quantity: 6 });
    assert.equal(await seats("EV-000004", "T2"), 0);
    await rejects(api.createBooking({ ...good, eventId: "EV-000004", tierId: "T2", quantity: 1 }), "SOLD_OUT");
  });
  test("bad booking requests", async () => {
    await rejects(api.createBooking({ ...good, eventId: "nope" }), "NOT_FOUND", 404);
    await rejects(api.createBooking({ ...good, tierId: "T99" }), "NOT_FOUND");
    await rejects(api.createBooking({ ...good, buyerName: "   " }), "VALIDATION", 400);
    await rejects(api.createBooking({ ...good, buyerName: 5 }), "VALIDATION");
    for (const q of [0, -1, 11, 1.5, "2", NaN, null]) await rejects(api.createBooking({ ...good, quantity: q }), "VALIDATION");
  });
  test("a declined card keeps the booking pending so the person can try again", async () => {
    const { booking } = await api.createBooking(good);
    await rejects(api.payBooking(booking.ref, { cardNumber: "4000 0000 0000 0002" }), "PAYMENT_DECLINED", 402);
    assert.equal((await api.getBooking(booking.ref)).booking.status, "pending");
    const paid = await api.payBooking(booking.ref, { cardNumber: "4242 4242 4242 4242" });
    assert.equal(paid.booking.status, "paid");
  });
  test("cannot pay twice", async () => {
    const { booking } = await api.createBooking(good);
    await api.payBooking(booking.ref, { cardNumber: "4242424242424242" });
    await rejects(api.payBooking(booking.ref, { cardNumber: "4242424242424242" }), "INVALID_STATE", 409);
  });
  test("the booking answer never contains card details", async () => {
    const { booking } = await api.createBooking(good);
    const paid = await api.payBooking(booking.ref, { cardNumber: "4242 4242 4242 4242" });
    assert.ok(!JSON.stringify(paid).includes("4242"));
  });
  test("unpaid booking: time runs out -> expired, seats come back, payment refused", async () => {
    const before = await seats("EV-000001", "T1");
    const { booking } = await api.createBooking(good);
    clock += 599_000;
    assert.equal((await api.getBooking(booking.ref)).booking.status, "pending");
    clock += 1_000;
    assert.equal((await api.getBooking(booking.ref)).booking.status, "expired");
    assert.equal(await seats("EV-000001", "T1"), before);
    await rejects(api.payBooking(booking.ref, { cardNumber: "4242424242424242" }), "INVALID_STATE");
  });
  test("expiry is noticed even if the person presses Pay at the last moment", async () => {
    const { booking } = await api.createBooking(good);
    clock += 700_000;
    await rejects(api.payBooking(booking.ref, { cardNumber: "4242424242424242" }), "INVALID_STATE");
    assert.equal((await api.getBooking(booking.ref)).booking.status, "expired");
  });
  test("a paid booking does not expire", async () => {
    const { booking } = await api.createBooking(good);
    await api.payBooking(booking.ref, { cardNumber: "4242424242424242" });
    clock += 10_000_000;
    assert.equal((await api.getBooking(booking.ref)).booking.status, "paid");
  });
  test("cancel gives seats back once, and a paid booking cannot be cancelled", async () => {
    const before = await seats("EV-000001", "T1");
    const { booking } = await api.createBooking(good);
    await api.cancelBooking(booking.ref);
    await api.cancelBooking(booking.ref); // second time changes nothing
    assert.equal(await seats("EV-000001", "T1"), before);
    const other = (await api.createBooking(good)).booking;
    await api.payBooking(other.ref, { cardNumber: "4242424242424242" });
    await rejects(api.cancelBooking(other.ref), "INVALID_STATE", 409);
    await rejects(api.cancelBooking("BK-404"), "NOT_FOUND");
  });
  test("a free tier books for 0 cents", async () => {
    const { booking } = await api.createBooking({ ...good, eventId: "EV-000005", tierId: "T1" });
    assert.equal(booking.totalCents, 0);
  });
});

describe("mock API has the SAME shape as the real server (so Build 7 can swap them)", () => {
  test("event, booking and error shapes match the real REST API", async () => {
    const server = createServer({ publicDir: fileURLToPath(new URL("../public", import.meta.url)) });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (method, path, body) => {
      const res = await fetch(base + path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      return { status: res.status, json: await res.json() };
    };
    try {
      const ev = (await call("POST", "/api/events", { title: "T", city: "Lagos", venue: "V", date: "2026-12-01" })).json.event;
      await call("POST", `/api/events/${ev.id}/tiers`, { name: "G", priceCents: 1000, capacity: 1 });
      await call("POST", `/api/events/${ev.id}/publish`);
      const realEvent = (await call("GET", `/api/events/${ev.id}`)).json.event;
      const realBooking = (await call("POST", "/api/bookings", { eventId: ev.id, tierId: "T1", buyerName: "A", quantity: 1 })).json.booking;
      const realSold = (await call("POST", "/api/bookings", { eventId: ev.id, tierId: "T1", buyerName: "A", quantity: 1 }));
      const realDecline = await call("POST", `/api/bookings/${realBooking.ref}/pay`, { paymentToken: "tok_declined" });

      const mockEvent = (await api.getEvent("EV-000001")).event;
      const mockBooking = (await api.createBooking({ eventId: "EV-000001", tierId: "T1", buyerName: "A", quantity: 1 })).booking;
      const mockDecline = await api.payBooking(mockBooking.ref, { cardNumber: "4000000000000002" }).catch((e) => e);
      const mockSold = await api.createBooking({ eventId: "EV-000004", tierId: "T1", buyerName: "A", quantity: 1 }).catch((e) => e);

      assert.deepEqual(Object.keys(mockEvent).sort(), Object.keys(realEvent).sort());
      assert.deepEqual(Object.keys(mockEvent.tiers[0]).sort(), Object.keys(realEvent.tiers[0]).sort());
      // The mock booking has ONE extra field: when the hold runs out. The real API gets it in a later build.
      assert.deepEqual(Object.keys(mockBooking).filter((k) => !(k in realBooking)), ["holdExpiresAt"]);
      assert.deepEqual(Object.keys(realBooking).filter((k) => !(k in mockBooking)), []);
      assert.equal(mockBooking.status, realBooking.status);
      assert.equal(realDecline.status, mockDecline.status);
      assert.equal(realDecline.json.error.code, mockDecline.code);
      assert.equal(realSold.status, mockSold.status);
      assert.equal(realSold.json.error.code, mockSold.code);
    } finally {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  });
});
