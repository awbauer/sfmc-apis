# Salesforce Marketing Cloud Engagement REST API OpenAPI Spec

## What this is

This repo artifact contains a working OpenAPI 3.0.3 spec for a large slice of the Salesforce Marketing Cloud Engagement REST surface:

- `sfmc_marketing_cloud_openapi.yaml`

The spec was built from the SFMC REST API permission/scope matrix you provided, then normalized into valid OpenAPI paths and operations.

It is best understood as a **broad endpoint inventory plus initial contract model**, not a finished production-grade SDK contract.

## Current scope

The spec currently includes these API families:

- Auth and discovery
- Address validation
- Domain verification
- Data Extensions and data events
- Classic triggered email
- Transactional email
- Transactional SMS
- File location keys
- Campaigns
- MobileConnect SMS
- Contacts / Contact Builder
- Journey Builder
- Mobile Push
- Content Builder assets and folders
- Approvals
- Tags
- Event Notification Service
- Audit logging

## What is modeled today

The current YAML includes:

- valid OpenAPI structure with servers, tags, paths, components, and security
- endpoint inventory for the routes in your permissions matrix
- narrative descriptions for operations
- vendor extensions preserving your source mapping:
  - `x-sfmc-permission-ids`
  - `x-sfmc-user-permission-paths`
  - `x-sfmc-installed-package-scopes`
  - `x-original-marketing-cloud-paths`
- normalized path definitions where the source table was truncated, inconsistent, or not directly OpenAPI-safe

## Important limitation

This is **not yet fully typed end to end**.

After reopening the file, there are still many places where the YAML contains generic placeholders such as:

- `GenericRequestBody`
- `GenericResponse`
- example blocks that say `Replace with the endpoint-specific request contract from Salesforce documentation`
- broad top-level language in `info.description` noting that some schemas are intentionally generic

So the spec is useful now for:

- API inventory and coverage mapping
- permissions and scope analysis
- architectural review
- starting point for codegen after another refinement pass

It is **not** yet ideal for:

- direct client generation without cleanup
- strict contract validation
- payload validation for all routes

## What is in better shape

These sections are in relatively better shape than the rest of the file:

- auth and discovery
- transactional messaging families
- content builder structure
- ENS structure
- campaigns / tags / approvals at a structural level
- contacts and journey builder improved versus the first pass, but still not fully complete across every route

## What still needs refinement

### 1. Remove all remaining placeholders
Search the YAML for:

- `Generic payload placeholder`
- `Replace with the endpoint-specific request contract`
- `GenericRequestBody`
- `GenericResponse`

These should be replaced with concrete request and response contracts where Salesforce docs support them.

### 2. Tighten responses, not just requests
A lot of routes still have generic success envelopes. Next pass should define concrete response schemas for:

- transactional sends
- contacts operations and status checks
- journey lifecycle actions
- SMS and push delivery/status endpoints
- asset query results and category listings
- ENS create/update/list results

### 3. Finish long-tail Contacts routes
Contacts is still one of the hardest families because Salesforce documentation is spread across Contact Builder, Contacts, preferences, and delete/restrict operations.

Areas to tighten:

- schema and attribute group retrieval
- delete/restrict status endpoints
- preference payloads and search variants
- audience search/count responses
- contact event payloads and responses

### 4. Finish Journey Builder lifecycle accuracy
Journey Builder paths were normalized from the permissions matrix, but some official route variants need another pass to confirm exact path, query, and version semantics.

Areas to revisit:

- publish async variants
- stop / pause / resume by id vs key
- contact exit and membership contracts
- audit action response modeling

### 5. MobileConnect cleanup
The legacy SMS endpoints still need the most cleanup outside Contacts.

Areas to tighten:

- import send payloads
- queue import / refresh list requests
- delivery report responses
- MO queue history/delivery result shapes
- message send request variants
- keyword management payloads

### 6. Mobile Push cleanup
Still needs more precise modeling for:

- location create/update payloads
- push message create/update/send contracts
- application key management responses
- delivery retrieval result envelopes

### 7. Error model standardization
The next version should define reusable SFMC-style error schemas and apply them consistently across all routes:

- 400 validation errors
- 401 auth errors
- 403 permission/scope failures
- 404 not found
- 429 throttling
- 5xx platform errors

### 8. Examples
The spec needs realistic request/response examples for the highest-value routes so consumers can use it immediately.

Priority examples:

- OAuth token
- transactional email send
- transactional SMS send
- data extension row upsert
- journey event injection
- contact upsert / delete / restrict
- asset create / update / query
- ENS callback and subscription setup

### 9. Canonical path verification
Some rows in the source permission matrix were truncated or malformed. The YAML preserves source strings via vendor extensions, but a final pass should compare every normalized path against Salesforce’s canonical endpoint docs.

## Recommended next steps

### Phase 1
Clean the current file before adding more endpoint detail.

1. Remove every remaining placeholder block
2. Replace `GenericRequestBody` and `GenericResponse` in the most-used routes
3. Add shared error schemas
4. Add concrete examples for core write operations

### Phase 2
Harden the two weakest operational families.

1. MobileConnect SMS
2. Mobile Push
3. Remaining Contacts edge cases
4. Journey lifecycle response accuracy

### Phase 3
Make it codegen-friendly.

1. Add operation-level request/response examples
2. Add enums where docs are stable
3. Add pagination schemas where applicable
4. Add more `oneOf` models instead of free-form objects
5. Run OpenAPI linting and schema validation
6. Generate a test SDK and fix issues found by codegen

## Suggested acceptance bar for a “v1.0” spec

Call the spec ready for broader use when it meets all of these:

- no placeholder text remains
- no generic request bodies remain for top-priority routes
- all major write operations have concrete request and response models
- shared error envelopes are applied consistently
- normalized paths have been checked against official docs
- examples exist for core send, content, contacts, and journey operations
- the file passes OpenAPI validation and can generate at least one client cleanly

## Deliverables so far

- `sfmc_marketing_cloud_openapi.yaml`
- this README documenting current status and next steps

## Recommended next execution pass

The cleanest next move is:

**MobileConnect + Mobile Push + response/error tightening across the whole spec**

That will remove the biggest remaining rough edges and move the file from “broad draft” to “usable contract.”
