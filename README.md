# Salesforce Marketing Cloud Engagement REST OpenAPI Spec

## Project purpose

This project turns a large slice of the Salesforce Marketing Cloud Engagement REST surface into a usable OpenAPI 3.0.3 contract.

The starting point was the SFMC REST permission and installed-package scope matrix. From there, the spec was normalized into valid OpenAPI paths, enriched with endpoint narrative, and annotated with SFMC-specific vendor extensions:

- `x-sfmc-permission-ids`
- `x-sfmc-user-permission-paths`
- `x-sfmc-installed-package-scopes`
- `x-original-marketing-cloud-paths`

This is not a verbatim export from Salesforce. It is a developer-facing integration artifact built from official SFMC documentation plus the supplied permission matrix.

## Artifact

- `sfmc_marketing_cloud_openapi.yaml`

## What the spec covers

Current API families in the YAML:

- OAuth, token, discovery, token context
- address validation
- domain verification
- Data Extensions and data events
- classic triggered email
- transactional email
- transactional SMS
- file-location keys
- campaigns
- MobileConnect SMS
- Contacts / Contact Builder
- Journey Builder
- Mobile Push
- Content Builder assets and folders
- approvals
- tags
- Event Notification Service
- audit logging

## Current maturity

Best way to read the spec today:

- **broad endpoint inventory** across major SFMC REST families
- **permission and scope map** for installed packages and user permissions
- **partially hardened contract** with many concrete request and response models in the highest-value areas
- **still mixed strictness** across long-tail operational routes where Salesforce docs are fragmented, polymorphic, or only loosely typed

The spec is useful now for:

- internal API documentation
- middleware and adapter design
- route discovery and permission planning
- client implementation planning
- codegen experiments on the better-modeled families
- onboarding developers who need one place to understand the SFMC REST surface

## What changed in the latest pass

Spec version: `0.16.0`

This pass tightened two of the biggest remaining weak spots.

### Executed in this pass

1. **Contacts long-tail response cleanup**
   - tightened delete analytics and delete-operation monitoring routes
   - tightened Contact Builder schema and attribute-group retrieval routes
   - replaced broad fallback contracts on these routes with concrete contact-oriented schemas
   - wired attribute-set and contact upsert operations to specific request and response schemas

2. **Journey Builder lifecycle and status cleanup**
   - tightened:
     - journey audit retrieval
     - publish status lookup
     - contact exit request
     - contact exit status lookup
     - contact membership lookup
     - publish / pause / resume / stop lifecycle actions
   - added route-specific Journey Builder schemas instead of using only generic success envelopes

3. **Fallback-schema language cleanup**
   - removed the lingering explicit placeholder wording from the fallback schema descriptions
   - the YAML now describes fallback objects honestly as broad compatibility schemas, not TODO placeholders

## What is in better shape now

These sections are relatively stronger:

- auth and token flows
- transactional email and transactional SMS core routes
- Data Extension row operations
- Content Builder assets and categories
- ENS callbacks and subscriptions
- campaigns, approvals, tags, and file-location keys
- Contacts core upsert/delete-monitoring routes
- Journey Builder lifecycle and contact-exit routes

## What still needs more work

The spec is better, but it is still not fully strict.

Main remaining gaps:

- MobileConnect detail/status/reporting routes
- Mobile Push detail/status/reporting routes
- Contacts audience and preference long-tail variants
- Journey Builder collection/detail responses outside the lifecycle/status routes
- utility/discovery routes that still use broad fallback success bodies
- broader response typing and more realistic examples across long-tail endpoints

## How developers should use this

### 1. Treat it as the contract layer for an integration wrapper

This artifact is most valuable as the contract for a small internal SFMC client or gateway. That lets you:

- centralize auth and token refresh
- hide subdomain discovery from app teams
- enforce consistent error handling and retries
- map SFMC quirks into cleaner internal abstractions
- keep permission and scope decisions explicit

