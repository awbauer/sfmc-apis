# SFMC Migration Toolkit — Product Backlog

Last audited: **2026-05-01**

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Done |
| 🔵 | In progress |
| ⬜ | Not started |

---

## Now — in progress

These are actively being worked; finish before pulling new work.

- 🔵 **Shared error schemas rollout** — Transactional SMS covered; roll out reusable 4xx/5xx envelope to all remaining API families.
- 🔵 **`additionalProperties` policy sweep** — Many schemas conform; complete repo-wide pass.
- 🔵 **Deprecated-route consistency sweep** — Legacy auth, Automation Studio beta, and core MobileConnect entry points flagged; finish remaining superseded variants.
- 🔵 **Transactional Email typing** — Coverage improved; eliminate remaining 15 fallback schemas.
- 🔵 **Journey Builder remaining generics** — Lifecycle endpoints done; finish remaining generic endpoints.

---

## Milestone 1 — Spec completeness (gate for v1.0)

Goal: every endpoint typed, every cross-cutting policy applied, CI green.

### 1a. Finish typed schemas (P2 sweep)

Ordered by migration-agent value and inter-item dependencies.

1. ⬜ **Contacts** — largest remaining cluster; blocks `export-contacts-by-attribute-set` and `import-contacts-upsert` recipes.
2. ⬜ **Content Builder** — discriminator, query body, scope/prerequisite nuances; blocks content export recipes and `export-content-builder-assets-full-tenant`.
3. ⬜ **Data Extensions async rows / results / status** — blocks `export-data-extension-rows` recipe.
4. ⬜ **Audit Logging envelope** — blocks `export-audit-events` recipe.
5. ⬜ **Mobile Push** — standalone family; no upstream dependencies.
6. ⬜ **MobileConnect SMS** — typing + deprecation normalization.
7. ⬜ **Campaigns** — typing + paging/scope confirmation.
8. ⬜ **Event Notification Service** — standalone family.
9. ⬜ **Tags** — typing + trailing-slash normalization.
10. ⬜ **Approvals** — standalone family.
11. ⬜ **Domain Verification** — standalone family.
12. ⬜ **Address Validation** — standalone family.

### 1b. Finish migration recipes

Unlock these after their prerequisite typing work above ships.

- ⬜ **`export-data-extension-rows`** — after DE async rows typing (item 3).
- ⬜ **`export-content-builder-assets-full-tenant`** — after Content Builder typing (item 2).
- ⬜ **`export-contacts-by-attribute-set`** — after Contacts typing (item 1).
- ⬜ **`import-contacts-upsert`** — after Contacts upsert body typing (item 1).
- ⬜ **`export-audit-events`** — after Audit Logging typing (item 4).
- ⬜ **Add `x-idempotent: true`** on all read-only GETs.

### 1c. Hygiene

- ⬜ **Back-fill examples** for every write and polling flow.
- ⬜ **Pilot codegen run** and document required manual fixes.

---

## Milestone 2 — Tenant inventory and discovery capabilities

Goal: the repo becomes the canonical tool for an architect-grade tenant assessment, replacing ad hoc extraction scripts.

### 2a. Tenant runner infrastructure *(foundation — do first)*

- ⬜ **Reusable tenant deep-dive runner** — auth, token refresh, REST pagination, SOAP pagination, normalization, and export packaging in one supported workflow. *(Absorbs "tenant deep-dive smoke test tooling" and "fetched vs blocked" capability reporting.)*
- ⬜ **SOAP support layer** — retrieve helpers, `ContinueRequest` pagination, XML parsing/normalization, typed mappers for common SFMC SOAP objects.
- ⬜ **Mixed REST + SOAP workflow support** — treat combined-surface inventories as a first-class pattern.
- ⬜ **Multi-format report packaging** — XLSX/CSV/JSON deliverables with summary + per-family tabs; no one-off local scripts required.
- ⬜ **"Fetched vs blocked" capability reporting** — distinguish tenant-granted scope, repo-modeled endpoint, practically fetchable data, and still-unexposed gaps.

### 2b. Data Extension intelligence *(highest migration value)*

- ⬜ **DE inventory** — folder mapping, sendability flag, retention posture, send-relationship metadata, architecture-oriented export outputs.
- ⬜ **DE schema export** — field lists, types, max length, required/primary-key flags, schema sampling workflows.
- ⬜ **DE row-count / storage-pressure** — if exposed; migration sizing depends on this.
- ⬜ **DataFolder hierarchy / path reconstruction** — canonical folder paths and depth analysis for DEs and other SOAP-backed assets.

### 2c. Query and SQL governance

- ⬜ **QueryDefinition / SQL inventory** — query text export, target update-type analysis, category/folder mapping.
- ⬜ **Query hygiene heuristics** — flag `SELECT *`, likely test/demo queries, overwrite-heavy patterns, and other migration/ops risk signals.

