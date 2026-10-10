import { DomainError } from "./errors.js";
import { Queue } from "./queue.js";

// Money is always a whole number of kobo. Never decimals.
// 1 naira = 100 kobo.
export function formatNaira(kobo) {
  return "N" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });
}

function isWholeNumber(n) {
  return Number.isInteger(n);
}

export function createEvent({ id, name, city, date }) {
  if (!id || !name || !city || !date) {
    throw new DomainError("INVALID_EVENT", "An event needs id, name, city and date.");
  }
  return { id, name, city, date, tiers: new Map() };
}

export function addTier(event, { id, name, priceKobo, capacity }) {
  if (!id || !name) {
    throw new DomainError("INVALID_TIER", "A tier needs an id and a name.");
  }
  if (!isWholeNumber(priceKobo) || priceKobo < 0) {
    throw new DomainError("INVALID_PRICE", "Price must be a whole number of kobo, 0 or more.");
  }
  if (!isWholeNumber(capacity) || capacity < 1) {
    throw new DomainError("INVALID_CAPACITY", "Capacity must be a whole number, 1 or more.");
  }
  if (event.tiers.has(id)) {
    throw new DomainError("DUPLICATE_TIER", `Tier "${id}" already exists on this event.`);
  }
  const tier = { id, name, priceKobo, capacity, sold: 0, waitlist: new Queue() };
  event.tiers.set(id, tier);
  return tier;
}

export function seatsLeft(tier) {
  return tier.capacity - tier.sold;
}
