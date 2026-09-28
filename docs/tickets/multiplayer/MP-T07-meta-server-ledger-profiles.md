# MP-T07: Meta Server Architecture: Idempotent Ledger & Seasons

- **ID**: `MP-T07`
- **Priority**: High (Phase C / Server Track)
- **Track**: Backend Infrastructure & Database
- **Estimate**: 6 days
- **Dependencies**: `MP-T01`
- **Target Files**: `server/db/schema.ts`, `server/ledger.ts`, `server/profile.ts`, `server/season.ts`, `src/net/meta-client.ts`, `tests/ledger.test.ts`

---

## Goal
Implement the authoritative Meta Server backend with a PostgreSQL database and Drizzle ORM. Build a strict, double-entry financial ledger with idempotency keys, support up to 5 racer slots per account, and manage the 30-day monthly season lifecycle with soft Elo resets.

---

## Technical Specification

### 1. PostgreSQL Schema (Drizzle ORM)
- `accounts`: `id`, `display_name`, `wallet_cache`, `slots_owned` (1..5), `created_at`.
- `racers`: `id`, `account_id`, `slot`, `status` (`alive`, `dead`, `retired`), `elo`, `season_deaths`, `dna`, `ball_config` (JSONB), `soul_sickness_until`.
- `ledger_tx`: `id`, `account_id`, `kind`, `delta`, `balance_after`, `idempotency_key` (UNIQUE), `created_at`.
- `hall_of_fame`: `id`, `racer_snapshot` (JSONB), `season`, `peak_elo`, `cause_of_retirement`.

### 2. Double-Entry Idempotent Ledger Write Path
```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- Lock account row
SELECT wallet_cache FROM accounts WHERE id = $accountId FOR UPDATE;
-- Validate balance sufficiency for debits
-- Insert append-only transaction
INSERT INTO ledger_tx (account_id, kind, delta, balance_after, idempotency_key)
VALUES ($accountId, $kind, $delta, $newBalance, $idempotencyKey)
ON CONFLICT (idempotency_key) DO NOTHING;
-- Update cached wallet
UPDATE accounts SET wallet_cache = $newBalance WHERE id = $accountId;
COMMIT;
```

### 3. 30-Day Season Rollover Job
- Soft reset Elo: `E_new = 1000 + 0.5 * (E_current - 1000)`.
- Distribute seasonal reward purses to top 1% and 10% leaderboard tiers.
- Permanently retire dead racers to the Hall of Fame.
- Reset `season_deaths` and `gross_seasonal_inflow` counters.

---

## Acceptance Criteria
- [ ] 50 concurrent parallel debit requests with the same idempotency key execute exactly once without double-charging.
- [ ] Account balances are strictly derived from immutable ledger transactions.
- [ ] Additional racer slots (2 through 5) require explicit ledger purchases (2,500g $	o$ 6,000g $	o$ 12,000g $	o$ 25,000g).
- [ ] Season rollover job executes cleanly in transaction test, updating ratings and archiving dead racers.

---

## Tests to Run
`node --import tsx --test tests/ledger.test.ts`
