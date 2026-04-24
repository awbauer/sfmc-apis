# Salesforce Marketing Cloud Engagement REST OpenAPI Spec

## What this project is

This project is a hand-built OpenAPI 3.0.3 contract maintained as a comprehensive inventory of the Salesforce Marketing Cloud Engagement REST API surface.

It is not an official Salesforce export. It is a developer artifact built from:

- the SFMC REST permission and installed-package scope matrix
- Salesforce REST reference pages
- normalization work required to turn the published route inventory into valid OpenAPI paths and reusable schemas

The goal is simple: give developers one place to understand SFMC REST routes, auth expectations, scopes, and payload shapes without bouncing across dozens of documentation pages.

## Primary artifacts

- `specs/sfmc_marketing_cloud_openapi.yaml` (entrypoint OpenAPI document)
- `specs/paths/*.yaml` (tag-family path fragments referenced by the entrypoint)

## What is in the YAML

The spec currently includes route coverage for:

- OAuth, token, discovery, token context
- address validation
- domain verification
- Data Extensions and data events
- classic triggered email
- transactional email
- transactional SMS
- transactional OTT (WhatsApp)
- file-location keys
- campaigns
- MobileConnect SMS
- GroupConnect chat messaging (Facebook Messenger, LINE)
- Contacts / Contact Builder
- Journey Builder
- Automation Studio (automations and legacy beta definitions)
- Mobile Push
- Content Builder assets and folders
- Content Builder asset type taxonomy
- approvals
- tags
- Event Notification Service
- audit logging

The spec also carries SFMC-specific vendor extensions on operations:

- `x-sfmc-permission-ids`
- `x-sfmc-user-permission-paths`
- `x-sfmc-installed-package-scopes`
- `x-original-marketing-cloud-paths`

Those are useful when you need to line up runtime behavior with installed package scopes and SFMC UI permissions.

## Current state

Spec version: `0.18.0`

Family breadth now mirrors the published Salesforce Marketing Cloud Engagement REST surface; depth per family is still mixed in strictness.

What is solid enough to use today:

- route inventory across the covered families
- permission and scope mapping
- auth and discovery documentation
- many concrete request and response models in the most important write flows
- enough structure to support internal docs, middleware design, and selective client generation

What is still uneven:

- some long-tail routes still fall back to broad request or response objects
- some operational status/detail endpoints still need tighter schemas
- some normalized paths still need one more doc-verification pass against current Salesforce references

## What changed in the latest pass

This pass expanded the spec from a permission-matrix slice into a comprehensive inventory of SFMC REST API families.

### Inventory expansion to comprehensive coverage

1. **Added Automation Studio** (`/automation/v1/automations`, `/automation/v1/automations/{id}`, `/automation/v1/automations/{id}/actions/{action}`, and the widely-used legacy beta routes under `/legacy/v1/beta/automations/*`).

2. **Added Transactional OTT / WhatsApp** (`/messaging/v1/ott/definitions`, `/messaging/v1/ott/definitions/{definitionKey}`, queue metrics, `/messaging/v1/ott/messages` and `/messaging/v1/ott/messages/{messageKey}`), mirroring the transactional email shape.

3. **Added GroupConnect chat messaging** (`/ott/v1/registration`, `/ott/v1/sendMessage`) for Facebook Messenger and LINE channels.

4. **Added Content Builder asset type taxonomy** (`/asset/v1/content/assetTypes`, `/asset/v1/content/assetTypes/{id}`) with typed `ContentAssetTypeItem` and `ContentAssetTypeListResponse` response schemas.

5. **Declared new oauth2 scopes** — `automations_read`, `automations_write`, `automations_execute`, `ott_channels_read`, `ott_channels_send`, `ott_channels_write` — and four new tags (`Automation Studio`, `Transactional OTT`, `GroupConnect Chat`, `Asset Types`).

6. **Added typed helper schemas** — `AutomationSummary`, `AutomationListResponse`, `AutomationActionRequest`, `AutomationActionResponse` — wired into the list and action endpoints.

7. **Reframed the README and `info.description`** away from "a broad slice" to a comprehensive-inventory framing, keeping the honest caveat that some long-tail routes still rely on broad fallback schemas.

8. **Bumped the spec version** from `0.17.0` to `0.18.0`.

## Best ways to use this project

### Use it as the contract for an internal SFMC client

That is the strongest use case.

A small internal client or gateway can use this spec to:

