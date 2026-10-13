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