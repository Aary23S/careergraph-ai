# CareerGraph AI — Context-Aware Career Intelligence Platform

CareerGraph AI is an AI-powered productivity platform that unifies job discovery, match understanding, network referral intelligence, context-aware RAG copilot chat, and human-confirmed workflow actions into a single integrated workspace.

---

## Key Capabilities

- **AI Job Understanding & Matching**: Analyzes job requirements against candidate profile and active resume to compute deterministic and AI-blended match scores.
- **Match Explainer (H4)**: Provides fit breakdowns explaining skill matches, title alignment, and remote preferences.
- **Referral Intelligence (H3)**: Maps warm referral candidates across 9K+ network connections without hallucinating contacts.
- **Decision Digest (H5)**: Generates daily opportunity digests with prioritized next actions.
- **Context-Aware Copilot Chat (H6)**: Conversational RAG assistant grounded in candidate profile, applications, and network context.
- **Safe Workflow Actions (H7)**: Proposes structured action plans (`save_job`, `create_application`, `schedule_followup`, `create_outreach_draft`, `add_note`, `log_outreach`) that require explicit user confirmation (**Zero automatic external message sends**).
- **AI Evaluation Framework (H8)**: Unified evaluation suite measuring precision, recall, F1, security gates, groundedness, and productivity impact (54% manual step reduction).

---

## Tech Stack

- **Frontend**: React, Vanilla CSS, Vite, Axios
- **Backend**: Node.js, Express, Sequelize, PostgreSQL / SQLite, Redis, BullMQ
- **AI Services**: Google Gemini 2.5 Flash, Ollama, Groq, OpenAI, pgvector Semantic Search
- **MLOps & Evaluation**: MLflow, Model Registry, Joi Evaluation Schemas, Jest

---

## Running Locally

### 1. Prerequisites
- Node.js >= 18
- PostgreSQL or SQLite
- Redis (optional, in-memory fallback enabled automatically)

### 2. Environment Setup
```bash
cd server
cp .env.example .env
# Enable DEMO_MODE for stable demo fixtures
DEMO_MODE=true
```

### 3. Database Migration & Demo Seeding
```bash
npm run db:migrate
npm run demo:reset
```

### 4. Start Server & Client
```bash
# Start backend
npm run dev

# Start frontend (in client directory)
cd ../client
npm run dev
```

---

## Running Evaluation & Tests

```bash
# Run full H8 evaluation suite
npm run h8:evaluate

# Alternative alias
npm run hackathon:evaluate

# Run automated Jest test suite (12 test suites / 160 tests total)
npm test

# Build check
npm run build

# Lint check
npm run lint
```

---

## Security & Safety Invariants

1. **Human-in-the-Loop Confirmation**: Consequential database mutations require explicit user confirmation via Action Preview cards.
2. **Multi-Tenant Isolation**: Server-side user and target entity ownership checks prevent cross-tenant IDOR access.
3. **Draft Only Outreach**: Outreach AI generation produces local draft records ONLY. CareerGraph NEVER automatically dispatches emails or external messages.
4. **Fail-Closed Fallback**: If AI services or Ollama are unavailable, core CareerGraph functionality (search, CRM, applications, deterministic matching) remains 100% operational.

---

## Documentation Index

- [Demo Presentation Script](file:///d:/VS%20Code%20Programs/My%20Project/careergraph-v1/careergraph-ai/docs/demo-script.md)
- [Demo Talk Track](file:///d:/VS%20Code%20Programs/My%20Project/careergraph-v1/careergraph-ai/docs/demo-talk-track.md)
- [Demo Troubleshooting Guide](file:///d:/VS%20Code%20Programs/My%20Project/careergraph-v1/careergraph-ai/docs/demo-troubleshooting.md)
- [Pre-Demo Checklist](file:///d:/VS%20Code%20Programs/My%20Project/careergraph-v1/careergraph-ai/docs/demo-checklist.md)
- [Hackathon Value Statement](file:///d:/VS%20Code%20Programs/My%20Project/careergraph-v1/careergraph-ai/docs/hackathon-value.md)
- [System Architecture](file:///d:/VS%20Code%20Programs/My%20Project/careergraph-v1/careergraph-ai/docs/architecture.md)
- [AI Evaluation Documentation](file:///d:/VS%20Code%20Programs/My%20Project/careergraph-v1/careergraph-ai/docs/h8-evaluation.md)
- [Workflow Actions Architecture](file:///d:/VS%20Code%20Programs/My%20Project/careergraph-v1/careergraph-ai/docs/h7-actions.md)
