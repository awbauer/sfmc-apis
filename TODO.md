# SFMC OpenAPI Backlog

## Current status snapshot

- Spec version: `0.16.0`
- Broad fallback request schema references still remain
- Broad fallback success response schema references still remain

## Highest-priority next steps

### 1. MobileConnect status/detail routes

Tighten the remaining legacy MobileConnect operational routes.

Focus areas:

- import-send status and delivery-report responses
- queue import status
- refresh-list status
- message delivery and history payloads
- subscription and keyword administration responses

### 2. Mobile Push status/detail routes

Focus areas:

- application and key detail responses
- message detail and list responses
- delivery results by app/contact/list/tag
- refresh-list status

### 3. Contacts long tail, part 2

The core Contact Builder routes are better. The remaining work is in edge and collection variants.

Focus areas:

- preference search variants
- audience search and count variants
- richer attribute-group and schema nested objects
- stricter enums and nested arrays where the docs are stable enough

### 4. Journey Builder collection/detail precision

The lifecycle routes are better now. The remaining work is in richer collection and detail bodies.

Focus areas:

- interaction collection/list responses
- interaction detail responses
- event-definition list/detail responses
- audit result detail
- publish / pause / resume / stop response nuance by route variant

### 5. Utility and discovery routes

Focus areas:

- endpoint discovery responses
- token-context response
- domain-verification bulk result envelopes
- any remaining file-location edge cases

### 6. Examples

Add or improve realistic examples for:

- OAuth token requests and responses
- transactional email definition and send
- transactional SMS definition and send
- contact upsert / delete / restrict
- journey event injection and contact exit
- push message create and send
- MobileConnect import/status flows
- ENS callback and subscription setup
- Data Extension async write and polling

## Quality work still needed

### Canonical doc verification

For normalized or ambiguous routes:

- verify final path forms against the current Salesforce docs
- confirm query-string semantics
- confirm key-vs-id route variants
- confirm any route family where the permissions matrix used truncated paths

### Response hardening

For remaining long-tail routes:

- replace broad fallback envelopes with typed success bodies
- tighten nested arrays and metadata objects
- add enums where Salesforce behavior is stable enough
- use `oneOf` where polymorphism is real and documented

### Tooling validation

- run the YAML through an OpenAPI validator
- test import in Swagger UI, Redoc, and Postman
- generate at least one SDK and document manual fixes
- smoke-test a small client against a sandbox tenant

## Good stopping point for v1.0

Call the spec ready for broader use when:

- high-value request bodies no longer rely on broad fallback schemas
- major success responses are typed in the main API families
- examples exist for the most-used write operations
- normalized paths have been verified where possible
- the file validates cleanly and supports at least one usable generated client