### 2. Do not assume every route is fully codegen-ready

Some families are solid enough for SDK generation experiments. Others still use fallback schemas because SFMC does not publish one consistent machine-readable contract across the whole REST surface.

Use the YAML as:

- a primary route catalog
- a documentation source
- a starter contract for hand-tuned clients
- a codegen source only after checking the target family’s strictness level

### 3. Model around business unit context early

SFMC auth is tenant-aware and BU-sensitive. Build this into your client from the start.

Important points:

- OAuth server-to-server integrations use the tenant-specific auth base and `v2/token`
- access tokens expire after 20 minutes
- `account_id` lets you target a child business unit when requesting the token
- REST base URLs can vary by tenant and should be discovered rather than hard-coded citeturn975084search10

### 4. Plan scopes from the permission matrix, not just from endpoint names

The same functional area can require different installed-package scopes depending on operation type.

Examples:

- read vs write for Data Extensions
- email send vs email write for transactional messaging
- `journeys_read` for Journey Builder management routes in the supplied permission matrix
- Contacts read/write separation through `list_and_subscribers_read` and `list_and_subscribers_write` citeturn975084search8

### 5. Prefer newer messaging patterns where appropriate

For new build work:

- prefer **transactional messaging** for modern email and SMS send-definition flows
- use classic triggered sends only when you are tied to older patterns or existing assets

That matches Salesforce’s current messaging direction. citeturn975084search10

## Developer implementation notes

### Auth checklist

- use tenant-specific auth subdomain
- request tokens with server-to-server credentials
- cache token with safe early refresh
- support optional `account_id` per request context
- keep auth base URL separate from REST base URL

### Error-handling checklist

- handle `400`, `401`, `403`, `404`, `429`, and `5xx` consistently
- retry only where the operation is safe and idempotent enough
- log correlation IDs or request IDs from SFMC responses when present
- distinguish validation failures from permission/scope failures

### Codegen checklist

Before generating a client for a family, verify:

- request bodies are not still using broad fallback schemas
- success responses are not still using broad fallback envelopes
- normalized path variants match the current Salesforce docs for the routes you plan to implement
- enums and pagination semantics are acceptable for your target language/runtime

### Testing checklist

- validate the YAML in Swagger Editor or another OpenAPI validator
- exercise token acquisition and BU scoping first
- test at least one happy path and one auth/scope failure per family
- test throttling and duplicate-send protections where relevant
- confirm Journey Builder and Contacts routes in a sandbox before production use

## SFMC-specific references developers should keep handy

### Official Salesforce references

- REST API overview and reference entry point: developer.salesforce.com SFMC REST overview citeturn975084search10
- REST permission IDs and installed-package scopes: Salesforce permission/scope matrix citeturn975084search8turn975084search15
- server-to-server token flow and `account_id`: Salesforce access token guide citeturn975084search10
- Journey Builder API specification: Journey Builder API guide citeturn975084search5
- event definition schema: Journey event-definition schema guide citeturn975084search19
- publish status route: Journey publish-status reference citeturn975084search2
- contact-exit status route: Journey contact-exit status reference citeturn975084search0
- Contacts update route and data model references: Contacts REST references citeturn975084search4turn975084search21turn975084search13
- Push API summary: Mobile Push reference summary citeturn975084search12

### Practical companion references to keep nearby

These are not separate project artifacts, but they are worth keeping open while building:

- installed package configuration in SFMC
- business unit hierarchy and MID mapping for `account_id`
- naming standards for external keys, definition keys, and data extension keys
- send-governance rules for SMS, email, and push
- your internal retry, idempotency, and observability standards

## Files in this project

- `sfmc_marketing_cloud_openapi.yaml`
- `README_sfmc_openapi.md`
- `TODO_sfmc_openapi.md`

## Backlog

Open work is tracked separately in:

- `TODO_sfmc_openapi.md`
