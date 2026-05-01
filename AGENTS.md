# Agent Guide

This repo is designed for agents performing migrations into and out of Salesforce Marketing Cloud Engagement (SFMC). This file is the canonical entrypoint for an agent picking up the repo for the first time.

## Purpose

Give a migration agent everything it needs to plan and execute an SFMC import or export without hunting through vendor documentation:

- An OpenAPI 3.0.3 contract for the SFMC REST surface.
- Migration-oriented vendor extensions on each operation (`x-migration-direction`, `x-bulk-capable`, `x-polling-endpoint-of`).
- A library of sequential recipes for common import/export flows.
- A generated `migration-catalog.json` that flattens spec + recipes into a single agent-friendly index.
- A read-only MCP server for lookups.

The repo deliberately does not execute SFMC calls. Execution is the agent's responsibility.

## How to use this repo as an agent

1. **Load the catalog.** Start from `dist/migration-catalog.json` (build it with `npm run catalog` if missing). Every operation and every recipe is represented there.
2. **Pick a recipe.** Use `list_migration_recipes` or scan `specs/migrations/*.yaml`. Each recipe declares its `direction`, `family`, `prerequisites`, and `steps[]`.
3. **Check prerequisites.** Confirm the caller holds every scope in `prerequisites.scopes` and has collected every name in `prerequisites.inputs_required`. If not, stop and ask the human.
4. **Walk the steps in order.** For each step:
   - Resolve inputs. Sources are `literal`, `input`, or `step.<id>.output.<jsonpath>`.
   - Look up the operation by `operation_id` in the catalog to get method, path, scopes, and request/response shape.
   - Call SFMC. Attach request identifiers to your run log.
   - If `polling` is set, repeat the `poll_operation_id` until status ∈ `terminal_statuses` or `timeout_seconds` elapses.
   - If `retry` is set, retry on listed status codes with the chosen backoff.
5. **Honor idempotency.** Use the recipe's `idempotency.key_source` to deduplicate retries. Do not blind-retry writes that lack an idempotency key.
6. **Log resolved BU context once per run.** Do not assume the token points at the intended business unit.

## Contract primitives

Vendor extensions you should read from the catalog or the raw OpenAPI:

| Key                              | On             | Meaning                                                                           |
| -------------------------------- | -------------- | --------------------------------------------------------------------------------- |
| `operationId`                    | operation      | Stable identifier. Recipes reference this string.                                 |
| `x-migration-direction`          | operation      | `import`, `export`, `both`, or `control-plane`. Control-plane ops are not valid recipe steps on their own. |
| `x-bulk-capable`                 | operation      | Boolean. `true` means the op natively accepts arrays/batches.                     |
| `x-polling-endpoint-of`          | operation      | References an `operationId`. The current op is a status/results poll for that kicker. |
| `x-sfmc-installed-package-scopes`| operation      | OAuth2 scopes required by the SFMC installed package.                             |
| `x-sfmc-permission-ids`          | operation      | Numeric permission IDs (SFMC UI permissions).                                     |
| `x-sfmc-user-permission-paths`   | operation      | Human-readable permission paths, e.g. `Email > Subscribers > Data Extension > View`. |
| `x-original-marketing-cloud-paths` | operation    | Original SFMC route names before normalization.                                   |

## Recipe model

Each recipe in `specs/migrations/*.yaml` conforms to `specs/migrations/_schema.yaml`. Core fields:

- `id`, `name`, `description`
- `direction` — `import` or `export`
- `source_system`, `target_system`, `family`
- `prerequisites.{scopes, permissions, inputs_required}`
- `steps[]` — sequential. Each step has `id`, `operation_id`, `why`, `inputs`, `outputs`, optional `polling`, optional `retry`, and `idempotency`.
- `field_mapping_hints[]` — optional per-field notes for data-shape migrations.
- `idempotency_notes`, optional `rollback`, optional `references[]`.

Recipes are intentionally sequential. There are no branches, no DAGs, no conditionals. If you need branching, execute two recipes.

