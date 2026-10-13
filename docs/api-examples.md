# API examples

Every call below is a real `curl` command that works against this project (Build 4).
The answers shown were captured from a real run, and `npm test` replays every one of
them (see `test/api-examples.test.js`), so this page cannot drift from the code.

## How to use this page

1. Open a Command Prompt in the project folder and start a **fresh** server: `npm start`
   (it keeps everything in memory, so a restart wipes it).
2. Open a **second** Command Prompt in the same folder.
3. Run the examples **in order, from 1 to 22**. Later examples use things made by earlier ones.
4. Add `-i` after `curl` to also see the status line, for example `curl -i "http://localhost:3000/health"`.

On Windows use `curl` in **Command Prompt**. (In PowerShell, type `curl.exe`.)
The example JSON bodies live in `docs/api-examples/`, so run the commands from the project folder.

## Rules that hold for every call

- Success answers look like `{ "event": {...} }`, `{ "booking": {...} }`, `{ "events": [...] }`.
- Errors **always** look like `{ "error": { "code": "...", "message": "..." } }`.
- Money is whole cents. Dates are `YYYY-MM-DD`.

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION` | A value is missing or wrong (quantity 0, bad date, ...) |
| 400 | `BAD_REQUEST` | The body is not valid JSON |
| 402 | `PAYMENT_DECLINED` | The (mock) bank said no |
| 404 | `NOT_FOUND` | No such event, tier, booking or address |
| 405 | `METHOD_NOT_ALLOWED` | Wrong method for that address (see the `Allow` header) |
| 409 | `SOLD_OUT`, `NOT_PUBLISHED`, `INVALID_STATE`, `ALREADY_CANCELLED` | The request is fine, but not allowed right now |
| 413 | `PAYLOAD_TOO_LARGE` | The body is over 100,000 bytes |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Send JSON with `Content-Type: application/json` |

## The examples

### 1. Check the server is alive

Nothing to send. This is the simplest call there is.

```
curl "http://localhost:3000/health"
```

Expected: **200 OK**

```json
{
  "status": "ok"
}
```

### 2. Create an event (S02)

The server picks the id (`EV-000001`). A new event is a `draft`, so nobody can book it yet.

```
curl -X POST "http://localhost:3000/api/events" -H "Content-Type: application/json" -d @docs/api-examples/new-event.json
```

Expected: **201 Created**

```json
{
  "event": {
    "id": "EV-000001",
    "title": "Lagos Jazz Night",
    "city": "Lagos",
    "venue": "Terra Kulture",
    "date": "2026-12-05",
    "status": "draft",
    "tiers": []
  }
}
```

### 3. Add a ticket tier (S03)

Money is whole cents: 500000 cents = N5,000.00. The tier id `T1` is made for you.

```
curl -X POST "http://localhost:3000/api/events/EV-000001/tiers" -H "Content-Type: application/json" -d @docs/api-examples/new-tier.json
```

Expected: **201 Created**

```json
{
  "tier": {
    "id": "T1",
    "name": "Regular",
    "priceCents": 500000,
    "capacity": 3,
    "seatsLeft": 3
  }
}
```

### 4. Try to book a draft event (refused)

Nobody can book an event that is not published.

```
curl -X POST "http://localhost:3000/api/bookings" -H "Content-Type: application/json" -d @docs/api-examples/new-booking.json
```

Expected: **409 Conflict**

```json
{
  "error": {
    "code": "NOT_PUBLISHED",
    "message": "This event is not published, so it cannot be booked."
  }
}
```

### 5. Publish the event (S04)

No body needed.

```
curl -X POST "http://localhost:3000/api/events/EV-000001/publish"
```

Expected: **200 OK**

```json
{
  "event": {
    "id": "EV-000001",
    "title": "Lagos Jazz Night",
    "city": "Lagos",
    "venue": "Terra Kulture",
    "date": "2026-12-05",
    "status": "published",
    "tiers": [
      {
        "id": "T1",
        "name": "Regular",
        "priceCents": 500000,
        "capacity": 3,
        "seatsLeft": 3
      }
    ]
  }
}
```

### 6. Search: Lagos, cheapest first (S05)

Other options: `q`, `dateFrom`, `dateTo`, `minPriceCents`, `maxPriceCents`, `sort` (date, price, availability) and `order` (asc, desc).

```
curl "http://localhost:3000/api/events?city=Lagos&sort=price&order=asc"
```

Expected: **200 OK**

```json
{
  "events": [
    {
      "id": "EV-000001",
      "title": "Lagos Jazz Night",
      "city": "Lagos",
      "venue": "Terra Kulture",
      "date": "2026-12-05",
      "status": "published",
      "tiers": [
        {
          "id": "T1",
          "name": "Regular",
          "priceCents": 500000,
          "capacity": 3,
          "seatsLeft": 3
        }
      ]
    }
  ]
}
```

### 7. Look at one event

`seatsLeft` goes down as people book.

```
curl "http://localhost:3000/api/events/EV-000001"
```

Expected: **200 OK**

```json
{
  "event": {
    "id": "EV-000001",
    "title": "Lagos Jazz Night",
    "city": "Lagos",
    "venue": "Terra Kulture",
    "date": "2026-12-05",
    "status": "published",
    "tiers": [
      {
        "id": "T1",
        "name": "Regular",
        "priceCents": 500000,
        "capacity": 3,
        "seatsLeft": 3
      }
    ]
  }
}
```

### 8. Book 2 of the 3 seats (S06)

The booking starts `pending`. 2 seats x 500000 = 1000000 cents.

```
curl -X POST "http://localhost:3000/api/bookings" -H "Content-Type: application/json" -d @docs/api-examples/new-booking.json
```

Expected: **201 Created**

```json
{
  "booking": {
    "ref": "BK-000001",
    "eventId": "EV-000001",
    "tierId": "T1",
    "buyerName": "Ada",
    "quantity": 2,
    "totalCents": 1000000,
    "status": "pending"
  }
}
```

### 9. Book 2 more when only 1 is left (refused)

All or nothing: you get `SOLD_OUT` and no seats are taken.

```
curl -X POST "http://localhost:3000/api/bookings" -H "Content-Type: application/json" -d @docs/api-examples/new-booking.json
```

Expected: **409 Conflict**

```json
{
  "error": {
    "code": "SOLD_OUT",
    "message": "Not enough seats in Regular: 1 left, 2 wanted."
  }
}
```

### 10. Book 11 seats (refused)

The most you can book at once is 10.

```
curl -X POST "http://localhost:3000/api/bookings" -H "Content-Type: application/json" -d @docs/api-examples/bad-booking.json
```

Expected: **400 Bad Request**

```json
{
  "error": {
    "code": "VALIDATION",
    "message": "Quantity must be a whole number from 1 to 10."
  }
}
```

### 11. Pay with a declined card (S07)

A pretend payment. `tok_declined` always fails. The booking stays `pending`.

```
curl -X POST "http://localhost:3000/api/bookings/BK-000001/pay" -H "Content-Type: application/json" -d @docs/api-examples/pay-declined.json
```

Expected: **402 Payment Required**

```json
{
  "error": {
    "code": "PAYMENT_DECLINED",
    "message": "The payment was declined. The booking is still pending."
  }
}
```

### 12. Pay with a good card

`tok_success` always works (and it is the default if you send no body).

```
curl -X POST "http://localhost:3000/api/bookings/BK-000001/pay" -H "Content-Type: application/json" -d @docs/api-examples/pay-success.json
```

Expected: **200 OK**

```json
{
  "booking": {
    "ref": "BK-000001",
    "eventId": "EV-000001",
    "tierId": "T1",
    "buyerName": "Ada",
    "quantity": 2,
    "totalCents": 1000000,
    "status": "paid"
  }
}
```

### 13. Pay again (refused)

A booking can only be paid once.

```
curl -X POST "http://localhost:3000/api/bookings/BK-000001/pay"
```

Expected: **409 Conflict**

```json
{
  "error": {
    "code": "INVALID_STATE",
    "message": "Cannot pay a paid booking."
  }
}
```

### 14. Book the last seat

Quantity left out would also mean 1.

```
curl -X POST "http://localhost:3000/api/bookings" -H "Content-Type: application/json" -d @docs/api-examples/new-booking-single.json
```

Expected: **201 Created**

```json
{
  "booking": {
    "ref": "BK-000002",
    "eventId": "EV-000001",
    "tierId": "T1",
    "buyerName": "Bayo",
    "quantity": 1,
    "totalCents": 500000,
    "status": "pending"
  }
}
```

### 15. Cancel an unpaid booking

The seat goes back on sale.

```
curl -X POST "http://localhost:3000/api/bookings/BK-000002/cancel"
```

Expected: **200 OK**

```json
{
  "booking": {
    "ref": "BK-000002",
    "eventId": "EV-000001",
    "tierId": "T1",
    "buyerName": "Bayo",
    "quantity": 1,
    "totalCents": 500000,
    "status": "cancelled"
  }
}
```

### 16. Cancel it again (refused)

Already cancelled.

```
curl -X POST "http://localhost:3000/api/bookings/BK-000002/cancel"
```

Expected: **409 Conflict**

```json
{
  "error": {
    "code": "ALREADY_CANCELLED",
    "message": "Booking BK-000002 is already cancelled."
  }
}
```

### 17. Cancel a PAID booking (refused)

A paid booking needs a refund. Refunds arrive in Build 8.

```
curl -X POST "http://localhost:3000/api/bookings/BK-000001/cancel"
```

Expected: **409 Conflict**

```json
{
  "error": {
    "code": "INVALID_STATE",
    "message": "A paid booking needs a refund. Refunds are built in Build 8."
  }
}
```

### 18. Look at a booking

Anyone with the code can look it up (login arrives in Build 7).

```
curl "http://localhost:3000/api/bookings/BK-000001"
```

Expected: **200 OK**

```json
{
  "booking": {
    "ref": "BK-000001",
    "eventId": "EV-000001",
    "tierId": "T1",
    "buyerName": "Ada",
    "quantity": 2,
    "totalCents": 1000000,
    "status": "paid"
  }
}
```

### 19. Unpublish the event

It goes back to `draft`.

```
curl -X POST "http://localhost:3000/api/events/EV-000001/unpublish"
```

Expected: **200 OK**

```json
{
  "event": {
    "id": "EV-000001",
    "title": "Lagos Jazz Night",
    "city": "Lagos",
    "venue": "Terra Kulture",
    "date": "2026-12-05",
    "status": "draft",
    "tiers": [
      {
        "id": "T1",
        "name": "Regular",
        "priceCents": 500000,
        "capacity": 3,
        "seatsLeft": 1
      }
    ]
  }
}
```

### 20. Search again: the draft is hidden

No matches is not an error. You get an empty list.

```
curl "http://localhost:3000/api/events?city=Lagos"
```

Expected: **200 OK**

```json
{
  "events": []
}
```

### 21. Ask for an event that does not exist

Every error has the same shape: `{ "error": { "code", "message" } }`.

```
curl "http://localhost:3000/api/events/EV-999999"
```

Expected: **404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "No event with id \"EV-999999\"."
  }
}
```

### 22. Send broken JSON

The file `bad-json.json` is cut off on purpose.

```
curl -X POST "http://localhost:3000/api/events" -H "Content-Type: application/json" -d @docs/api-examples/bad-json.json
```

Expected: **400 Bad Request**

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "The body is not valid JSON."
  }
}
```
