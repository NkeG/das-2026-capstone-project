import { DomainError } from "./errors.js";
import { seatsLeft } from "./events.js";

// S06 says a booking is for 1 to 10 tickets.
export const MAX_PER_BOOKING = 10;

// The BookingBook keeps every booking in a Map, keyed by reference code.
// Map lookup by key is O(1): it goes straight to the answer.
// Array.find is O(n): it checks one booking after another.
export class BookingBook {
  #byRef = new Map();
  #counter = 0;

  get size() {
    return this.#byRef.size;
  }

  #nextRef() {
    this.#counter++;
    return "BK-" + String(this.#counter).padStart(6, "0");
  }

  #getTier(event, tierId) {
    const tier = event.tiers.get(tierId);
    if (!tier) {
      throw new DomainError("NOT_FOUND", `No tier "${tierId}" on this event.`);
    }
    return tier;
  }

  // S06: book tickets.
  // Capacity rule: you only get seats if enough are left. All or nothing.
  // A new booking is "pending". Payment (which confirms it) comes in a later build.
  book(event, tierId, buyerName, quantity = 1) {
    if (typeof buyerName !== "string" || buyerName.trim() === "") {
      throw new DomainError("VALIDATION", "A booking needs a buyer name.");
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PER_BOOKING) {
      throw new DomainError(
        "VALIDATION",
        `Quantity must be a whole number from 1 to ${MAX_PER_BOOKING}.`
      );
    }
    if (event.status !== "published") {
      throw new DomainError("NOT_PUBLISHED", "This event is not published, so it cannot be booked.");
    }
    const tier = this.#getTier(event, tierId);
    if (quantity > seatsLeft(tier)) {
      throw new DomainError(
        "SOLD_OUT",
        `Not enough seats in ${tier.name}: ${seatsLeft(tier)} left, ${quantity} wanted.`
      );
    }
    tier.sold += quantity;
    const booking = {
      ref: this.#nextRef(),
      eventId: event.id,
      tierId,
      buyerName,
      quantity,
      totalCents: tier.priceCents * quantity,
      status: "pending",
    };
    this.#byRef.set(booking.ref, booking);
    return booking;
  }

  // Fast lookup by reference code. O(1).
  find(ref) {
    return this.#byRef.get(ref);
  }

  // Cancel a booking. The seats go back. If someone is waiting,
  // the person at the FRONT of the line is named and leaves the line.
  // (A later build will turn this into a timed offer.)
  cancel(event, ref) {
    const booking = this.#byRef.get(ref);
    if (!booking) {
      throw new DomainError("NOT_FOUND", `No booking with code ${ref}.`);
    }
    if (booking.status === "cancelled") {
      throw new DomainError("ALREADY_CANCELLED", `Booking ${ref} is already cancelled.`);
    }
    const tier = this.#getTier(event, booking.tierId);
    booking.status = "cancelled";
    tier.sold -= booking.quantity; // seats released exactly once, because of the check above
    const nextInLine = tier.waitlist.dequeue() ?? null;
    return { booking, nextInLine };
  }

  // Only a sold-out tier has a waitlist.
  joinWaitlist(event, tierId, name) {
    if (typeof name !== "string" || name.trim() === "") {
      throw new DomainError("VALIDATION", "A waitlist entry needs a name.");
    }
    const tier = this.#getTier(event, tierId);
    if (seatsLeft(tier) > 0) {
      throw new DomainError(
        "NOT_SOLD_OUT",
        `${tier.name} still has ${seatsLeft(tier)} seats. Book instead of waiting.`
      );
    }
    tier.waitlist.enqueue({ name });
    return tier.waitlist.size; // your place in line
  }

  // Only used by the benchmark, to compare against Map.
  toArray() {
    return [...this.#byRef.values()];
  }
}