## Connection configuration

Before executing any SFMC API calls the agent needs five values from the caller's SFMC installed package:

| Field | Description |
| ----- | ----------- |
| `clientId` | OAuth2 Client Id (credentials tab of the installed package) |
| `clientSecret` | OAuth2 Client Secret (credentials tab of the installed package) |
| `authBaseUri` | Authentication Base URI shown in the installed package |
| `restBaseUri` | REST Base URI shown in the installed package |
| `soapBaseUri` | SOAP Base URI shown in the installed package |

These are stored in `sfmc-connection.config.json` at the repo root (gitignored). Two ways to populate it:

**Interactive CLI (human-facing):**
```
npm run setup
```
Prompts for each field, shows current values for non-secret fields, and writes the file.

**Via MCP tools (agent-facing):**
1. Call `get_connection_config` — returns which fields are set and which are `missing_fields`. Secret values are never returned.
2. For any missing field, ask the user to provide the value.
3. Call `set_connection_config({ clientId, clientSecret, authBaseUri, restBaseUri, soapBaseUri })` with the collected values. Omit fields that are already set. The tool merges and saves.

`sfmc-connection.config.example.json` contains a placeholder template if the caller needs a reference format.

## MCP tools

`scripts/mcp-server.mjs` speaks stdio using the MCP SDK. Start with `npm run mcp`. Tools:

- `get_connection_config()` — returns current connection config status; lists missing fields and never exposes secret values.
- `set_connection_config({ clientId?, clientSecret?, authBaseUri?, restBaseUri?, soapBaseUri? })` — saves provided fields; merges with existing values.
- `list_migration_recipes({ direction?, family? })` — summaries filtered by direction and family.
- `get_migration_recipe({ id })` — full recipe object.
- `get_endpoint_for_task({ task, direction?, family? })` — ranked operations by keyword overlap.
- `lookup_scope_for_operation({ operation_id })` — scopes, permission IDs, and permission paths.
- `describe_operation({ operation_id })` — flattened method/path/summary/parameters/responses.
- `resolve_polling_target({ operation_id })` — the status/results pollers for a kicker operation.
- `plan_migration({ recipe_ids?, task?, direction?, family?, limit? })` — compose a sequential migration plan from explicit recipes or ranked recipe matches.

The server never makes SFMC calls.

## Runtime preconditions

Before running any recipe, the agent must have:

- **A valid access token.** Acquire via `post_v2_token` (OAuth 2.0 server-to-server) or the legacy `post_v1_requestToken` path. Cache and refresh early.
- **Explicit BU/MID context.** If the recipe touches a child business unit, pass the `account_id` in the token request or the request body where supported.
- **A rate-limit budget.** SFMC returns `429` under load; agents should implement exponential backoff.
- **The scopes listed in `prerequisites.scopes`.** If missing, abort before the first mutating call.

## Failure handling

- `400` — fail the step; surface the error body to the caller.
- `401` — refresh the token once, retry; if still `401`, abort.
- `403` — missing scope or permission; abort and report which scope is needed (from `x-sfmc-installed-package-scopes`).
- `404` — either the resource doesn't exist (may be expected in idempotent delete) or the BU is wrong; check token context before retrying.
- `429` — back off. Prefer exponential with jitter. Respect any `Retry-After` header.
- `5xx` — retry idempotent reads; for writes, only retry if the recipe declares an idempotency key.

## Known non-goals

- **No orchestration engine.** Recipes are plans, not workflows. Branching, parallelism, and conditional logic belong to the agent.
- **No token caching.** Access tokens acquired via `post_v2_token` are the agent's responsibility to cache and refresh; only the installed-package credentials (client ID, secret, base URIs) are stored locally.
- **No cross-tenant migration as a single recipe.** Compose an `export-*` recipe with an `import-*` recipe if you need to move between SFMC tenants.
- **No send-time orchestration.** Send endpoints are `x-migration-direction: control-plane` and should not appear as recipe steps.
