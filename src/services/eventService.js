import { createEvent, addTier, publishEvent, unpublishEvent } from "../events.js";
import { searchEvents } from "../search.js";
import { sortEvents } from "../sort.js";
import { DomainError } from "../errors.js";

// SERVICES layer: one function per thing a person wants to DO with events.
// A service has no HTTP in it and no storage details. It asks the rules to decide
// and asks the store (passed in) to keep things.
export function createEventService(store) {
  return {
    create(input) {
      if (store.getEvent(input?.id)) {
        throw new DomainError("VALIDATION", `An event with id "${input.id}" already exists.`);
      }
      return store.saveEvent(createEvent(input));
    },

    addTier(eventId, tier) {
      return addTier(store.requireEvent(eventId), tier);
    },

    publish(eventId) {
      return publishEvent(store.requireEvent(eventId));
    },

    unpublish(eventId) {
      return unpublishEvent(store.requireEvent(eventId));
    },

    // Search and (optionally) sort. Never changes the stored list.
    search(filters = {}, sortKey = null, direction = "asc") {
      const found = searchEvents(store.listEvents(), filters);
      return sortKey ? sortEvents(found, sortKey, direction) : found;
    },
  };
}
