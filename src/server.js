import http from "node:http";
import { createRouter } from "./routes/index.js";
import { sendError } from "./routes/respond.js";

// The server only wires things together. It does not decide anything itself.
// It does not start listening: start.js does that, and the tests do it their own way.
export function createServer({ publicDir }) {
  const route = createRouter({ publicDir });

  return http.createServer((req, res) => {
    Promise.resolve(route(req, res)).catch((err) => {
      console.error(err);
      if (!res.headersSent) {
        sendError(req, res, 500, "INTERNAL", "Something went wrong on the server.");
      } else {
        res.end();
      }
    });
  });
}
