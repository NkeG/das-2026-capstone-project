import { fileURLToPath } from "node:url";
import { createServer } from "./src/server.js";

const publicDir = fileURLToPath(new URL("./public", import.meta.url));
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`PORT must be a whole number from 1 to 65535. You gave: ${process.env.PORT}`);
  process.exit(1);
}

const server = createServer({ publicDir });

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Close the other server, or pick another port.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(port, () => {
  console.log(`Server is running.`);
  console.log(`  Website: http://localhost:${port}/`);
  console.log(`  Health:  http://localhost:${port}/health`);
  console.log(`Press Ctrl + C to stop.`);
});

process.on("SIGINT", () => {
  console.log("\nStopping the server.");
  server.close(() => process.exit(0));
  server.closeAllConnections();
});
