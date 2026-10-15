# Build 6: the website (frontend on mock data)

Open `http://localhost:3000` after `npm start`. The website lives in `public/`.

## What you can do
| Story | Screen | What to try |
|---|---|---|
| S05 browse, filter, sort | `#/` | Search, pick a city, dates, highest price, sort. The address bar updates, so Back and sharing work. |
| S06 view event, choose tickets | `#/event/EV-000004` | Pick a ticket type and quantity (1 to 10). A sold-out type is greyed, struck through, labelled "Sold out" and cannot be chosen. |
| S07 check out and pay | `#/checkout/BK-000001` | A countdown shows how long your seats are held. Pay with a mock card. |
| Confirmation | `#/done/BK-000001` | Your booking reference. |

Test cards: `4242 4242 4242 4242` works. `4000 0000 0000 0002` is declined: you see an error, nothing is lost, the seats stay held and you can try again.

Demo links for the fake data: `/?hold=20` holds seats for only 20 seconds (watch the countdown run out). `/?latency=0` removes the pretend waiting.

## The files
```
public/
  index.html          the one page (header, main, footer, screen-reader announcer)
  css/app.css         the look: ticket cards with a perforated stub
  js/
    main.js           router: reads the # address, shows a page, moves focus to its heading
    api.js            THE ONE DATA FILE: fake events + fake bookings + same calls as the real API
    dom.js            h("tag", props, children): builds elements, never from raw HTML text
    money.js          cents -> "₦8,000", "8,000" -> cents, dates
    countdown.js      seconds left, mm:ss, which moments a screen reader announces
    card.js           card form checks (Luhn, expiry, code)
    views/browse.js event.js checkout.js done.js message.js     one file per screen
```

## Rule: all data access in one file
Pages never call `fetch`, never read storage and never hold event data. They import functions from `api.js` and nothing else:
`listEvents`, `getEvent`, `createBooking`, `getBooking`, `payBooking`, `cancelBooking`.
`test/frontend-rules.test.js` fails if any other file breaks this.
In Build 7 only the inside of `api.js` changes (fake data out, `fetch("/api/...")` in).

## Mock = real shape
`test/frontend-mock-api.test.js` starts the real server and checks the mock returns the same fields, the same status codes and the same error codes (`SOLD_OUT` 409, `PAYMENT_DECLINED` 402 ...).
One difference: a mock booking also has `holdExpiresAt` (when the countdown ends). The real API gets this field in Build 8 (unpaid hold expiry).

## Accessibility basics used
- Every field has a visible `<label>`. Radio choices sit in a `<fieldset>` with a `<legend>`.
- "Skip to the page content" link, landmarks (header, nav, main, footer), `lang="en"`.
- On every page change focus moves to the page heading and the title changes.
- Errors use `role="alert"` and are written in words (not colour only). Sold out is a word and a strike-through, not only grey.
- The countdown is visible all the time but a screen reader only hears 5 min, 1 min, 30 s, 10 s and time up.
- Visible keyboard focus, text contrast above 4.5:1, works at phone width, respects "reduce motion".

## Safety
Text from data is always put on the page as plain text (never `innerHTML`). The card number never leaves the browser form: `api.js` turns it into a token (`tok_success` / `tok_declined`), exactly as the real server expects.
