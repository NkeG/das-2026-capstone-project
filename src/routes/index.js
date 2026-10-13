import { handleHealth } from "./health.js";
import { createStaticHandler } from "./static.js";
import { sendError } from "./respond.js";

// ROUTES layer: look at the address and the method, then hand over to the right handler.
// Rules of thumb for this layer: no business rules here, and no storage here.
export function createRouter({ publicDir }) {
  const serveStatic = createStaticHandler(publicDir);

  return async function route(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendError(req, res, 405, "METHOD_NOT_ALLOWED", "Only GET and HEAD are allowed here.", {
        Allow: "GET, HEAD",
      });
    }

    let url;
    try {
      url = new URL(req.url, "http://localhost");
    } catch {
      return sendError(req, res, 400, "BAD_REQUEST", "That address is not valid.");
    }

    if (url.pathname === "/health") return handleHealth(req, res);
    return serveStatic(req, res, url.pathname);
  };
}
