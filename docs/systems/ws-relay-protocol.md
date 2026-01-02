# WebSocket Relay Protocol (Brain)

## Purpose / Scope

This document defines the JSON message protocol used by the Python relay server in `brain/`.

Canonical implementation:

- `brain/src/brain/relay/ws_server.py`

This doc covers:

- client → relay commands
- relay → client response/event shapes
- required and optional fields

## Architecture

Components:

- **Client**: the Vite/React UI (or tests) that opens a WebSocket connection.
- **Relay**: `brain/src/brain/relay/ws_server.py`.
- **Containment Engine**: manages per-session state and an audit trail.
- **Operator Registry**: applies operators (e.g. `ST`, `CH`) to a session state.
- **Covenant Engine**: evaluates safeguards prior to operator application.

Transport:

- WebSocket
- Each incoming message is parsed as JSON.

## Message Model

All client messages are JSON objects with a `cmd` string.

The relay responds with JSON objects.

### Common fields

Client → relay:

- `cmd` (string, required)

Relay → client (common patterns):

- `type` (string) for structured responses/events
- `error` (string) for errors

## Commands

### `CreateSession`

Creates a new containment session.

Request:

```json
{ "cmd": "CreateSession", "owner": "nexus-ui" }
```

Fields:

- `owner` (string, optional): a client identifier.

Response:

```json
{ "type": "SessionCreated", "session_id": "..." }
```

### `ApplyOperator`

Applies an operator against the server-side session state.

Request:

```json
{ "cmd": "ApplyOperator", "session_id": "<id>", "operator": "ST", "params": {} }
```

Fields:

- `session_id` (string, required)
- `operator` (string, required)
- `params` (object, optional)

Response:

```json
{ "type": "State.Snapshot", "session_id": "<id>", "state": { "...": "..." } }
```

Notes:

- The relay evaluates covenant/safeguards before applying the operator.
- The returned snapshot is the full current session state.

### `Infer` (test-mode)

Runs deterministic inference routing/tokenization/prediction when the relay is started in test mode (`RELAY_TEST_MODE=1`).

Request:

```json
{
  "cmd": "Infer",
  "trace_id": "trace-123",
  "payload": {
    "text": "hello",
    "math": "2+2",
    "physics": "g=9.8"
  }
}
```

Response:

```json
{
  "type": "infer_result",
  "trace_id": "trace-123",
  "routing": { "english": true, "math": true, "physics": true },
  "tokens": {
    "english": { "ids": [], "length": 0 },
    "math": { "ids": [], "length": 0 },
    "physics": { "ids": [], "length": 0 }
  },
  "prediction": { "value": null }
}
```

Notes:

- Inference requires artifacts/tokenizers to be loadable; otherwise the relay may return an error.
- When `RELAY_LOG_JSON=1`, the relay may emit structured JSON logs to stdout.

## Error Handling

If JSON parsing fails or a command handler raises, the relay responds with:

```json
{ "error": "..." }
```

Some paths include a `trace_id` when available:

```json
{ "error": "...", "trace_id": "trace-123" }
```

## State & Determinism Rules

- Session state is owned by the relay and keyed by `session_id`.
- Operator application is deterministic for a given starting state + operator + params.
- Test-mode inference is intended to be deterministic given the same loaded artifacts.

## Testing Strategy

- Primary coverage is in `brain/tests/`, including relay E2E tests.

## Operational Notes

Environment variables (selected):

- `RELAY_HOST` (default `127.0.0.1`)
- `RELAY_PORT` or `PORT` (default `9000`)
- `RELAY_TEST_MODE` (`1|true|True` enables test mode)
- `RELAY_LOG_JSON` (`1|true|True` enables structured stdout logs)
- `ARTIFACT_RUN_ID` (default `latest`)
- `ARTIFACTS_ROOT` (default `artifacts/runs`)

## Changelog

- 2026-01-02: Initial protocol doc created from `ws_server.py` behavior.
