# GoPark tabletop gate demo

The software runs without this hardware. Use a low-voltage tabletop model to demonstrate the distinction between opening a gate and observing actual passage. This firmware has not been tested on a connected physical board in this workspace.

## Parts

- One ESP32 development board and USB power.
- Two 3.3V-compatible IR break-beam/digital sensors: A outside, B inside.
- An LED and resistor, or a compatible low-voltage relay module representing a gate-open input.
- Reuse a laptop/phone for the attendant console and offline QR verifier.

Record actual supplier prices in the Simulation cost field; the app does not claim vendor prices. Setup/wiring/staff costs are additional. Do not connect this demonstrator directly to a real vehicle barrier or mains power.

## Wiring and setup

1. Beam A signal → GPIO 13; beam B → GPIO 14; shared ground. Use 3.3V-compatible signals.
2. Gate indicator → GPIO 26 through appropriate low-voltage interfacing. Change active-high logic for a different module.
3. In Arduino IDE install the ESP32 board support and ArduinoJson 7. Select the actual ESP32 board and compile `gopark_gate.ino`.
4. In GoPark → Gate console → Setup & privacy, select the lot and create a device pairing token.
5. Copy SSID, password, server LAN address and token into a private firmware copy. Do not commit credentials. The token is scoped to one parking location.
6. Start the local app explicitly with `Open GoPark.cmd --lan` if a device needs LAN access. This starts a token-only hardware bridge on port 4174; the app remains loopback-only on 4173. Windows firewall approval may be required. Hardware requests require the paired token; ordinary LAN pages are not authenticated as the local operator.
7. Create an authorized driver/attendant request. The LED/relay pulse acknowledges opening. Occupancy must remain unchanged until A→B (entry) or B→A (exit).

The bridge preserves a monotonic event sequence in ESP32 nonvolatile storage. Repeated events and repeated confirmed crossings must not duplicate points or counts. A low-cost two-beam model cannot reliably identify tailgating, side-by-side traffic, or plate identity: those cases require staff or a suitable camera. Network failures require the attendant's offline observation queue; this firmware does not pretend to buffer a missing passage automatically.

## Offline QR demonstration

Open the main app once to cache trusted issuer information and the booking pass. Open `/offline-wallet` on the driver's device and attendant's device before disconnecting. The driver code is a signed booking certificate plus a 30-second device-signed proof. The attendant verifies it with the pinned issuer key and records actual observed passage. Cached cancellation status can be stale; records remain provisional until synchronization. Replay checks are local to each verifier, not a global offline guarantee.

## Production work

Use TLS, real driver/staff identities and device provisioning, hardware safety controls, reliable lane sensing, cancellation reconciliation and locally validated OCR. Native mobile/background notifications are separate from this foreground local prototype.
