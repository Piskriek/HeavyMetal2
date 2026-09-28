# MP-T13: Authoritative Race Server & Client Prediction

- **ID**: `MP-T13`
- **Priority**: Critical (Phase C / Architecture)
- **Track**: Netcode & Physics Parity
- **Estimate**: 8 days
- **Dependencies**: `MP-T07`, `MP-T08`
- **Target Files**: `server/race-server.ts`, `server/race-instance.ts`, `src/net/prediction.ts`, `src/net/interpolation.ts`, `tests/netcode-parity.test.ts`

---

## Goal
Implement a server-authoritative 120 Hz headless simulation for ranked heats. Clients send 60 Hz input packets and predict local ball movement with rollback reconciliation, while interpolating remote marbles from 20 Hz server snapshots.

---

## Technical Specification

### 1. Performance Spike & Benchmark Gate
- Benchmark headless Node.js simulation with 100 marbles colliding on the Ridge track.
- Gate: Server tick duration must stay $le 2.0$ ms per tick on the target cloud CPU.

### 2. Client-Side Prediction & Rollback
- Client simulates local marble ahead of server time.
- On receiving authoritative snapshot:
  - If discrepancy $> 0.5$ units: snap state back to snapshot tick and replay unacknowledged inputs.
  - Smooth visual position error over 100 ms to eliminate jitter.

### 3. Remote Entity Interpolation
- Server broadcasts compressed position/rotation snapshots at 20 Hz.
- Client buffers snapshots with a 100 ms interpolation delay, using Hermite spline interpolation for smooth motion.

---

## Acceptance Criteria
- [ ] 100-racer headless server simulation executes in $le 2.0$ ms per tick.
- [ ] Client prediction handles up to 150 ms simulated network latency with zero visual snap under normal driving.
- [ ] Rollback reconciliation correctly corrects collisions and track hazard impacts.
- [ ] Remote racers move smoothly at 60 fps without rubber-banding under steady 20 Hz snapshot delivery.

---

## Tests to Run
`node --import tsx --test tests/netcode-parity.test.ts`
