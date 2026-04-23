# SFMC OpenAPI Backlog

## Current snapshot

- Spec version: `0.17.0`
- Remaining `GenericRequestBody` references: `85`
- Remaining `GenericResponse` references: `132`

Important note:

The YAML still contains a meaningful amount of broad fallback modeling. This is still useful, but it is not a fully strict, codegen-clean SFMC contract yet.

## Highest-priority next steps

### 1. Reduce fallback schemas in the biggest remaining route clusters

Focus on the families still carrying the most broad request/response envelopes:

- Contacts preference and audience variants
- Journey Builder route variants not covered by the main lifecycle/detail pass
- legacy MobileConnect variants not yet tightened
- remaining Mobile Push list/status variants
- utility and auth edge routes

### 2. Tighten remaining Contacts long tail

Focus areas:

- preference search variants
- audience search and count variants
- richer schema and attribute-group nesting
- stricter nested arrays and enums where the docs are stable enough

### 3. Tighten remaining Journey Builder detail variants

Focus areas:

- route variants by key vs id
- publish / pause / resume / stop response differences
- interaction detail nesting
- event-definition nested fields
- audit result structure

### 4. Validate normalized paths against current docs

Prioritize route families where the permission matrix was clearly truncated or inconsistent.

Focus areas:

- legacy MobileConnect routes
- Journey lifecycle routes with query-string variants
- utility and discovery routes
- any key-vs-id path pair where the doc shape is unclear

### 5. Improve examples

Add realistic examples for:

- token acquisition and BU targeting
- transactional email definition + send
- transactional SMS definition + send
- contact upsert / delete / restrict
- Journey event injection and contact exit
- MobileConnect import and status polling
- Mobile Push create and send
- ENS callback and subscription setup
- Data Extension async write and polling

### 6. OpenAPI validation and tooling

- validate in Swagger Editor or another OpenAPI validator
- import into Swagger UI and Redoc
- import into Postman
- attempt at least one generated SDK
- document any manual fixes needed for codegen consumers

## Quality bar for a broader v1.0

Call the spec ready for broader use when:

- high-value write routes no longer rely heavily on fallback request bodies
- the main success responses in core families are typed
- examples exist for the most-used write and polling flows
- normalized paths have been checked against current Salesforce docs
- the YAML validates cleanly in common tooling
