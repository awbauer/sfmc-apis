# SFMC OpenAPI Backlog

## Current status snapshot

- Spec version: `0.15.0`
- Remaining `GenericRequestBody` references: **60**
- Remaining `GenericResponse` references: **100**

## Highest-priority next steps

### 1. Contacts long tail

Tighten the remaining Contacts and Contact Builder routes that still rely on broad contracts.

Focus areas:

- schema and attribute-group retrieval responses
- delete/restrict analytics and status variants
- preference search variants
- audience search/count variants beyond current top-level contracts

### 2. Journey Builder response precision

Keep the request side as-is and harden the success bodies.

Focus areas:

- publish async result detail
- stop / pause / resume response envelopes
- audit action response detail
- key-vs-id lifecycle route variants where source rows were truncated

### 3. MobileConnect detail and status routes

Focus areas:

- delivery report/status variants
- message history/detail routes
- async import and list-refresh status payloads
- richer message and delivery result substructures

### 4. Mobile Push detail and status routes

Focus areas:

- application and key detail responses
- message detail variants
- delivery results
- refresh-list status responses

### 5. Domain verification and utility routes

Focus areas:

- bulk insert/update/delete/push result envelopes
- endpoint discovery responses
- token-context response
- any remaining file-location edge cases

### 6. Examples

Add production-useful examples for:

- OAuth token request and response
- transactional email definition + send
- transactional SMS definition + send
- contact upsert / delete / restrict
- journey event injection
- push message create + send
- asset create / query
- ENS callback + subscription setup
- data extension async row write + result polling

## Quality work still needed

### Canonical doc verification

For normalized or ambiguous routes:

- verify route forms against current Salesforce docs
- confirm exact query-string semantics
- verify id-vs-key route variants

### Response hardening

For long-tail routes:

- replace broad envelopes with typed success bodies
- tighten nested arrays and metadata objects
- add enums where Salesforce behavior is stable enough

### Tooling validation

- run the YAML through OpenAPI validators
- test import in Swagger UI / Redoc / Postman
- test at least one codegen target and document any manual fixes needed

## Good stopping point for v1.0

Call the spec ready for broader use when:

- generic request bodies are removed from top-priority operational routes
- major success responses are typed in the main API families
- examples are present for the most-used write operations
- normalized paths are verified where possible
- the file validates cleanly and supports at least one usable generated client
