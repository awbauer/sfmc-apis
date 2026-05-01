# SFMC Migration Toolkit Backlog

Last audited: **2026-04-30**

This file now tracks task status explicitly:
- ✅ **Done**
- 🟡 **In progress / partially done**
- ⬜ **Not started**

## P0 — Spec integrity

1. ✅ **Define missing Journey lifecycle schemas** — Present in `components.schemas` (`JourneyPauseRequest`, `JourneyResumeRequest`, `JourneyStopRequest`, `JourneyLifecycleRequest`, `JourneyLifecycleResponse`, contact membership schemas).
2. ✅ **Fix `/v2/authorize` method and shape** — Modeled as `GET` with query params and `302` redirect semantics.
3. ✅ **Align declared oauth2 scopes with operation usage** — Scope sync check exists and now fails on both missing and unused declarations (`npm run check:scopes`).
4. ✅ **Resolve duplicate `/messaging/v1/email/messages` paths** — Canonicalized path in root and fragment.
5. ✅ **Fix malformed `x-original-marketing-cloud-paths`** — Leading slash normalization complete.
6. ✅ **Make the spec validate cleanly** — `swagger-cli validate` + Spectral + scope/migration checks are in `npm run validate` and CI.

## P1 — Cross-cutting architecture

7. ✅ **Scope the auth host per operation** — Root server now defaults to tenant REST base URL, and auth/discovery control-plane operations in `specs/paths/auth.yaml` now declare explicit auth-host operation-level `servers` overrides.
8. ✅ **Add a root-level default `security:`** — Root-level `security:` now defaults to `bearerAuth`; auth/discovery routes still override with `security: []`.
9. 🟡 **Introduce shared error schemas and reusable responses** — Shared error envelope + reusable 4xx/5xx responses now cover Transactional SMS; rollout to remaining families is still pending.
10. 🟡 **Codify `additionalProperties` policy** — Many schemas conform; full repo-wide sweep still pending.
11. 🟡 **Mark legacy routes deprecated** — Legacy auth token, Automation Studio beta routes, and core MobileConnect send entry points are now flagged; additional superseded variants still need a consistency sweep.
12. ✅ **Add reusable paging parameters** — Shared `components.parameters.page` and `pageSize` now back the live collection paging usage on Automation Studio.

## P2 — Replace fallback schemas with typed models

13. 🟡 Transactional Email (typed coverage improved; full 15-fallback elimination still pending).
14. ✅ Transactional SMS typing + canonical base-path consolidation (definitions, queue, and message request/response models are typed and now consistently exposed under canonical `/messaging/v1/sms/*` routes).
15. ⬜ Contacts typing sweep (largest remaining cluster).
16. ⬜ Content Builder typing/discriminator/query body completion.
17. ⬜ Mobile Push typing completion.
18. ⬜ Event Notification Service typing completion.
19. ⬜ Tags typing/trailing-slash normalization completion.
20. ⬜ Data Extensions async rows/results/status typing completion.
21. ⬜ Campaigns typing + paging/scope confirmation completion.
22. ⬜ Approvals typing completion.
23. ⬜ MobileConnect SMS typing + deprecation normalization completion.
24. 🟡 Journey Builder typing (lifecycle done; remaining generic endpoints pending).
25. ⬜ Domain Verification typing completion.
26. ⬜ Address Validation typing completion.
27. ⬜ Audit Logging envelope typing completion.

## P3 — Examples, tooling, hygiene

28. ⬜ Back-fill examples for every write/polling flow.
29. ✅ **Validation tooling and CI gate** — Implemented via `npm run validate`, Spectral, swagger-cli, and GitHub Action.
30. ✅ **Add bundling step** — `npm run bundle:openapi` emits `dist/sfmc.yaml`; included in `npm run validate`.
31. ⬜ Pilot a codegen run and document manual fixes.
32. ✅ **Fix README file references** — Repo paths now match actual file layout.
33. ✅ **Add `CHANGELOG.md`** — Added and seeded with current milestone entry.
34. ✅ **Sweep unused declared scopes** — `openid` removed from oauth2 declarations; scope sync now enforces no unused declarations.
35. ✅ **Check `operationId` uniqueness in CI** — `npm run check:operationIds` added and chained into `npm run validate`.

## Migration coverage backlog

- ⬜ Add `export-data-extension-rows` once REST read path is formally represented.
- ⬜ Add `export-content-builder-assets-full-tenant` recipe.
- ✅ Add standalone `import-journey-event-definitions` recipe.
- ⬜ Add `export-contacts-by-attribute-set` after Contacts typing completion.
- ⬜ Add `import-contacts-upsert` after Contacts upsert body typing.
- ⬜ Add `export-audit-events` after audit envelope typing.
- ✅ Extend migration extension checks to validate recipe-referenced operations carry required migration metadata.
- ⬜ Add `x-idempotent: true` on read-only GETs.
- ✅ Add MCP `plan_migration` composition tool.

## Tenant-driven backlog (2026-04-30)

These items come from live-tenant testing and an SFMC-architecture review. They are intended to improve both repo quality and the repo's practical usefulness during real migration work.

### Functional gaps for migration agents

- ⬜ **Prioritize Data Extension export/discovery coverage** — add formally modeled read/export kickoff routes, schema/field inspection, and a real `export-data-extension-rows` path instead of only async pollers plus import flows.
- ⬜ **Add Automation Studio export/discovery recipe coverage** — model useful read-side automation inventory/export flows, not just raw endpoints.
- ⬜ **Add tenant deep-dive smoke test tooling** — script auth + representative read-only checks (journeys, event definitions, content categories/assets, automations, tenant-validated utility endpoints) and emit structured JSON for repeatable validation.
- ⬜ **Broaden scope-family coverage against real tenant capability** — close gaps where tenant scopes are present but the catalog has no matching operations or recipes.
- ⬜ **Add a tenant capability matrix artifact** — document which installed-package scopes map to modeled operations, partially modeled families, and unmapped tenant capabilities.

### Quality / usability improvements

- ⬜ **Fix Content Builder scope/prerequisite modeling** — observed tenant behavior allowed reads that did not line up cleanly with the returned scope string; review assumptions and document nuances.
- ⬜ **Improve MCP endpoint ranking and family normalization** — make `get_endpoint_for_task` less dependent on exact token overlap and more tolerant of family aliases / human phrasing.
- ⬜ **Add alias-aware matching between tags, recipe families, and user task language** — e.g. `content_builder` vs `Content Builder`, `data_extensions` vs DE phrasing.
- ⬜ **Expand migration-ready examples for export flows** — especially for Journey History, Content Builder asset export, and future DE export patterns.
- ⬜ **Document known tenant-tested behaviors that differ from naive scope expectations** — keep a short living note so future contributors do not assume the scope matrix tells the whole runtime story.

### Architect-perspective backlog

- ⬜ **Add modeling/support for governance-sensitive export surfaces** — prioritize assets that matter during real tenant rationalization: journey history, automation inventory, event-definition inventory, audit/event exports, and DE metadata export.
- ⬜ **Add support for ownership / lifecycle oriented migration planning** — consider MCP/catalog affordances that help agents reason about archive candidates, active vs obsolete assets, and dependency-aware export sequencing.
- ⬜ **Document recommended pre-migration discovery order** — e.g. tenant context -> scope check -> journeys/events -> content -> automations -> DEs -> audit/dependency sweep.

## Current quality bar

To call this spec ready for broader v1.0, all remaining ⬜/🟡 items above should be completed and re-audited.