### 2d. Ownership and governance

- ⬜ **AccountUser inventory** — active/inactive status, API-user detection, owner-enrichment helpers.
- ⬜ **Owner-resolution helpers** — map numeric `createdBy` / `modifiedBy` values and partial references back to the user inventory.
- ⬜ **Installed-package governance** — owner, purpose, scope-mapping, auth pattern, rotation metadata.
- ⬜ **BU / environment-context reporting** — distinguish enterprise-shared vs BU-local sprawl; reason about environment boundaries.
- ⬜ **Tenant capability matrix artifact** — document which installed-package scopes map to modeled operations, partially modeled families, and unmapped tenant capabilities.

### 2e. Content and messaging

- ⬜ **Content hierarchy utilities** — Content Builder category path reconstruction, depth analysis, empty-folder detection, taxonomy reporting. *(Complements Content Builder typing in M1.)*
- ⬜ **Content dependency / reuse analysis** — asset-to-journey/email/cloudpage linkage, orphan detection, archive-candidate reporting.
- ⬜ **Sender-profile and send-classification inventory** — normalize sender-layer governance objects into the assessment flow.
- ⬜ **Legacy triggered / email send definition inventory** — support tenants still relying on TSD/ESD.
- ⬜ **Deliverability coverage** — delivery profiles, sender auth/domain setup, IP strategy, send-classification completeness.

### 2f. Operational health

- ⬜ **Journey History deep-dive workflows** — freshness, summaries, filtered search, export/report patterns as first-class repo features. *(Builds on tenant-validated endpoints already modeled.)*
- ⬜ **Journey / Event Definition health heuristics** — combine metadata, reuse, and history signals; do not leave agents to infer health manually.
- ⬜ **Automation deep-detail export** — normalize steps, activities, schedules, and hygiene signals across the full automation estate.
- ⬜ **Automation runtime history / failure trends** — last-run, failure trends, notifications, and operational criticality.
- ⬜ **Architect-oriented aggregation / reporting** — governance, lifecycle, ownership, and migration-readiness summaries derivable without manual spreadsheet work.

---

## Milestone 3 — Developer experience and ecosystem

Goal: make it easy for new contributors and downstream tool authors to adopt this spec.

- ⬜ **Alias-aware tag/family/task matching** — `content_builder` ↔ `Content Builder`, `data_extensions` ↔ DE phrasing; reduce friction in `get_endpoint_for_task`.
- ⬜ **Improve MCP endpoint ranking** — make retrieval less dependent on exact token overlap; more tolerant of family aliases and human phrasing.
- ⬜ **Documented pre-migration discovery order** — recommended sequence: tenant context → scope check → journeys/events → content → automations → DEs → audit/dependency sweep.
- ⬜ **Living note on tenant-tested behaviors** — document runtime nuances that diverge from naive scope expectations so future contributors don't re-discover them.
- ⬜ **`export-contacts-by-attribute-set` example expansion** — especially Journey History, Content Builder asset export, and DE export patterns.

---

## Completed (archived)

<details>
<summary>P0 — Spec integrity (all done)</summary>

- ✅ Define missing Journey lifecycle schemas
- ✅ Fix `/v2/authorize` method and shape
- ✅ Align declared oauth2 scopes with operation usage (`npm run check:scopes`)
- ✅ Resolve duplicate `/messaging/v1/email/messages` paths
- ✅ Fix malformed `x-original-marketing-cloud-paths`
- ✅ Make the spec validate cleanly (`npm run validate`, Spectral, CI)

</details>

<details>
<summary>P1 — Cross-cutting architecture (mostly done)</summary>

- ✅ Scope the auth host per operation (tenant REST base URL default; auth/discovery override)
- ✅ Add root-level default `security:` (bearerAuth; auth/discovery override with `security: []`)
- ✅ Add reusable paging parameters (`components.parameters.page` / `pageSize`)

</details>

<details>
<summary>P2 — Typed schemas (partial)</summary>

- ✅ Transactional SMS typing + canonical base-path consolidation

</details>

<details>
<summary>P3 — Tooling and hygiene (mostly done)</summary>

- ✅ Validation tooling and CI gate (`npm run validate`, Spectral, swagger-cli, GitHub Action)
- ✅ Bundling step (`npm run bundle:openapi` → `dist/sfmc.yaml`)
- ✅ Fix README file references
- ✅ Add `CHANGELOG.md`
- ✅ Sweep unused declared scopes (`openid` removed; scope sync enforces no unused declarations)
- ✅ Check `operationId` uniqueness in CI (`npm run check:operationIds`)

</details>

<details>
<summary>Migration recipes (partial)</summary>

- ✅ Add standalone `import-journey-event-definitions` recipe
- ✅ Extend migration extension checks (recipe-referenced operations must carry required migration metadata)
- ✅ Add MCP `plan_migration` composition tool

</details>
