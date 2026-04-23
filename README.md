# Salesforce Marketing Cloud Engagement REST API OpenAPI Spec

## Project overview

This project is a working OpenAPI representation of a large portion of the Salesforce Marketing Cloud Engagement REST API surface.

Primary artifact:

- `sfmc_marketing_cloud_openapi.yaml`

The spec began from the SFMC REST permission and installed-package scope matrix, then was normalized into valid OpenAPI paths and incrementally tightened with family-specific request and response models.

This is not a perfect mirror of a single official machine-readable Salesforce contract because Salesforce does not publish one unified, fully typed OpenAPI file for the full SFMC REST surface. Instead, this repo acts as a practical developer asset for:

- endpoint discovery and API inventory
- auth and scope planning
- contract-first integration design
- SDK generation experiments against the better-modeled families
- implementation support for teams building against SFMC

## Current state

- OpenAPI version: `3.0.3`
- Spec version: `0.15.0`
- Primary format: YAML

### API families currently covered

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

## What this spec is good for

Use it when you need to:

- map SFMC REST endpoints to installed-package scopes
- understand which routes belong to which functional API family
- bootstrap API clients or typed interfaces for the better-modeled sections
- support middleware, integration, or orchestration services that sit in front of SFMC
- document internal integration contracts for engineering teams
- compare classic triggered send routes with transactional messaging routes

## What this spec is not yet good for

Do not treat it as a complete canonical validator for the entire SFMC REST estate.

Some routes remain intentionally broad because Salesforce documentation is fragmented, polymorphic, or endpoint-specific without one stable contract shape across every route. The spec is materially useful, but parts of it are still best viewed as a typed inventory rather than a fully production-hardened SDK source.

## Practical developer guidance

### 1. Start with auth, not endpoints

For most server-side integrations, use the server-to-server OAuth flow with the `v2/token` endpoint tied to the Authorization Base URI from Installed Packages. Access tokens are reusable for 20 minutes, and you can target a specific business unit by passing `account_id` in the token request. citeturn799155search0

Developer implications:

- cache the token until close to expiry
- do not request a new token per API call
- treat `account_id` as a first-class part of your environment strategy if you work across business units
- keep package scopes minimal and explicit

### 2. Treat scopes as design input

The permission matrix is one of the strongest anchors in this project. The spec preserves the source permission IDs, user-permission paths, and installed-package scopes in vendor extensions so teams can reason about least-privilege package setup during implementation. The underlying scope mapping comes from Salesforce's REST permission and scope documentation. citeturn799155search2turn799155search0

Useful vendor extensions in the YAML:

- `x-sfmc-permission-ids`
- `x-sfmc-user-permission-paths`
- `x-sfmc-installed-package-scopes`
- `x-original-marketing-cloud-paths`

### 3. Prefer transactional messaging for new triggered use cases

SFMC documents transactional messaging as the modern pattern, with more consistent RESTful resources and cross-channel alignment than classic triggered sends. Classic triggered sends remain important for legacy implementations, but new builds should generally evaluate the transactional APIs first. citeturn799155search4

### 4. Expect Content Builder payloads to be asset-model driven

Content Builder is built around the asset model. Asset type, content, category, and related substructures matter more than route shape alone. Asset creation often depends on `assetType.id`, category placement, and content structure. File upload also has a documented 5 MB limit for base64 file payloads. citeturn799155search1turn799155search8turn799155search10

### 5. Use the spec as a development accelerator, not the only source of truth

For any route you intend to put into production immediately, check:

- exact request field requirements in Salesforce docs
- actual response bodies from your target business unit
- permissions and installed-package scopes
- channel or asset-type specific variations

This matters most for Contacts, Journey Builder lifecycle operations, MobileConnect delivery/reporting routes, and Mobile Push detail/status routes.

## How to use the YAML during development

### Option A: Documentation and exploration

- load the YAML into Swagger UI, Redoc, Stoplight, Postman, or Insomnia
- use tags and vendor extensions to inspect route families and scopes
- identify which endpoints still use generic request or response models before codegen

### Option B: Client generation

Recommended approach:

1. generate clients only for the better-modeled families first
2. isolate generic sections behind handwritten wrappers
3. layer environment-specific auth and business-unit handling above the generated client
4. add contract tests against a real SFMC tenant before relying on generated models

Best codegen candidates right now:

- OAuth and discovery
- Transactional email
- Transactional SMS
- Data Extensions async flows
- Data Events row operations
- Content Builder assets and folders
- ENS callbacks and subscriptions
- Audit logging

### Option C: Internal API facade or middleware

This spec is a strong starting point if your team plans to place a thin service layer in front of SFMC. Common patterns:

