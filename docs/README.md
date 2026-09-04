# Nesto documentation

| Path | Contents |
|---|---|
| `prd/` | The Master Architecture PRD v1.0 — the requirement authority (§0.1) |
| `ENGINEERING-RESPONSE.md` | The Appendix E engineering response: validation, challenged assumptions, ownership map, schema and migration plan, contracts, threat model, estimates, budgets and the declared deviations |
| `adr/` | The 18 ADRs Appendix D requires, plus ADR-0019 |
| `requirements/` | Requirements register, data classification, retention and legal hold, migration register, state-machine catalogue |
| `api/` | API catalogue and the generated OpenAPI document |
| `events/` | Event registry and generated JSON Schemas |
| `runbooks/` | Operational procedures, written with the phase that introduces the behavior |
| `threat-models/` | Threat models, starting with tenant isolation |

## Reading order for a new engineer

1. `prd/Nesto_Master_Architecture_PRD_v1.0.md` §§1–4 — what the product is and the four invariants.
2. `ENGINEERING-RESPONSE.md` §§2–4 — what was challenged, who owns what, how the schema is laid out.
3. `adr/0002`, `adr/0004`, `adr/0005` — the three decisions that constrain nearly every line of code.
4. The domain you are working in, under `domains/`, starting with its `README.md`.
