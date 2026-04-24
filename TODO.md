# SFMC Migration Toolkit Backlog

## Current snapshot

- Spec version: `0.19.0`
- Remaining `GenericRequestBody` references: `93`
- Remaining `GenericResponse` references: `150`
- Fallback density by file (highest first): contacts `38`, content_builder `22`, mobile_push `19`, event_notification_service `18`, transactional_sms `15`, transactional_email `15`, transactional_ott `15`, mobileconnect_sms `15`, automation_studio `15`, tags `13`, data_extensions `12`, campaigns `10`, approvals `10`, journey_builder `6`, domain_verification `5`, file_locations `4`, groupconnect_chat `4`, triggered_email `2`, audit_logging `2`, address_validation `2`, discovery `1`, auth `0`.

This backlog tracks the work needed before agents can rely on this repo as a complete migration toolkit for SFMC: spec hygiene, typed schemas for migration-critical write flows, recipe coverage, and agent tooling. Migration recipes live in `specs/migrations/` and must stay in sync with the OpenAPI operations they invoke (enforced by `npm run check:migrations`). The items in §P0 are hard defects that block spec validation today.

## Recently completed

- Expanded coverage into a comprehensive inventory of SFMC REST families by adding
  Automation Studio (`/automation/v1/automations`, `/automation/v1/automations/{id}`,
  `/automation/v1/automations/{id}/actions/{action}`, and the legacy beta routes
  under `/legacy/v1/beta/automations/*`), Transactional OTT
  (`/messaging/v1/ott/definitions`, `/messaging/v1/ott/messages`,
  and related queue and detail routes), GroupConnect Chat (`/ott/v1/registration`,
  `/ott/v1/sendMessage`), and Content Builder asset-type taxonomy
  (`/asset/v1/content/assetTypes`, `/asset/v1/content/assetTypes/{id}`).
- Declared new `automations_read`, `automations_write`, `automations_execute`,
  `ott_channels_read`, `ott_channels_send`, `ott_channels_write` oauth2 scopes
  and added `Automation Studio`, `Transactional OTT`, `GroupConnect Chat`, and
  `Asset Types` tags.
- Added typed helper schemas (`AutomationSummary`, `AutomationListResponse`,
  `AutomationActionRequest`, `AutomationActionResponse`, `ContentAssetTypeItem`,
  `ContentAssetTypeListResponse`) and reframed the README and `info.description`
  away from "a broad slice" to a comprehensive-inventory framing.
- Tightened the core Auth family (`/v2/discovery`, `/v2/userinfo`, `/v2/authorize`,
  `/v2/token`, `/v1/requestToken`) by replacing fallback generic request/response
  schemas with purpose-built auth schemas.
- Added practical auth examples for authorize, token issuance, and legacy
  `requestToken` payloads.

---

## P0 — Spec integrity (blocks validation / codegen)

### 1. Define missing Journey lifecycle schemas

`specs/paths/journey_builder.yaml` references `JourneyLifecycleRequest` and
`JourneyLifecycleResponse` in 12 places (lines 744, 772, 803, 831, 860, 888,
917, 945, 974, 1002, 1031, 1059) but neither schema is defined anywhere. Add
purpose-built schemas or split into per-operation ones:

- `JourneyPauseRequest`: `{PauseDuration?, ExtendWaitEndDates?, AllVersions?}`
- `JourneyResumeRequest`: `{AllVersions?}`
- `JourneyStopRequest`: `{}` (no body required in most SFMC variants)
- `JourneyPublishAsyncResponse`: `{statusId}`
- `JourneyContactMembershipRequest/Response`: typed inputs/outputs

### 2. Fix `/v2/authorize` method and shape

Currently modeled as `POST` with `application/json` body
(`specs/paths/auth.yaml:78-129`). Per OAuth 2.0 and SFMC docs this is a browser
redirect: change to `GET`, remove `requestBody`, move `response_type`,
`client_id`, `redirect_uri`, `state`, `scope` to `parameters: in: query`, and
document the success as `302` with a `Location` header (not `200` JSON).
Repurpose or retire `AuthAuthorizeRequest` / `AuthAuthorizeResponse`.

### 3. Align declared oauth2 scopes with operation usage

`components.securitySchemes.oauth2.clientCredentials.scopes`
(`specs/sfmc_marketing_cloud_openapi.yaml:394-433`) is missing scopes actually
referenced by operations, including at least `data_extensions_read`,
`data_extensions_write`, and `automations_read`. Add them, and rename
`Contacts_access` to the canonical lowercase Salesforce scope identifiers
(`contacts_read` / `contacts_write` or the current published equivalent). Add
a scope-diff check to CI.

### 4. Resolve duplicate `/messaging/v1/email/messages` paths

`specs/paths/transactional_email.yaml:99` and `:230` both export variants of
this path (the second with a trailing slash). The entrypoint re-exports both
(`specs/sfmc_marketing_cloud_openapi.yaml:102-107`). Consolidate under the
canonical no-slash path with distinct HTTP methods.

### 5. Fix malformed `x-original-marketing-cloud-paths`

