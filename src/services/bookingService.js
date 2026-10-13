import { DomainError } from "../errors.js";

// SERVICES layer: what an attendee wants to DO with bookings.
export function createBookingService(store) {
  return {
    book(eventId, tierId, buyerName, quantity) {
      return store.bookings.book(store.requireEvent(eventId), tierId, buyerName, quantity);
    },

    find(ref) {
      const booking = store.bookings.find(ref);
      if (!booking) throw new DomainError("NOT_FOUND", `No booking with code ${ref}.`);
      return booking;
    },

    pay(ref) {
      return store.bookings.pay(ref);
    },

    // The caller only knows the booking code. We find its event for them.
    cancel(ref) {
      const booking = this.find(ref);
      return store.bookings.cancel(store.requireEvent(booking.eventId), ref);
    },
  };
}
