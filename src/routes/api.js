import { sendJson, sendError } from "./respond.js";
import { sendCaughtError, HttpProblem } from "./errors.js";
import { readJsonBody } from "./body.js";
import { presentEvent, presentTier, presentBooking } from "./present.js";

// ROUTES layer: the REST API.
// A route only (1) reads the request, (2) asks a service to do the work,
// (3) sends the answer. No business rules live here.

const QUERY_NAMES = ["q", "city", "dateFrom", "dateTo", "minPriceCents", "maxPriceCents", "sort", "order"];

// "500000" -> 500000. Anything that is not plain digits is a validation problem.
function wholeNumberParam(name, text) {
  if (!/^\d{1,15}$/.test(text)) {
    throw new HttpProblem("VALIDATION", `${name} must be a whole number of cents, 0 or more.`);
  }
  return Number(text);
}

function readSearchQuery(searchParams) {
  const seen = new Set();
  for (const name of searchParams.keys()) {
    if (!QUERY_NAMES.includes(name)) {
      throw new HttpProblem("VALIDATION", `Unknown search option "${name}". Allowed: ${QUERY_NAMES.join(", ")}.`);
    }
    if (seen.has(name)) {
      throw new HttpProblem("VALIDATION", `Search option "${name}" was given more than once.`);
    }
    seen.add(name);
  }
  const get = (name) => (searchParams.has(name) ? searchParams.get(name) : undefined);

  const filters = {
    text: get("q"),
    city: get("city"),
    dateFrom: get("dateFrom"),
    dateTo: get("dateTo"),
  };
  for (const name of ["minPriceCents", "maxPriceCents"]) {
    if (searchParams.has(name)) filters[name] = wholeNumberParam(name, searchParams.get(name));
  }
  return { filters, sort: get("sort"), order: get("order") };
}

export function createApiHandler({ services }) {
  const { events, bookings } = services;

  // The route table: method + pattern -> what to do.
  // Each handler returns { status, body, headers? }.
  const table = [
    {
      method: "GET",
      pattern: "/api/events",
      run: ({ url }) => {
        const { filters, sort, order } = readSearchQuery(url.searchParams);
        if (order !== undefined && sort === undefined) {
          throw new HttpProblem("VALIDATION", "order needs a sort option (date, price or availability).");
        }
        const found = events.search(filters, sort ?? null, order ?? "asc");
        return { status: 200, body: { events: found.map(presentEvent) } };
      },
    },
    {
      method: "POST",
      pattern: "/api/events",
      run: async ({ req }) => {
        const input = await readJsonBody(req);
        delete input.id; // the server chooses event ids, never the client
        const event = events.create(input);
        return {
          status: 201,
          headers: { Location: `/api/events/${event.id}` },
          body: { event: presentEvent(event) },
        };
      },
    },
    {
      method: "GET",
      pattern: "/api/events/:eventId",
      run: ({ params }) => ({ status: 200, body: { event: presentEvent(events.get(params.eventId)) } }),
    },
    {
      method: "POST",
      pattern: "/api/events/:eventId/tiers",
      run: async ({ req, params }) => {
        const input = await readJsonBody(req);
        const tier = events.addTier(params.eventId, input);
        return { status: 201, body: { tier: presentTier(tier) } };
      },
    },
    {
      method: "POST",
      pattern: "/api/events/:eventId/publish",
      run: ({ params }) => ({ status: 200, body: { event: presentEvent(events.publish(params.eventId)) } }),
    },
    {
      method: "POST",
      pattern: "/api/events/:eventId/unpublish",
      run: ({ params }) => ({ status: 200, body: { event: presentEvent(events.unpublish(params.eventId)) } }),
    },
    {
      method: "POST",
      pattern: "/api/bookings",
      run: async ({ req }) => {
        const { eventId, tierId, buyerName, quantity } = await readJsonBody(req);
        const booking = bookings.book(eventId, tierId, buyerName, quantity);
        return {
          status: 201,
          headers: { Location: `/api/bookings/${booking.ref}` },
          body: { booking: presentBooking(booking) },
        };
      },
    },
    {
      method: "GET",
      pattern: "/api/bookings/:ref",
      run: ({ params }) => ({ status: 200, body: { booking: presentBooking(bookings.find(params.ref)) } }),
    },
    {
      method: "POST",
      pattern: "/api/bookings/:ref/pay",
      run: async ({ req, params }) => {
        const { paymentToken } = await readJsonBody(req);
        return { status: 200, body: { booking: presentBooking(bookings.pay(params.ref, paymentToken)) } };
      },
    },
    {
      method: "POST",
      pattern: "/api/bookings/:ref/cancel",
      run: ({ params }) => {
        // Never send back the waitlist hand-over: it holds other people's names.
        const { booking } = bookings.cancelUnpaid(params.ref);
        return { status: 200, body: { booking: presentBooking(booking) } };
      },
    },
  ].map((r) => ({ ...r, parts: r.pattern.split("/") }));

  // Does this path match the pattern? Gives back the :params, or null.
  function match(parts, pathParts) {
    if (parts.length !== pathParts.length) return null;
    const params = {};
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(":")) {
        try {
          params[parts[i].slice(1)] = decodeURIComponent(pathParts[i]);
        } catch {
          return null;
        }
      } else if (parts[i] !== pathParts[i]) {
        return null;
      }
    }
    return params;
  }

  return async function handleApi(req, res, url) {
    try {
      // A trailing slash is the same address: /api/events/ = /api/events
      const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : url.pathname;
      const pathParts = path.split("/");
      const method = req.method === "HEAD" ? "GET" : req.method;

      const allowed = [];
      for (const route of table) {
        const params = match(route.parts, pathParts);
        if (!params) continue;
        allowed.push(route.method);
        if (route.method !== method) continue;

        const result = await route.run({ req, url, params });
        return sendJson(req, res, result.status, result.body, result.headers);
      }

      if (allowed.length > 0) {
        const list = [...new Set(allowed.flatMap((m) => (m === "GET" ? ["GET", "HEAD"] : [m])))].join(", ");
        return sendError(req, res, 405, "METHOD_NOT_ALLOWED", `Use ${list} for this address.`, { Allow: list });
      }
      return sendError(req, res, 404, "NOT_FOUND", "There is no API address like that.");
    } catch (err) {
      return sendCaughtError(req, res, err);
    }
  };
}
