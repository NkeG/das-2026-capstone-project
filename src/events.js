import { DomainError } from "./errors.js";
import { Queue } from "./queue.js";

// Money is always a whole number of cents. Never decimals.
// 100 cents = 1 naira.
export function formatMoney(cents) {
  return "N" + (cents / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });
}

function isWholeNumber(n) {
  return Number.isInteger(n);
}

function isFilled(text) {
  return typeof text === "string" && text.trim() !== "";
}

// Dates are written as YYYY-MM-DD, like 2026-12-05.
// This format sorts correctly as plain text, which keeps search and sort simple.
export function isValidIsoDate(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(text + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

// S02: an event has a title, city, venue and date. It starts as a draft.
export function createEvent({ id, title, city, venue, date }) {
  if (!isFilled(id) || !isFilled(title) || !isFilled(city) || !isFilled(venue)) {
    throw new DomainError("VALIDATION", "An event needs an id, title, city and venue.");
  }
  if (!isValidIsoDate(date)) {
    throw new DomainError("VALIDATION", "The date must look like 2026-12-05.");
  }
  return { id, title, city, venue, date, status: "draft", tiers: new Map() };
}

// S03: a tier has a price (whole cents) and a capacity (whole seats).
export function addTier(event, { id, name, priceCents, capacity }) {
  if (!isFilled(id) || !isFilled(name)) {
    throw new DomainError("VALIDATION", "A tier needs an id and a name.");
  }
  if (!isWholeNumber(priceCents) || priceCents < 0) {
    throw new DomainError("VALIDATION", "Price must be a whole number of cents, 0 or more.");
  }
  if (!isWholeNumber(capacity) || capacity < 1) {
    throw new DomainError("VALIDATION", "Capacity must be a whole number, 1 or more.");
  }
  if (event.tiers.has(id)) {
    throw new DomainError("VALIDATION", `Tier "${id}" already exists on this event.`);
  }
  const tier = { id, name, priceCents, capacity, sold: 0, waitlist: new Queue() };
  event.tiers.set(id, tier);
  return tier;
}

// S04: publish and unpublish.
// An event with no tiers has nothing to sell, so it cannot be published.
export function publishEvent(event) {
  if (event.tiers.size < 1) {
    throw new DomainError("VALIDATION", "Add at least one ticket tier before publishing.");
  }
  event.status = "published";
  return event;
}

export function unpublishEvent(event) {
  event.status = "draft";
  return event;
}

export function seatsLeft(tier) {
  return tier.capacity - tier.sold;
}

// Total seats left across every tier of an event.
export function eventSeatsLeft(event) {
  let total = 0;
  for (const tier of event.tiers.values()) total += seatsLeft(tier);
  return total;
}

// The cheapest tier price. null if the event has no tiers.
export function lowestPriceCents(event) {
  let lowest = null;
  for (const tier of event.tiers.values()) {
    if (lowest === null || tier.priceCents < lowest) lowest = tier.priceCents;
  }
  return lowest;
}
