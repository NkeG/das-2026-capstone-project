import { createEvent, addTier, publishEvent, unpublishEvent } from "../events.js";
import { searchEvents } from "../search.js";
import { sortEvents } from "../sort.js";
import { DomainError } from "../errors.js";

// SERVICES layer: one function per thing a person wants to DO with events.
// A service has no HTTP in it and no storage details. It asks the rules to decide
// and asks the store (passed in) to keep things.
export function createEventService(store) {
  return {
    // If the caller gives no id, the store makes one (EV-000001, ...).
    create(input) {
      if (input !== null && typeof input === "object" && input.id === undefined) {
        input = { ...input, id: store.nextEventId() };
      }
      if (store.getEvent(input?.id)) {
        throw new DomainError("VALIDATION", `An event with id "${input.id}" already exists.`);
      }
      return store.saveEvent(createEvent(input));
    },

    get(eventId) {
      return store.requireEvent(eventId);
    },

    // If the caller gives no tier id, we use T1, T2, ... for this event.
    // updateEvent does the whole look-change-save as one step.
    addTier(eventId, tier) {
      return store.updateEvent(eventId, (event) => {
        if (tier !== null && typeof tier === "object" && tier.id === undefined) {
          let n = event.tiers.size + 1;
          while (event.tiers.has(`T${n}`)) n += 1;
          tier = { ...tier, id: `T${n}` };
        }
        return addTier(event, tier);
      });
    },

    publish(eventId) {
      return store.updateEvent(eventId, publishEvent);
    },

    unpublish(eventId) {
      return store.updateEvent(eventId, unpublishEvent);
    },

    // Search and (optionally) sort. Never changes the stored list.
    search(filters = {}, sortKey = null, direction = "asc") {
      const found = searchEvents(store.listEvents(), filters);
      return sortKey ? sortEvents(found, sortKey, direction) : found;
    },
  };
}
