# SOAR Workflow Studio

Production-ready starter platform for SOC teams to generate SOAR workflows from natural-language prompts and export to Cortex XSOAR/Splunk SOAR formats.

## Architecture (Microservices)
- **frontend**: React + Tailwind + React Flow visual editor.
- **backend**: FastAPI API gateway + workflow generation orchestration.
- **postgres**: persistence for workflows, versions, users, and audit logs.
- **prompt engine module**: pluggable LLM adapter (mock provider included).

## Core Capabilities
- Natural language to structured workflow logic
- Step-by-step playbook, conditional branches, approvals, escalation
- Integrations catalog and API call scaffolding
- XSOAR JSON + optional Splunk JSON exports
- Node-based visual flow representation
- RBAC (role checks on export endpoint)
- Audit logs and version snapshots

## Backend Structure
```
backend/
  app/
    api/v1/endpoints/      # auth/workflow routes
    core/                  # config + security
    db/                    # SQLAlchemy session/base
    models/                # ORM entities
    schemas/               # request/response models
    services/              # workflow + prompt engine services
    main.py
  tests/
```

## API Endpoints
- `POST /api/v1/auth/login` -> JWT issuance
- `POST /api/v1/workflows/generate` -> prompt -> workflow model
- `GET /api/v1/workflows/{id}/export?format_name=xsoar|splunk|yaml` -> export artifact
- `GET /health` -> health check

## Quick Start
```bash
docker compose up --build
```
Frontend: `http://localhost:5173`
Backend OpenAPI: `http://localhost:8000/docs`

## Security Best Practices Implemented
- JWT auth for protected endpoints
- Role-based authorization gate (`require_roles`)
- Password hashing utility (bcrypt)
- Audit logging for workflow-creation actions
- Structured error handling + retry/fallback policy in generated workflows
- Environment-based config via `.env`

## Example Prompt Inputs
- `Create a phishing email triage automation`
- `Automate brute force detection response`
- `Build ransomware containment workflow`

## Sample Output Fields
- `structured_logic`
- `playbook_steps`
- `branches`
- `integrations`
- `api_calls`
- `error_handling`
- `approvals`
- `escalation`
- `xsoar_json`
- `splunk_json`
- `visual_flow`
