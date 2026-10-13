import { DomainError } from "../errors.js";
import { nextState } from "../bookingStates.js";
import { chargeMock } from "../payment.js";

// SERVICES layer: what an attendee wants to DO with bookings.
export function createBookingService(store) {
  function find(ref) {
    const booking = store.bookings.find(ref);
    if (!booking) throw new DomainError("NOT_FOUND", `No booking with code ${ref}.`);
    return booking;
  }

  // The caller only knows the booking code. We find its event for them.
  function cancel(ref) {
    const booking = find(ref);
    return store.bookings.cancel(store.requireEvent(booking.eventId), ref);
  }

  return {
    book(eventId, tierId, buyerName, quantity) {
      if (typeof eventId !== "string" || typeof tierId !== "string") {
        throw new DomainError("VALIDATION", "A booking needs an eventId and a tierId.");
      }
      return store.bookings.book(store.requireEvent(eventId), tierId, buyerName, quantity);
    },

    find,

    // S07: pay with the mock payment.
    // Order matters: first ask the state machine "is paying allowed?", then charge,
    // then change the booking. A declined payment therefore leaves it pending.
    pay(ref, paymentToken) {
      const booking = find(ref);
      nextState(booking.status, "PAY");
      chargeMock(paymentToken);
      return store.bookings.pay(ref);
    },

    cancel,

    // The API only cancels UNPAID bookings. A paid one needs a refund (Build 8).
    cancelUnpaid(ref) {
      const booking = find(ref);
      if (booking.status === "paid") {
        throw new DomainError(
          "INVALID_STATE",
          "A paid booking needs a refund. Refunds are built in Build 8."
        );
      }
      return cancel(ref);
    },
  };
}
