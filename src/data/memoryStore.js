import { BookingBook } from "../bookings.js";
import { DomainError } from "../errors.js";

// DATA layer: the one place that keeps things.
// Right now everything lives in memory, so it is gone when the server stops.
// Build 5 replaces this with SQLite. Only this layer should need to change.
//
// Known shortcut: the BookingBook (a rules file) still keeps its own Map of bookings.
// Build 5 moves that storage here, too.
export function createMemoryStore() {
  const events = new Map();
  const bookings = new BookingBook();
  let eventCounter = 0;

  return {
    bookings,

    // The server hands out event ids: EV-000001, EV-000002, ...
    nextEventId() {
      eventCounter += 1;
      return `EV-${String(eventCounter).padStart(6, "0")}`;
    },

    saveEvent(event) {
      events.set(event.id, event);
      return event;
    },

    getEvent(id) {
      return events.get(id);
    },

    // Like getEvent, but a missing event is an error.
    requireEvent(id) {
      const event = events.get(id);
      if (!event) throw new DomainError("NOT_FOUND", `No event with id "${id}".`);
      return event;
    },

    listEvents() {
      return [...events.values()];
    },
  };
}