- centralize token acquisition and refresh
- handle tenant endpoint discovery once
- enforce consistent retries and throttling behavior
- keep BU targeting explicit
- hide SFMC route quirks from app teams

### Use it as a route and permission map

Even when you do not generate a client, the spec is useful for:

- finding the right endpoint family
- checking installed-package scope requirements
- checking SFMC UI permission dependencies
- reviewing route variants by key vs id

### Use codegen selectively

Some families are modeled tightly enough for SDK experiments. Others still need hand-tuning.

Before generating a client for a family, check whether that family still relies on:

- `GenericRequestBody`
- `GenericResponse`

If it does, expect manual work.

## Developer guidance for working with SFMC

### Auth model

Build around tenant-specific auth and short-lived access tokens.

Practical rules:

- keep auth base URL separate from REST base URL
- cache the token and refresh early
- support `account_id` when you need child business unit context
- treat discovery and token-context routes as bootstrap helpers, not business APIs

### Business unit targeting

A lot of SFMC confusion is really BU confusion.

Build your client so BU context is explicit:

- accept BU / MID input at the client boundary
- resolve token context once and log it
- do not assume the token always points at the intended BU

### Scopes and permissions

Do not infer installed-package scopes from endpoint names alone.

Examples:

- read and write routes in the same family often split across different scopes
- send routes can differ from create/update routes in the same family
- user permissions and installed-package scopes are related but not identical concerns

Use the vendor extensions in the spec when planning package setup or access troubleshooting.

### Messaging choices

For new work:

- prefer transactional messaging when it fits the use case
- use classic triggered sends mainly for legacy compatibility or existing asset patterns

### Error handling

Across SFMC, you should consistently handle at least:

- `400`
- `401`
- `403`
- `404`
- `429`
- `5xx`

At minimum, log request identifiers or correlation fields when SFMC returns them.

### Testing strategy

Good first smoke tests:

1. acquire a token
2. confirm discovery endpoints
3. confirm token context / BU assumptions
4. test one write and one read in each family you care about
5. test one permission failure and one throttling scenario

## Helpful references for developers

Official Salesforce references worth keeping open while developing:

- Marketing Cloud REST API overview  
  https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/rest-api-overview.html

- REST API permission IDs and installed-package scopes  
  https://developer.salesforce.com/docs/marketing/marketing-cloud/references/mc_rest_rest_permission_scopes/rest-permissions-and-scopes.html

- Server-to-server access token flow  
  https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/access-token-s2s.html

- API Integration Permission Scopes  
  https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/api-integration.html

- Transactional Messaging comparison and guidance  
  https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/transactional-messaging-comparison.html

- Transactional Messaging Email reference  
  https://developer.salesforce.com/docs/marketing/marketing-cloud/references/mc_rest_transactional_messaging_email

- Transactional Messaging SMS reference  
  https://developer.salesforce.com/docs/marketing/marketing-cloud/references/mc_rest_transactional_messaging_sms

- Contacts REST reference entry points  
  https://developer.salesforce.com/docs/marketing/marketing-cloud/references/mc_rest_contacts

- Journey Builder API reference  
  https://developer.salesforce.com/docs/marketing/marketing-cloud/references/mc_rest_interaction

- MobilePush API reference  
  https://developer.salesforce.com/docs/marketing/marketing-cloud/references/mc_rest_push

- Content Builder API reference  
  https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/content-api.html

- Event Notification Service reference  
  https://developer.salesforce.com/docs/marketing/marketing-cloud/references/mc_rest_platformEventsNotification

## Suggested workflow for teams using this spec

1. start from the YAML for route discovery and scope planning
2. verify the exact route behavior in the linked Salesforce docs for the family you are implementing
3. generate or hand-build a small typed client only for the families you need
4. patch local schema gaps as you learn more from real API calls
5. feed those improvements back into the YAML

## Project files

- `sfmc_marketing_cloud_openapi.yaml`
- `README_sfmc_openapi.md`
- `TODO_sfmc_openapi.md`

## Build Swagger site

This repository includes an npm build step that generates a static Swagger-style docs site from the OpenAPI spec.

```bash
npm install
npm run build
```

Build output:

- `dist/index.html` (generated docs site)
- `dist/sfmc_marketing_cloud_openapi.yaml` (copied root spec used by the docs site)
- `dist/paths/*.yaml` (copied path fragments required for `$ref` resolution)
