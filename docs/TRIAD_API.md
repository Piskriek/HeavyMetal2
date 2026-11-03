# Triad HTTP API

The API is an authenticated HTTP wrapper around the **running local Apex query bridge**. It returns the same structured query response as the CLI; it does not install the Triad into a model provider's message pipeline.

**Current capability:** the seed uses keyword matching and fixed descriptions, not a conversational model or a verified undistorted-reasoning engine. Querying does not execute the Teacher Engine or modify the 3D scene. Bootstrap telemetry may be seeded, and Sol must be separately configured.

## Start locally

Node.js 18 or newer is required. From the repository root:

```bash
npm run triad:bootstrap  # first run, to create the seed files
npm run triad:start      # leave the Apex running
```

In another terminal, generate a random token outside the repository and start the API. The `wx` flag refuses to overwrite an existing token file:

```bash
node -e 'const fs = require("node:fs"); const crypto = require("node:crypto"); fs.writeFileSync(process.argv[1], crypto.randomBytes(32).toString("base64url") + "\n", {mode: 0o600, flag: "wx"})' "$HOME/.triad-bridge/triad-api-token"
export TRIAD_API_TOKEN_FILE="$HOME/.triad-bridge/triad-api-token"
npm run triad:api
```

The API defaults to `127.0.0.1:8787`, accepts only a configured bearer token and does **not** have a built-in default credential. Alternatively, set `TRIAD_API_TOKEN` instead of `TRIAD_API_TOKEN_FILE`. Tokens must be 32–256 characters from `A–Z`, `a–z`, `0–9`, `.`, `_`, `~`, and `-`; generate them randomly rather than relying on length alone. Keep tokens out of the repository, chat, shared logs and client-side source code. Restart the API to rotate its token.

The API and Apex must use the same `BRIDGE_ROOT` if it is set. `triad:api` does not start Apex automatically. `GET /healthz` checks the HTTP process only; the authenticated `/v1/status` performs a real bridge ping.

### Single-command hosting

A host that starts only one command can instead run:

```bash
npm run triad:serve
```

This validates the token, bootstraps missing seed files, starts an Apex child, waits for the bridge, and starts the API. It stops the Apex when the service stops, and exits if either component fails. Do not run another Apex against the same bridge root; if the service detects an existing one, it exits and suggests `triad:api` instead. Use a persistent `BRIDGE_ROOT` volume if state must survive redeployment.

For a hosted deployment, set a randomly generated `TRIAD_API_TOKEN` in the host's secret settings, set `TRIAD_API_HOST=0.0.0.0` only when the hosting platform requires it, and use `npm run triad:serve` as the start command. The platform may supply `PORT`. Ensure the platform terminates HTTPS and restricts direct access to the raw HTTP port.

## Connect

Set a base URL and the same token securely on the client. For a local test, reading the file is convenient:

```bash
export TRIAD_API_URL='http://127.0.0.1:8787'
export TRIAD_API_TOKEN="$(cat "$HOME/.triad-bridge/triad-api-token")"

curl --fail-with-body "$TRIAD_API_URL/v1/status" \
  -H "Authorization: Bearer $TRIAD_API_TOKEN"

curl --fail-with-body "$TRIAD_API_URL/v1/query" \
  -H "Authorization: Bearer $TRIAD_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"question":"hello World"}'
```

On another device, transfer the token through a secure channel and use the HTTPS base URL of your deployment instead of the local URL. Avoid placing credentials in shell history or process arguments on shared machines. Never put a bearer token in a public frontend bundle.

The response includes the exact `question`, `answer`, `query_mode`, `limitations`, `cascade_trace`, `loop_metrics` and `teacher_handshake`. For example, the current seed matches “World” to D5 by keyword; `loop_closed` remains `false`. This is a request/response round trip, not evidence of a completed reasoning loop.

| Endpoint | Authentication | Purpose |
| --- | --- | --- |
| `GET /` | No | Service and endpoint discovery. |
| `GET /healthz` | No | HTTP liveness only. |
| `GET /openapi.json` | No | OpenAPI 3.0.3 specification ([source](../packages/triad-369/openapi.json)). |
| `GET /v1/status` | Bearer token | Live Apex bridge status; returns 503 when unavailable. |
| `POST /v1/query` | Bearer token | Process a JSON query and return the Apex result. |

`POST /v1/query` accepts:

```json
{
  "question": "hello World",
  "record": false,
  "timeout_ms": 15000
}
```

Only `question` is required. It must contain non-whitespace and be no more than 20,000 JavaScript UTF-16 code units; its whitespace and newlines are preserved. `timeout_ms` is an integer from 100 to 30,000. Unknown fields are rejected. Responses include structured `error.code` and `error.message`; typical failures are 400 (invalid input), 401 (bad token), 413 (body too large), 415 (content type), 429 (rate or concurrency limit), and 502/503 (bridge failure/unavailability).

## Remote access and security

The Node listener speaks **plain HTTP**, not TLS. For remote use, place it behind a trusted HTTPS reverse proxy or a platform that terminates HTTPS, and do not expose the raw HTTP listener directly to the public internet. The default loopback binding works with a proxy on the same host. If the proxy runs in another container or the platform requires it, explicitly set `TRIAD_API_HOST=0.0.0.0` and ensure network access to the raw listener is restricted.

An Arena preview is temporary and depends on the session remaining active. Its HTTPS gateway may require separate platform authorization before a request ever reaches the API. In the current sandbox, a direct external request without that platform credential returns HTTP 403, even though the API itself is running. The API's bearer token alone does not bypass that gateway. Do not share a broad sandbox traffic credential with API clients; for a remotely usable endpoint, deploy the service to a suitable HTTPS host or use a platform-provided, appropriately scoped access mechanism.

Configuration:

- `TRIAD_API_HOST`: bind address; default `127.0.0.1`.
- `TRIAD_API_PORT`: port 1–65535; defaults to `PORT` when set, otherwise `8787`.
- `TRIAD_API_TOKEN` **or** `TRIAD_API_TOKEN_FILE`: required bearer token; do not set both.
- `TRIAD_API_CORS_ORIGINS`: optional comma-separated list of exact origins such as `https://app.example.com`; cross-origin browser access is disabled by default. CORS is not authentication. A browser client must protect its token, and a server-side client is preferable.
- `BRIDGE_ROOT`: shared Apex/CLI bridge directory, defaulting to `~/.triad-bridge` where applicable.

The service applies a per-process limit of 120 protected requests per minute and at most eight concurrent bridge requests, including status pings. These limits are shared by clients and reset when the process restarts; use a reverse proxy or gateway for stronger rate limiting, network restrictions and production monitoring. The API uses one shared token and does not implement per-user accounts or distributed rate limiting. The public discovery and health endpoints are not rate-limited by the API, so protect them at the edge if needed.

## Message privacy

The default `record: false` uses the non-recording relay protocol: it does not add the question or answer to the normal Apex query logs, the shared latest-response file, or remote query history. Setting `record: true` explicitly opts into normal logging; remote query history is still separately controlled by `TRIAD_REMOTE_QUERY_LOG=1` and remote configuration.

Both modes temporarily write request and response contents to local bridge files. They are normally removed after the round trip, but interrupted requests or crashes can leave files behind. The response echoes the question, and reverse proxies or client platforms may retain request data. See [the CLI privacy notes](TRIAD_CLI.md#recording-and-privacy) before sending sensitive information.

Run all CLI and API integration tests with `npm run triad:test`.