`specs/paths/file_locations.yaml` entries are missing the leading `/` (e.g.
`platform/v1/key`). Sweep all path files for the same pattern and normalize.

### 6. Make the spec validate cleanly

Run `swagger-cli validate` and Spectral against the entrypoint and fix every
error. Add both to CI.

---

## P1 — Cross-cutting architecture

### 7. Scope the auth host per operation

The root `servers:` list declares both REST and AUTH hosts; codegen will
attach `/v2/token` etc. to the REST host. Add operation-level `servers:`
overrides on `/v2/discovery`, `/v2/userinfo`, `/v2/authorize`, `/v2/token`,
`/v1/requestToken` pointing at
`https://{subdomain}.auth.marketingcloudapis.com`, or split auth into a
separate spec file.

### 8. Add a root-level default `security:`

The entrypoint declares no global `security:` default. Add one requiring
`bearerAuth` / `oauth2`, and explicitly set `security: []` on the
auth/discovery routes that legitimately do not require a token.

### 9. Introduce shared error schemas and responses

Today every `'400'/'401'/'403'/'404'/'429'/'500'` entry is description-only.
Add `components.schemas.ErrorResponse`
(`{message, errorcode, documentation, requestId}`) and `ErrorCollection`
(`{errors: [ErrorResponse]}`). Add `components.responses` entries
`BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `TooManyRequests`,
`ServerError` and `$ref` them from every operation.

### 10. Codify `additionalProperties` policy

- Request bodies → `additionalProperties: false` (catches client bugs).
- Response bodies → `additionalProperties: true` (SFMC evolves).

Sweep the existing schemas to conform.

### 11. Mark legacy routes `deprecated: true`

- `/v1/requestToken`
- MobileConnect SMS routes already flagged as "legacy" in description
- Any triggered-email route superseded by Transactional Messaging

### 12. Add reusable paging parameters

Define `components.parameters` for `$page`, `$pageSize`, `$filter`,
`$orderBy`, `$fields`, and apply to every collection GET — notably in
contacts, campaigns, content_builder, approvals, audit_logging,
journey_builder (`interactions`, `eventDefinitions`), tags/nestedtags, and
ENS subscriptions/callbacks.

---

## P2 — Replace fallbacks with typed schemas (biggest clusters first)

### 13. Transactional Email (15 generics)

- Definition create/update: `{definitionKey, name, classification[Transactional|Default Transactional], subject, content{customerKey|html|text}, subscriptions{list, autoAddSubscriber?, autoUpdateSubscriber?}, options{createJourney?, trackLinks?}, status?}`
- Send: `{definitionKey, recipient{contactKey,to,attributes}, options{requestType:SYNC|ASYNC}, subscriptions, attachments[{name,content,type}]}`
- Message status: `{messageKey, definitionKey, status, requestId}`
- Queue metrics response typed
- Confirm send success is `202 Accepted`, not `200`

### 14. Transactional SMS (15 generics)

- Definition create: `{definitionKey, name, content{message}, subscriptions{shortCode, countryCode, keyword?}, options?}`
- Typed queue metrics and send body
- Resolve path split: `/messaging/v1/sms/definitions` vs `/sms/definitions`
  vs `/sms/v1/definitions` — verify canonical against current docs and
  collapse to one base

### 15. Contacts (38 generics — largest cluster)

- Upsert `POST /contacts/v1/contacts`
- Delete action: `{values[], deleteOperationType, targetList:[ListReferences|ContactAndAttributes|EntireContact]}`
- Restrict action
- Schema / attributeGroup / attributeSet GETs and PUTs
- Email/attribute/preference search: `{search, startRowIndex, rowLimit, sortBy}`
- Populated attribute groups, `contactEvents`, `establish`, delete/restrict
  retry and options

### 16. Content Builder (22 generics)

- Asset CRUD with a discriminator keyed on `assetType.id` / `assetType.name`
- `POST /asset/v1/content/assets/query` body: `{page, pageSize, filter, fields, sort}`
- Categories CRUD, salutations
- Verify `/asset/v1/content/assets/{id}/file` is GET-for-download; model
  uploads via `POST /asset/v1/content/assets` with a base64 `file` property

### 17. Mobile Push (19 generics)

Type `messageBatch`, `messageApp`, `messageList`, `messageContact`,
`messageTag` send bodies and delivery-result responses; message collection
envelope; application/location CRUD.

### 18. Event Notification Service (18 generics)

- Callback: `{callbackName, url, public, maxBatchSize?, signatureKey?}`
- Subscription: `{callbackId, eventCategoryTypes[], filters[{key,operator,value}], filterValueDataExtensions[]}`
- `verify` (`{token}`), `regenerate`
- Typed `ens-subscriptions-by-cb/{callbackId}` response

### 19. Tags (13 generics)

Typed tag / nestedtag CRUD, associations, delete (`{ids[]}`). Normalise the
trailing slash on `/hub/v1/objects/{objectTypeName}/tags/`.

### 20. Data Extensions (12 generics)

- Async row body: `{items: [{<field>: <value>}]}`
- Confirm `POST /data/v1/async/dataextensions/{id}/rows` returns `202 Accepted`
  with `Location` header and `{requestId}` body
- Add `key:{key}` variant path
- Type `/data/v1/async/{requestId}/results` and `/status` with paged items
  and a `status` enum

### 21. Campaigns (10 generics)

Typed campaign, campaign-asset list/create, delete; confirm `campaign_read` /
`campaign_write` scopes and apply paging params.

### 22. Approvals (10 generics)

Typed approval item, `PATCH` state-transition body, settings, roles.

### 23. MobileConnect SMS (15 generics)

Typed keyword create/update, opt-in body, queueMO, messageContact/messageList
send bodies. Flag deprecated variants explicitly.

### 24. Journey Builder (6 generics)

- `POST /interaction/v1/events`: `{ContactKey, EventDefinitionKey, Data:{...}}`
- `/interactions` query params: `extras`, `versionNumber`,
  `mostRecentVersionOnly`, `$page`, `$pageSize`, `$orderBy`
- `interactions/{id}/audit/{action}` — `action` path param as enum

### 25. Domain Verification (5 generics)

Typed update/delete/push bodies (`{domain}` vs `{domains[]}`); align `status`
and `validationType` enums.

### 26. Address Validation (2 generics)

Request `{email, validators:[SyntaxValidator|MXValidator|ListDetectiveValidator]}`,
response `{valid, email, failedValidation[], level}`.

### 27. Audit Logging (2 generics)

Paged items envelope for `auditEvents` and `securityEvents` with a stable
field set.

---

## P3 — Examples, tooling, hygiene

### 28. Back-fill examples for every write / polling flow

Priority order:
- Transactional email definition + send
- Transactional SMS definition + send
- Contact upsert / delete / restrict
- Journey event injection and contact exit
- Data Extension async write + polling
- ENS callback and subscription setup
- MobileConnect import and status polling
- Mobile Push create and send
- Token acquisition and BU targeting (extend existing)

### 29. Add validation tooling and a CI gate

- `npx @apidevtools/swagger-cli validate specs/sfmc_marketing_cloud_openapi.yaml`
- `npx @stoplight/spectral-cli lint specs/sfmc_marketing_cloud_openapi.yaml`
- Ship a `.spectral.yaml` with SFMC-specific rules (every operation must
  carry `x-sfmc-installed-package-scopes`; scope strings must appear in
  `securitySchemes`; operationId uniqueness)
- Wire a `Makefile` / `npm run validate` target and a GitHub Action

### 30. Add a bundling step

`swagger-cli bundle -o dist/sfmc.yaml` for consumers that can't resolve
external `$ref` (Postman, some codegens).

### 31. Pilot a codegen run

Generate one client (e.g. `typescript-axios` or `openapi-typescript`), record
every manual fix required, and feed it back into the spec.

### 32. Fix README file references

`README.md:246-248` lists `sfmc_marketing_cloud_openapi.yaml`,
`README_sfmc_openapi.md`, `TODO_sfmc_openapi.md` as project files. Actual
files are `specs/sfmc_marketing_cloud_openapi.yaml`, `README.md`, `TODO.md`.

### 33. Add `CHANGELOG.md`

Track spec-version changes; keep it in sync with `info.version`.

### 34. Sweep unused declared scopes

Confirm every scope declared in `securitySchemes` is referenced by at least
one operation; delete dead declarations.

### 35. Check operationId uniqueness in CI

Current naming (`post_v2_token`, `get_messaging_v1_email_messages`) is
regular but fragile against future additions. Add an explicit check.

---

## Migration coverage backlog

Gaps to close in the recipe library (`specs/migrations/*.yaml`) and surrounding agent tooling:

- Add `export-data-extension-rows` once a REST read path is documented here (DE row export is currently SOAP-only in SFMC and is not covered by this inventory).
- Add `export-content-builder-assets-full-tenant` recipe that walks every category tree, not just a single folder.
- Add `import-journey-event-definitions` as a standalone recipe (today event definitions are embedded in `import-journey-definitions`).
- Add `export-contacts-by-attribute-set` once the Contacts search endpoints are typed (see §15).
- Add `import-contacts-upsert` once the upsert body is typed (see §15).
- Add `export-audit-events` with cursor/paging once the audit envelope is typed (see §27).
- Extend `check-migration-extensions.mjs` to enforce that every operation referenced by a recipe step also carries `x-sfmc-installed-package-scopes` (catch silent scope drift).
- Add `x-idempotent: true` on read-only GETs so recipes can blind-retry 5xx without per-step annotation.
- Teach `mcp-server.mjs` a `plan_migration` tool that composes an export recipe with a matching import recipe (explicit cross-tenant use case, kept out of the recipe schema on purpose).

## Quality bar for a broader v1.0

Call the spec ready for broader use when:

- Every P0 item is resolved and the spec validates cleanly in Spectral and
  `swagger-cli`.
- High-value write routes no longer rely on fallback request bodies.
- Main success responses in core families are typed.
- Examples exist for the most-used write and polling flows.
- Shared error schema is referenced from every operation.
- Scope declaration and operation references are in sync (verified in CI).
- A typescript client generates and compiles from the bundled spec.
