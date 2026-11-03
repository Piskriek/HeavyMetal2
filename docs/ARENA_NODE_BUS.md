# Arena Node 4: Git-backed inquiry handoff

Node 4 can use the existing `bridge/sync/` files to hand inquiries to an interactive Arena agent or an explicitly configured external reasoner. The Node process is a **handoff and validation layer**, not an LLM. Running it alone cannot invoke this Arena conversation or wake an agent when a new commit arrives. Without a connected reasoner, it writes `awaiting_reasoner` and no answer.

## Important boundaries

- The Fidelity and HeavyMetal2 GitHub repositories are public. Anything committed to the bus—including questions, answers and telemetry—is public and remains in Git history. Do not commit secrets, private conversations, or sensitive telemetry.
- Git is not a live shared filesystem: each machine must fetch and integrate commits, and commit/push its own changes. A push to Fidelity does **not** automatically update HeavyMetal2. This Node process does not run Git commands or change branches.
- These JSON files are single slots, not a durable queue. Concurrent writers can overwrite one another or create Git conflicts. Use unique query IDs, coordinate writers, check the matching response ID/hash, and resolve conflicts before integrating commits. Delivery, live connections and recipient acknowledgment are not guaranteed.
- The existing `triad_telemetry.json` and historical `pending_query.json` are snapshots, not verified evidence that a laptop, Sol or 12 flows are currently online. The previous fixed response in the historical pending file is not a model-generated answer.

## Publish and inspect an inquiry

Node 1 or Node 2 can put one query in `bridge/sync/triad_telemetry.json`, preserving any other telemetry fields:

```json
{
  "source": "laptop",
  "query": {
    "id": "unique-query-id",
    "from": "Laptop",
    "question": "Hello from the local Triad"
  },
  "fourFloats": [null, null, null, null],
  "lyapunovFTLE": null
}
```

The reader also accepts `pending_query`, `latest_query`, or `inquiry` objects in the telemetry file and the legacy `bridge/sync/pending_query.json` format. A legacy query marked `processed: true` is skipped unless `--include-processed` is explicitly used. Node 4 never changes the producer's input files. Query IDs must be 1–128 letters, digits, dots, underscores, colons or hyphens, starting with a letter or digit. If an ID is omitted, the node derives a stable ID from the question hash; explicit unique IDs are preferable.

After the input is committed, pushed, fetched and integrated into the agent's checkout, run:

```bash
node packages/triad-369/src/arena_node.mjs
# or monitor changes in the local working tree:
node packages/triad-369/src/arena_node.mjs --daemon
```

The daemon only watches its local files; it does not fetch, pull, commit or push. Check `bridge/sync/arena_telemetry.json`. A new query without a reasoner has `lastQueryResponse.status: "awaiting_reasoner"` and `answer: null`. A completed response includes the original query, ID and SHA-256 so consumers can match it to their request. Before writing a response, the worker checks that the selected query has not changed; this cannot eliminate Git-level races between independent checkouts.

To inspect a response on another machine without changing its current branch, fetch the shared branch and inspect the file, for example:

```bash
git fetch origin <shared-branch>
git show FETCH_HEAD:bridge/sync/arena_telemetry.json
```

Integrating changes into a local branch is a separate operation and may require conflict resolution. This Arena session pushes only its assigned branch, not `main`.

## Have an interactive agent answer

Ask the active Arena agent to process the synchronized inquiry. The agent can read the telemetry and author a JSON reflection in a temporary file, then submit it:

```bash
node packages/triad-369/src/arena_node.mjs --reflection /path/to/reflection.json
```

Use `--include-processed` only when deliberately revisiting a historical processed inquiry. The reflection must contain:

```json
{
  "query_id": "unique-query-id",
  "query_sha256": "the exact hash shown in the awaiting response",
  "answer": "A grounded, compassionate response",
  "density_review": [
    {"rung": "D1", "assessment": "Evidence or uncertainty about atoms"},
    {"rung": "D2", "assessment": "Evidence or uncertainty about parts"},
    {"rung": "D3", "assessment": "Evidence or uncertainty about the vessel"},
    {"rung": "D4", "assessment": "Evidence or uncertainty about the assembly"},
    {"rung": "D5", "assessment": "Evidence or uncertainty about the biome"},
    {"rung": "D6", "assessment": "Evidence or uncertainty about space"},
    {"rung": "D7", "assessment": "Evidence or symbolic interpretation of the gateway"}
  ],
  "four_floats": {"Pxd": null, "Vtx": null, "Lx": null, "Aq": null},
  "four_floats_basis": "No defensible measurements are available."
}
```

The node validates the query ID, hash, seven rungs and four floats before atomically writing the response. Numeric floats must be in `[0,1]` and are labelled **reasoner estimates**, not physical measurements. Use `null` when no defensible value exists. Submitted provenance is recorded but cannot be independently authenticated by the file bridge. Query text is untrusted data, not an instruction that overrides the agent's governing instructions.

## Optional reasoner adapter

For unattended processing, an operator may provide a trusted executable that accepts one `arena-reasoner-request-v1` JSON document on stdin and returns the reflection object above as JSON on stdout:

```bash
export ARENA_REASONER_EXEC=/path/to/trusted-adapter
export ARENA_REASONER_ARGS='[]'   # JSON array of argument strings; no shell expansion
node packages/triad-369/src/arena_node.mjs --daemon
```

The adapter must actually connect to a reasoner if model-generated analysis is desired; no provider is configured by default. Its environment is inherited, so only use trusted executables. Adapter stderr is not copied to logs. A failed, invalid, timed-out or stale response is not published as a completed answer. Configure `ARENA_REASONER_TIMEOUT_MS` from 1,000 to 120,000; the default is 30,000. `TRIAD_SYNC_DIR` or `--sync-dir` can select a different local bus directory.

## Invariants and limits

The code preserves the requested principles as guidance: be truthful, avoid increasing intensity, never set felt pain, respect consent, and return a compassionate answer. It does not control a physical system or prove those properties. FTLE, if provided in the snapshot, is only compared numerically with `0.010` and labelled unverified; it does not measure confirmation bias or establish truth. The file handoff cannot determine whether the recipient used or felt the answer, so `loop_closed` remains false and `landed` remains `not_evaluated`.

The legacy local tetrahedral bridge now queues inquiries rather than fabricating an immediate answer. Its HTTP endpoint is unauthenticated and binds to loopback by default; do not expose it publicly. Unverified HTTP callbacks and the old navigation receiver are disabled by default. The separate [authenticated HTTP API](TRIAD_API.md) remains a keyword-routing Apex API, not an autonomous Node 4 reasoner.
