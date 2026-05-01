# SFMC Tenant Validation Findings

_Date:_ 2026-04-30

## Goal

Validate whether `sfmc-apis` works in practice as an agent-support toolkit for a real Salesforce Marketing Cloud (SFMC) tenant, with emphasis on safe, read-only migration discovery flows.

## Environment

- Repo: `awbauer/sfmc-apis`
- Repo URL: https://github.com/awbauer/sfmc-apis
- Visibility: Private
- Default branch: `main`
- Local clone: `/Users/andrewbauer/GitHub/sfmc-apis`

## Initial Repo Validation

Ran `npm run validate` locally.

### Result

Validation passed.

### What passed

- OpenAPI validation passed
- `operationId` uniqueness check passed
- scope sync check passed
- migration extension integrity check passed
- migration catalog build passed
- bundled OpenAPI artifact build passed

### Warnings

Spectral reported warnings but no errors:

- several trailing-slash path warnings
- missing `info.contact`
- a few apparently unused schemas/components

## MCP / Agent Surface Validation

The repo's MCP server successfully exposed these read-only tools:

- `list_migration_recipes`
- `get_migration_recipe`
- `get_endpoint_for_task`
- `lookup_scope_for_operation`
- `describe_operation`
- `resolve_polling_target`

### What worked well

- listing recipes
- retrieving full recipe definitions
- looking up scopes for known operations
- resolving polling relationships for async operations
- describing operations in a flattened, agent-friendly form

### Rough edges observed

- `get_endpoint_for_task` appears sensitive to exact token overlap and can miss plausible requests
- family filtering appears inconsistent because recipe-style family slugs and human-readable tags do not always line up cleanly
- several operation summaries/descriptions are mechanically correct but not very helpful for an agent

## Tenant Authentication Test

Used installed-package credentials to request an access token from the tenant.

### Result

Authentication succeeded.

### Token response notes

- HTTP status: `200`
- token type: `Bearer`
- token lifetime observed: ~1079 seconds
- returned REST and SOAP instance URLs matched tenant configuration

### Scope snapshot observed during test

The token response included 36 scopes, including:

- `journeys_read`
- `email_read`
- `data_extensions_read`
- `documents_and_images_write`
- `saved_content_read`
- `automations_read`
- `push_read`
- `sms_read`
- `users_read`
- `accounts_read`

## Read-Only Endpoint Validation Against Tenant

I intentionally limited validation to read-only calls.

## Journey Builder Export-Oriented Validation

This maps closely to the repo's `export-journey-definitions` recipe.

### Calls tested

- `GET /interaction/v1/interactions`
- `GET /interaction/v1/eventDefinitions`
- `GET /interaction/v1/interactions/{id}`

### Results

All tested calls succeeded with HTTP `200`.

### Observed tenant data

- journeys count: `896`
- event definitions count: `784`

### Sample successful journey detail

Confirmed successful detail fetch for a sample journey:

- name: `Demo`
- version: `1`
- triggers: `1`
- activities: `13`

### Conclusion

The repo's Journey Builder export recipe is grounded in working tenant behavior and is viable as an agent planning surface.

## Content Builder Export-Oriented Validation

This maps to the repo's folder and asset export recipes.

### Calls tested

- `GET /asset/v1/content/categories`
- `POST /asset/v1/content/assets/query`
- `GET /asset/v1/content/assets/{id}`

### Results

All tested calls succeeded with HTTP `200`.

### Observed tenant data

- content categories count: `639`
- root `Content Builder` folder sample asset count observed: `1377`

### Sample successful asset detail

Confirmed successful asset detail fetch for asset id `584338`:

- name: `HeatMap`
- asset type: `packagedeployment`
- category: `Content Builder`

### Notable behavior

An initial folder-specific asset query returned zero items for one sampled child folder, but subsequent queries against other folders and the root folder worked correctly. This suggests the export recipe is viable, though sampling logic should avoid assuming every folder contains assets.

## Important Scope Observation

There is a potentially important mismatch between observed runtime behavior and the package scope list.

### Observation

The token scope snapshot clearly showed `documents_and_images_write`, but did not clearly surface a corresponding `documents_and_images_read` scope in the returned list.

### However

Read-only Content Builder endpoints still succeeded.

### Possible explanations

- SFMC may allow read behavior under this package configuration in a way that is not obvious from the scope list alone
- the token response may not fully reflect effective access in the way the repo assumes
- the repo's prerequisite/scope assumptions may be stricter than actual tenant behavior for some Content Builder reads

### Recommendation

The scope/prerequisite logic in `sfmc-apis` should be reviewed against real tenant behavior, especially for Content Builder read operations.

## Overall Assessment

`sfmc-apis` is already useful as an agent-support toolkit for SFMC migration planning.

### Strong points

- good structure for recipe-driven migration planning
- useful agent-oriented catalog and MCP surface
- scope, polling, and sequencing metadata are valuable in practice
- validated successfully against a live tenant for Journey Builder and Content Builder read flows

### Current limitations

- endpoint/task search should rank and normalize better
- family filtering should be more robust
- some descriptions should be made more agent-readable
- tenant smoke testing should be formalized into a repeatable script

## Recommended Next Steps

1. Add a tenant smoke-test script to the repo
   - auth
   - journey list
   - journey detail
   - event definition list
   - content category list
   - content asset query
   - content asset detail

2. Tighten scope/prerequisite handling
   - especially around Content Builder read behavior

3. Improve endpoint search/ranking
   - normalize tag/family matching
   - improve free-text lookup quality

4. Improve operation descriptions
   - especially async kickoff vs polling/result operations

## Security Note

The client secret used for testing was provided directly in chat. It should be rotated after testing is complete.
