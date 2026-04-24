# Migration Recipes

This directory is the recipe library for SFMC migration agents. Each `.yaml` file describes, step by step, how to move data, assets, or configuration into or out of Salesforce Marketing Cloud Engagement.

## Schema

All recipes must conform to `_schema.yaml` (JSON Schema expressed in YAML). Run `npm run check:migrations` to validate.

## File naming

```
<direction>-<family>-<slug>.yaml
```

- `direction` is `import` or `export`.
- `family` matches an OpenAPI tag family slug — e.g. `content-builder`, `data-extensions`, `journey-builder`.
- `slug` is a short kebab-case descriptor.

Examples:
- `export-content-builder-assets-by-folder.yaml`
- `import-data-extension-rows.yaml`
- `export-journey-definitions.yaml`

## Validation rules (enforced by `scripts/check-migration-extensions.mjs`)

- Every `operation_id` referenced by a `steps[].operation_id` or a `polling.poll_operation_id` must exist in the OpenAPI.
- Every referenced operation must carry `x-migration-direction` (the direction itself is advisory but must be present).
- `x-bulk-capable` must be a boolean where present.
- `x-polling-endpoint-of` must reference a known `operationId`.
- The recipe must parse against `_schema.yaml`.

## Adding a recipe

1. Pick a filename per the convention above.
2. Copy an existing recipe as a template; adjust `id` to match the filename stem.
3. List every SFMC operation you will call in `steps[]`, in order.
4. Annotate any async step with a `polling` block referencing the poller's `operation_id`.
5. Annotate idempotency at the step level; give a recipe-level `idempotency_notes` summary.
6. Add `field_mapping_hints[]` if the recipe transforms field shapes.
7. Run `npm run check:migrations` and `npm run catalog` locally.

## Non-goals

- No branching or DAG structure — recipes are sequential.
- No embedded authentication or credential storage.
- No cross-tenant orchestration as a single recipe. Compose an export with an import.