- token management and retries centralized in one service
- business-unit routing handled outside application code
- SFMC payload normalization for downstream callers
- scope-aware internal endpoints that hide SFMC route sprawl

## Modeling decisions used in this project

### Normalized paths

Some source entries from the permission matrix were truncated, inconsistent, or not directly safe to use as OpenAPI paths. Those were normalized into valid paths and preserved in `x-original-marketing-cloud-paths` so the original source value is not lost.

### Family-first tightening

The spec has been improved by API family rather than by single endpoint order. That keeps the schema surface more coherent and more reusable.

### Shared error envelopes

Common error responses have been introduced across the spec so teams have a stable baseline for integration handling even where route-specific success bodies remain broad.

### Broad contracts where Salesforce is broad

Some routes still use generic contracts because the public docs are descriptive but not fully machine-readable, or because the response shape varies substantially by asset type, message type, or operational status.

## Known caveats

- The spec is not yet fully typed end to end.
- Some response models remain generic.
- A few routes are normalized rather than copied verbatim from one official source line.
- Polymorphic SFMC resources, especially content and operational status endpoints, may need route-by-route refinement before strict validation or SDK generation.
- Real tenant behavior can differ slightly by channel configuration, feature enablement, and business-unit setup.

## Current coverage quality

These areas are in relatively better shape:

- auth and discovery
- transactional email
- transactional SMS
- Data Extensions async flows
- Data Events row write flows
- Content Builder assets and folders
- ENS callbacks and subscriptions
- audit logging
- Contacts core operational routes
- Journey Builder operational routes
- MobileConnect core operational routes
- Mobile Push core operational routes
- campaigns
- approvals
- tags
- file-location keys

## Recommended workflow for developers

### Environment checklist

Before building:

- confirm the installed package uses the scopes your integration actually needs
- confirm the correct Authorization Base URI and REST Base URI for the target tenant
- decide whether the integration is enterprise-level or BU-specific
- confirm which API family you are actually using, especially for email sends
- verify whether the target feature is enabled in the account

### Testing checklist

Before shipping:

- validate auth and BU context with a real token call
- test at least one read route and one write route in the target BU
- confirm error handling for 401, 403, 429, and 5xx responses
- inspect real response payloads for fields the docs under-specify
- log SFMC correlation identifiers where available

### Suggested implementation order

For greenfield builds:

1. OAuth token acquisition and caching
2. discovery and token-context sanity checks
3. one narrow functional family, such as transactional email or Content Builder
4. error handling and retry policy
5. only then branch into Contacts, journeys, push, or long-tail operational routes

## Helpful Salesforce references

These are the most useful official references to keep next to the spec while developing.

### Core platform and auth

- Marketing Cloud Engagement APIs overview: <https://developer.salesforce.com/docs/marketing/marketing-cloud/overview>
- Access token for server-to-server integrations: <https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/access-token-s2s.html>
- REST API permission IDs and scopes: <https://developer.salesforce.com/docs/marketing/marketing-cloud/references/mc_rest_rest_permission_scopes/rest-permissions-and-scopes.html>

### Messaging

- Transactional API sends compared to classic triggered sends: <https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/transactional-messaging-comparison.html>

### Content Builder

- Content Builder API guide: <https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/content-api.html>
- Assets reference summary: <https://developer.salesforce.com/docs/marketing/marketing-cloud/references/mc_rest_assets>
- Asset types: <https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/base-asset-types.html>
- Asset type field details: <https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/asset_type.html>
- Content field details: <https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/content.html>
- File upload guidance: <https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/file_upload.html>
- Asset model examples: <https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/asset_model_examples.html>

## File inventory

- `sfmc_marketing_cloud_openapi.yaml`  
  Main OpenAPI artifact.

- `README_sfmc_openapi.md`  
  Project overview, usage guidance, and reference material.

- `TODO_sfmc_openapi.md`  
  Open items, backlog, and next modeling passes.

## Suggested bar for v1.0

Treat the spec as ready for broader internal use when:

- top-priority operational routes no longer use generic request bodies
- response precision is good enough for codegen in the main families
- examples exist for core auth, messaging, contacts, journeys, assets, and data-extension async operations
- normalized paths have been checked against canonical docs where possible
- the file validates cleanly in OpenAPI tooling and can generate at least one client without manual surgery

## Summary

This project is already useful. It gives developers a much more structured way to work through SFMC than jumping between disconnected docs and permission tables.

It is also still a work in progress. The right way to use it today is as a strong implementation guide, a scope map, and a codegen starter for the better-modeled families, while continuing to harden the long tail.
