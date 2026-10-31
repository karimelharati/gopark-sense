# GoPark Sense

A mobile-first, installable parking hackathon prototype for Beirut. Includes driver and demo gate-operator views, shared persistent inventory, real foreground browser GPS, camera/photo plate OCR, booking history, loyalty rewards, penalty points, tiers, rooftop eligibility, and a priority queue.

## Run locally

Requires Node.js 22.13+ and npm. From this directory:

```powershell
npm.cmd run install:ci
npm.cmd run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lovely_klaw.sql
npm.cmd start -- --port 4173
```

Apply the migration once to a fresh local database. Open `http://127.0.0.1:4173`. Loopback previews use one local demo workspace. The supplied `START.ps1` uses workspace-local Node when present and starts the already-built preview.

On the hosted HTTPS site, open the URL on your phone and use **Add to Home Screen** / **Install app**. The hosted site is private. Data belongs to the signed-in Site user and is shared across that user's devices. Switching Rashid/Layla/Sami changes fictional profiles within that private demo; it is not a production staff authorization system.

## Two-minute demo

1. Explore → AUB Garden Parking → reserve one hour for B123456.
2. My parking → enable GPS assistance. Only proximity changes, never occupancy. GPS may be far away because the lots are illustrative Beirut coordinates.
3. Test booking in gate console → create demo plate event → simulate crossing. The reservation becomes parked.
4. Switch to exit lane, select B123456, create a plate event and confirm the crossing. Capacity is released and points are awarded once.
5. Rewards → redeem ten points for a free parking hour or a fictional partner voucher. Apply the free hour on the next standard-lot reservation.
6. To test penalties, check in again, advance the demo clock beyond the booking end plus grace, then confirm exit. Long overstays reduce tier score, potentially losing rooftop and queue privileges.
7. District Parking starts full. Join its queue, switch sample drivers, and record a seeded visitor's exit to test priority allocation.
8. Open the plate camera, capture/upload a close-up Latin plate photo, inspect the OCR result, and submit it. Low-confidence or edited results require staff review.

## Rules

All rules are editable under **Demo & parking rules**:

- On-time completed stay: +2 spendable loyalty points, +5 tier score.
- Each reward costs 10 loyalty points. Redemption does not lower tier score.
- Explorer 0, Silver 20, Gold 50, Platinum 100 tier score.
- Silver/Gold/Platinum give 5%/10%/15% discounts on demo parking rates.
- Gold and Platinum unlock rooftop parking. Higher tiers have queue priority; equal tiers keep arrival order. The first waiting driver must claim an open space; queue joining never guarantees a spot.
- Ten-minute grace period. Each started 15-minute block beyond grace adds 2 penalty points and subtracts 4 tier score.
- More than 60 minutes late adds another 25 tier-score deduction. Penalties settle exactly once at confirmed checkout. Late stays beyond grace earn no loyalty or tier points.
- No monetary penalty or payment is processed. Bookings reserve time from creation. Cancellation releases the space and any held parking voucher.

## Architecture and accuracy

React/Vinext frontend → same-origin API → Cloudflare D1. A versioned private workspace record uses compare-and-swap updates to keep booking capacity, rewards and event settlement atomic across tabs/devices. Commands carry idempotency keys. No API/private HTML is cached by the service worker. Offline changes are not silently confirmed.

Occupancy = active booked vehicles + observed walk-ins. Bookable capacity additionally subtracts held reservations. Plate observations and GPS alone do not change occupancy. A matched plate must be followed by a staff-observed or explicitly simulated crossing.

Tesseract.js 5.1.1 loads lazily from jsDelivr and downloads the English OCR model on first use. Images are processed on-device and not uploaded. The OCR score is an engine heuristic, not a calibrated match probability. This prototype supports close-up Latin-alphanumeric plate text and normalizes Arabic numerals, but does not include a trained Lebanese plate detector or Arabic text model. Test camera angle, motion blur, night lighting and false matches before a real deployment.

Foreground GPS requires browser permission and HTTPS (or loopback). Continuous background tracking is not provided. Vehicle crossing detection and physical gate operation are not connected. The demo operator confirms observations; there is no computer-vision trajectory detector in this version. No live parking feed, payments, or real merchant redemption is connected.

For real deployment: separate authenticated driver/staff roles, integrate trusted gate sensor events, validate OCR on representative local plates, add operational dispute/reconciliation flows and capacity checks against a complete vehicle feed, expire unused reservations, and validate reward contracts with real partners.

## Verification

```powershell
node --test tests/parking.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

The domain suite covers inventory, GPS-only movements, two-stage gate confirmation, low-confidence review, grace boundaries, tier downgrades, reward idempotency, coupon lifecycle, restrictions, queue priority, last-space allocation, and walk-ins.
