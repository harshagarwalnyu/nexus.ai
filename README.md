# Nexus AI: The Alpha-Ready Investment Intelligence Engine

Nexus AI is not another "wrapper." It is a **YC-level intelligence orchestration platform** designed for hedge funds and tier-1 investment firms. While the market is saturated with generic chat-with-pdf tools, Nexus provides a **quant-agentic loop** that decomposes, executes, verifies, and synthesizes complex investment mandates.

## Why Nexus? (The Unfair Advantage)

1. **Agentic Decompostion-Verification Loop**: Unlike standard LLM pipelines, Nexus uses a SOTA "Critic" pattern. Every piece of raw tool data is audited by a skeptical second agent for hallucinations and contradictions before reaching the final synthesis.
2. **Tri-Modal Adversarial Debate**: Nexus simulates a high-stakes investment committee. It generates a high-conviction Bull Case, a brutal Bear Case, and a neutral Judge Verdict to provide a 360° view of any asset.
3. **Quant-Core Integration**: Direct integration with DuckDB and Apache Arrow for streaming high-performance financial simulations (Monte Carlo) directly into the UI.
4. **Red-Teaming as a Service**: The "War Room" feature generates non-obvious black-swan threats and scores user rebuttals against them using advanced reasoning models.
5. **Durable Execution Engine**: Built for the "Data Room" era. Our ingestion service is a fault-tolerant state machine designed to handle massive, multi-file VDR (Virtual Data Room) processing without data loss.

## The Stack (March 2026 SOTA)

- **AI Core**: Gemini 3.1 Pro Preview (Exclusively optimized for paid tier throughput).
- **Runtime**: Bun (The fastest JS/TS engine available).
- **Frontend**: Next.js 16 (App Router) + Framer Motion + Recharts (Tactical UI).
- **Backend**: Express + Effect (Functional, type-safe error handling) + LangChain.
- **Data**: DuckDB (Local analytical storage) + Databricks (Cloud CRM).

## Zero-Ops Quickstart

Nexus is optimized for local execution with Bun.

### 1. Start the Backend
```bash
cd backend
bun install
bun run dev
```
*This starts the AI core and initializes the internal data engine.*

### 2. Start the Tactical UI
In a new terminal:
```bash
cd frontend
bun install
bun run dev
```
*This spins up the Next.js frontend, available at `http://localhost:3000`.*

---

**Nexus AI — Beyond Information. Pure Alpha.**

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

