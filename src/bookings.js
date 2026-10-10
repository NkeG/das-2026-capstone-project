import { DomainError } from "./errors.js";
import { seatsLeft } from "./events.js";

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
      throw new DomainError("TIER_NOT_FOUND", `No tier "${tierId}" on this event.`);
    }
    return tier;
  }

  // Capacity rule: you only get seats if enough are left. All or nothing.
  book(event, tierId, buyerName, quantity = 1) {
    if (!buyerName) {
      throw new DomainError("INVALID_BOOKING", "A booking needs a buyer name.");
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new DomainError("INVALID_QUANTITY", "Quantity must be a whole number, 1 or more.");
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
      totalKobo: tier.priceKobo * quantity,
      status: "confirmed",
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
  // (Build 8 will turn this into a timed offer.)
  cancel(event, ref) {
    const booking = this.#byRef.get(ref);
    if (!booking) {
      throw new DomainError("BOOKING_NOT_FOUND", `No booking with code ${ref}.`);
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
    if (!name) {
      throw new DomainError("INVALID_WAITLIST", "A waitlist entry needs a name.");
    }
    const tier = this.#getTier(event, tierId);
    if (seatsLeft(tier) > 0) {
      throw new DomainError(
        "NOT_SOLD_OUT",
        `${tier.name} still has ${seatsLeft(tier)} seats. Book instead of waiting.`
      );
    }
    tier.waitlist.enqueue({ name, joinedAt: tier.waitlist.size + 1 });
    return tier.waitlist.size; // your place in line
  }

  // Only used by the benchmark, to compare against Map.
  toArray() {
    return [...this.#byRef.values()];
  }
}
