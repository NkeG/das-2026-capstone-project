import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "../src/server.js";

// Replays EVERY curl example in docs/api-examples.md against a fresh test server,
// in order, and checks the status and the JSON answer match what the page says.
// If the code changes and the page is not updated, this test fails.

const root = fileURLToPath(new URL("../", import.meta.url));
const publicDir = fileURLToPath(new URL("../public", import.meta.url));
const doc = fs.readFileSync(root + "docs/api-examples.md", "utf8");

// Split a command line into words. Double quotes keep words together.
function words(line) {
  return [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);
}

// Each example is: ### title, a ``` curl command ```, "Expected: **NNN ...**", a ```json answer```.
const examples = [...doc.matchAll(/### (\d+)\. (.+?)\n[\s\S]*?```\n(curl .+?)\n```\s+Expected: \*\*(\d{3}) [^*]+\*\*\s+```json\n([\s\S]+?)\n```/g)].map((m) => ({
  number: Number(m[1]),
  title: m[2],
  command: words(m[3]),
  status: Number(m[4]),
  json: JSON.parse(m[5]),
}));

let server;
let base;
before(async () => {
  server = createServer({ publicDir });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test("the page has examples, numbered 1, 2, 3... with no gaps", () => {
  assert.ok(examples.length >= 20, `found only ${examples.length} examples`);
  examples.forEach((ex, i) => assert.equal(ex.number, i + 1));
  const headings = [...doc.matchAll(/^### \d+\./gm)].length;
  assert.equal(examples.length, headings, "an example heading could not be read");
});

// One test that runs them all in order (they depend on each other).
test("every example in docs/api-examples.md gives the documented answer", async () => {
  for (const ex of examples) {
    const args = ex.command.slice(1); // drop the word "curl"
    let method = "GET";
    const headers = {};
    let body;
    let url;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-X") method = args[++i];
      else if (a === "-H") {
        const [k, ...v] = args[++i].split(":");
        headers[k.trim()] = v.join(":").trim();
      } else if (a === "-d") {
        const target = args[++i];
        assert.ok(target.startsWith("@"), `example ${ex.number}: -d must point at a file`);
        body = fs.readFileSync(root + target.slice(1), "utf8");
      } else if (a.startsWith("http://localhost:3000")) url = a.replace("http://localhost:3000", base);
      else assert.fail(`example ${ex.number}: unknown curl word ${a}`);
    }
    assert.ok(url, `example ${ex.number}: no address`);

    // curl uses POST when there is a body and no -X; our commands always say -X.
    const res = await fetch(url, { method, headers, body });
    const actual = await res.json();
    const label = `example ${ex.number} (${ex.title})`;
    assert.equal(res.status, ex.status, `${label}: wrong status. Got ${JSON.stringify(actual)}`);
    assert.deepEqual(actual, ex.json, `${label}: the answer differs from the page`);
  }
});

test("the JSON body files the page uses all exist", () => {
  const files = [...doc.matchAll(/-d @(\S+?)(?:"|\s)/g)].map((m) => m[1].replace(/"$/, ""));
  assert.ok(files.length >= 5);
  for (const f of files) assert.ok(fs.existsSync(root + f), `${f} is missing`);
});
