# AI Log

## Build 1
- I asked: for the Build 1 domain core (events, bookings, waitlist, Map lookup).
- What came back: 7 files, with a linked-list queue and a Map for bookings.
- - What was wrong: Nothing was wrong with the code. It ran with no errors. npm was blocked by PowerShell on my PC, which was a Windows setting.
- What I changed: I switched the terminal to Command Prompt (or allowed scripts) and ran it again. Demo and benchmark both worked.
Map goes straight to the answer, but Array.find checks every booking, so Map is faster when there are many bookings.”
## Build 2
- I asked: for Build 2 (search, filter, merge sort, tests, acceptance criteria).
- What came back: search.js, sort.js, 50 tests, and a criteria document.
- What was wrong: the Build 1 code did not match the teacher's rules in docs/user-stories.md. It used kobo instead of cents, had no limit of 10 tickets, used the wrong error names, and made bookings "confirmed" instead of "pending". I found this by reading the user stories.
- What I changed: the AI fixed all four. I checked the fixes by running npm test (50 passed).
- Stable sort: if two events tie, the one that was first stays first.
- Search and sort make a copy. The original list stays the same.
## Build 3
- I asked: for Build 3 (state machine, layered design, server skeleton).
- What came back: a booking state machine, routes/services/rules/data layers, a server with /health, and two diagrams.
- What was wrong: the AI's own tests found 3 problems. createEvent crashed with a TypeError when given nothing. A booking could be cancelled through the wrong event. The first safety check for the static server did not cover Windows backslash paths.
- The AI also put a folder named src/data, and the course .gitignore ignores any folder called data, so Git did not see it. I found it in git status and fixed it with !src/data/ in .gitignore.
- What I changed: the AI fixed all of these and added tests for each. I checked by running npm test (139 passed) and by opening /health in the browser.
## Build 4: REST API (in memory)

**What I asked the AI:**
Build a working REST API for the event ticketing project. It should let me create events and tiers, publish and unpublish, search and sort, book tickets, pay with a mock payment, and cancel an unpaid booking. Errors must always come back in the same shape, and `docs/api-examples.md` must work with curl.

**What the AI produced:**
- The API under `/api`, split into routes (HTTP only), services (what a person does) and rules (the business decisions).
- One table that turns every error code into an HTTP status (for example `SOLD_OUT` is 409, `PAYMENT_DECLINED` is 402).
- A mock payment: `tok_success` works and `tok_declined` is refused.
- `docs/api-examples.md` with 22 curl examples and their real answers.
- 49 new tests, so the project now has 188.

**What I checked myself:**
- I ran `npm test` and got pass 188, fail 0.
- I started the server and ran the curl commands one by one: create event, add tier, publish, book 2 of 3 seats (pending, 1,000,000 cents), pay (paid), then book 2 more and got `SOLD_OUT`. All answers matched the examples page.
- I ran `npm run demo:api` and read the printed story.

**What the AI got wrong (and how it was fixed):**
1. One of its own tests expected the wrong answer. It said a wrong method on `/api/bookings` should be 404, but the correct answer is 405 (method not allowed). The test was fixed, not the code.
2. Sending an empty body to `POST /api/bookings` gave 404 "not found" instead of a clear 400 validation error. The AI added a check that the event id and tier id must be text.
3. The architecture test did not allow routes to call services. The AI updated the rule (routes may use services, never the rules directly) and added a test proving a route that imports a rule is caught.
4. When I first tried curl, it failed with "Failed to connect". That was my mistake, not the code: the server was not running. It needs `npm start` in one terminal and curl in another.

**What I learned:**
- An API is a way for other programs to talk to my server, using addresses (like `/api/events`) and methods (GET to look, POST to send).
- Status codes tell the caller what happened: 201 created, 400 bad input, 404 not found, 409 not allowed right now.
- A route should only read the request and send the answer. The decisions belong in the rules.
- Everything is kept in memory, so restarting the server clears the data. Build 5 fixes that with SQLite.

**Known shortcuts for later:**
- A draft event can still be looked up by its id. Build 7 (login) will restrict that.
- Paid bookings cannot be cancelled yet. Refunds come in Build 8.