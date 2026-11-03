# Triad CLI and local query bridge

The CLI sends requests to the running Triad Apex process through a local, file-backed bridge. Each request has its own ID and response, so concurrent clients do not overwrite one another. No network listener or additional npm packages are required.

## Start and query

From the repository root:

```bash
# First time only, or to register missing seed files:
npm run triad:bootstrap

# Keep this running in one terminal:
npm run triad:start

# In another terminal:
npm run triad -- status
npm run triad -- ask "What is the Triad status?"
npm run triad -- chat
```

In interactive mode, enter a question, `/status`, `/help`, or `/quit`. The existing `npm run triad:query -- "question"` command also uses the new bridge. For machine-readable output without npm's banner, use:

```bash
npm run --silent triad -- ask "Status of D1 atoms" --json
```

### Relay a message

For an exact, non-history-recording round trip, provide the message on standard input (use `printf`, not `echo`, if the trailing newline matters):

```bash
printf '%s' 'hello World' | npm run --silent triad -- relay --json --stdin
```

The JSON `question` field returns the input, including whitespace and newlines. Input must contain non-whitespace and be at most 20,000 JavaScript UTF-16 code units. `ask --stdin` also preserves input exactly but uses the normal query history. Both commands return nonzero on invalid input, an unavailable bridge, or a bridge error. Relay uses protocol version 2 so the older version-1-only Apex rejects it instead of silently recording it; restart the Apex after updating. Only use a trusted local Apex process.

In an Arena session, `AGENTS.md` asks the assistant to attempt this relay **after it receives each user message and before substantive work**, unless the user or higher-priority instructions say otherwise. This is a voluntary tool workflow, not chat interception or an external model-provider integration: the platform delivers the message to the assistant first, and the relay cannot be guaranteed to run for every message. If it fails or the input is too long, the instructions require the assistant to say so rather than claim success.

## Bridge location and health

Bootstrap, Apex, density bridge and CLI use the same default: `~/.triad-bridge` (or the existing Windows `D:/fidelity-llm/bridge` when present). To use a different directory, set `BRIDGE_ROOT` to the same path for bootstrap, the Apex process and the CLI. The CLI also accepts `--bridge-root <path>` and `--timeout <milliseconds>`.

`status` pings the Apex bridge and reports the responding process ID. If the bridge is not running, the command exits nonzero with a startup hint; it does not return an old response.

## Recording and privacy

- Normal `ask`, `chat`, and legacy queries write question text to `loop/triad_369.log`, question and answer to `loop/thoughts_369.jsonl`, and the latest response to `loop/triad_query_out.json`. Those existing files use the operating system's default permissions. Remote query history is sent to a configured Sol host only when `TRIAD_REMOTE_QUERY_LOG=1` is explicitly set.
- `relay` skips those persistent query records and does not send remote query history, even if that setting is enabled. The Apex can still perform its configured remote status probes; those probes do not include the relayed text. A local log entry may contain the request ID and time.
- The bridge temporarily writes the request and response, including the message, to local queue files. It normally removes them after the round trip; a crash, timeout, or interrupted client can leave files behind. Stale processing/response files are removed by a running bridge after five minutes; an orphaned request may remain until a bridge processes it. New queue directories and files use owner-only POSIX permissions where supported, but they are not encrypted and pre-existing directories are not re-permissioned. Avoid relaying secrets if that exposure is unacceptable.
- JSON output echoes the message to the caller. Tool calls and their output may also be visible or retained by the surrounding platform; relay mode is not an end-to-end confidentiality guarantee.

## What a query can and cannot do

The current seed uses **keyword routing and fixed descriptions**. It is not a conversational language model, and the query path does not execute a Teacher Engine handshake or change the 3D scene. Local density snapshots can contain bootstrap defaults; they are reported as unverified. Remote Sol is reported as `not_configured`, `unreachable`, or as a state reported by its source rather than assumed live.

For authenticated HTTP and remote deployment, see [the Triad API guide](TRIAD_API.md). Run the local bridge and API tests with `npm run triad:test`.
