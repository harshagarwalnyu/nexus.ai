# Nexus AI

Agentic investment-research platform. A multi-agent backend (decompose -> execute -> critique -> synthesize) drives a Next.js "tactical UI" for bull/bear/judge debate, red-team war-gaming, and quant simulation over financial data.

## Features

- **Agentic decompose-verify loop** — a "Critic" agent audits raw tool output for hallucinations/contradictions before synthesis (`backend/src/services/research/Executor.js`).
- **Tri-modal debate** — Bull case, Bear case, and Judge verdict generated per research query (`backend/src/services/research/DebateSwarm.js`).
- **War Room red-teaming** — generates adversarial risk scenarios and scores rebuttals (`backend/src/services/research/WarRoom.js`).
- **Quant simulation** — Monte Carlo simulation over DuckDB + Apache Arrow, streamed to the UI (`backend/src/services/quant_engine.js`).
- **Governance & compliance** — PII redaction, audit logging, idempotency and SQL-sandbox middleware (`backend/src/middleware/`, `backend/src/services/governanceService.js`).
- Optional integrations: Slack alerts, Gmail send, Databricks (falls back to local DuckDB), NIA web search/oracle — each degrades gracefully when unconfigured.

## Architecture

```
frontend/   Next.js 16 (App Router) + Bun runtime, better-auth, Framer Motion, Recharts, react-force-graph
backend/    Express 5 + Bun runtime, Google Gemini (@google/genai), DuckDB, Apache Arrow, NATS, LangChain core
```

- Frontend calls the backend via `BACKEND_URL` (`frontend/app/api/chat/route.ts`); auth is handled in-app with `better-auth`.
- Backend exposes REST + SSE/WebSocket routes under `backend/src/routes/`, backed by services in `backend/src/services/`.
- AI calls go directly to the Gemini API (`backend/src/ai.client.js`, model: `gemini-3.1-pro` family).
- Local analytical storage is DuckDB; Databricks is an optional cloud backend swapped in when `DATABRICKS_HOST`/`DATABRICKS_TOKEN` are set.

## Prerequisites

- [Bun](https://bun.sh) 1.4+ (both frontend and backend run on Bun, not Node)
- A Gemini API key
- (Optional) Databricks, Slack, Gmail, NIA credentials for the corresponding integrations

## Quickstart

### 1. Backend

```bash
cd backend
bun install
# create backend/.env with at least BETTER_AUTH_SECRET and GEMINI_API_KEY (see table below)
bun run dev            # starts on http://localhost:3001
```

### 2. Frontend

In a second terminal:

```bash
cd frontend
bun install
# create frontend/.env with BETTER_AUTH_SECRET (must match the backend's)
bun run dev            # starts on http://localhost:3000
```

### Tests

```bash
cd backend && bun test
cd frontend && bun test
```

### Lint

```bash
cd frontend && bun run lint
```

(Backend has no lint config yet — see "Known gaps" below.)

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | no | default `3001` |
| `BETTER_AUTH_SECRET` | **yes** | shared secret with the frontend |
| `GEMINI_API_KEY` | **yes** | Google Gemini API key |
| `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`, `SLACK_P0..P3_CHANNEL`, `SLACK_AUTO_ALERT` | no | Slack alerts disabled if absent |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_FROM_ADDRESS` | no | email send disabled if absent |
| `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_HTTP_PATH`, `DATABRICKS_CATALOG`, `DATABRICKS_SCHEMA` | no | falls back to local DuckDB if absent |
| `NIA_API_KEY`, `NIA_BASE_URL` | no | web search/oracle disabled if absent |

### Frontend (`frontend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `BETTER_AUTH_SECRET` | **yes** | must match the backend; build fails without it in production |
| `BETTER_AUTH_URL` | no | default `http://localhost:3004` |
| `BACKEND_URL` | no | default `http://localhost:3001` |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | no | analytics disabled if absent |

## Known gaps

- Backend has no ESLint config — no lint step wired for it in CI.
- Frontend's `bun run lint` currently errors under Bun's Node-compat layer due to an `eslint-plugin-react` incompatibility with ESLint 10 — pre-existing dependency issue, not something introduced here.
- `duckdb`'s native binary does not build out of the box on Windows (missing native toolchain); it builds cleanly on Linux CI runners.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
